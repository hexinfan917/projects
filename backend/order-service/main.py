"""
订单服务 - Order Service
端口: 8003
职责: 订单/支付/退款/发票
"""
import sys
import json
import os
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends, Header, HTTPException
from contextlib import asynccontextmanager
from typing import Optional, List
from datetime import datetime, timedelta, date
from pydantic import BaseModel
import httpx
import hmac
import hashlib
from sqlalchemy import select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from common.config import settings
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler, BadRequestException
from common.logger import setup_logger
from common.dependencies import get_current_user
from common.database import get_db, AsyncSessionLocal
from common.response import success

settings.app_name = "order-service"
settings.app_port = 8003
logger = setup_logger("order-service")

# 核销密钥（应与环境变量或配置中心同步）
VERIFY_SECRET = os.getenv("ORDER_VERIFY_SECRET", "petway-verify-secret-2024")


def parse_pet_tags(raw):
    """解析宠物标签字段，支持 JSON 字符串、列表或 null/None 字符串"""
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s or s.lower() in ("null", "none", ""):
            return []
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return parsed
            if parsed is None:
                return []
            return [str(parsed)]
        except (json.JSONDecodeError, ValueError):
            return [s]
    return [str(raw)]


def generate_verify_code(order_no: str) -> str:
    """生成订单核销码（HMAC-SHA256）"""
    return hmac.new(
        VERIFY_SECRET.encode('utf-8'),
        order_no.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()[:16].upper()


def generate_refund_no() -> str:
    """生成退款单号"""
    import random
    return f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"


def verify_order_code(order_no: str, code: str) -> bool:
    """验证核销码"""
    expected = generate_verify_code(order_no)
    return hmac.compare_digest(expected, code.upper())


async def auto_cancel_expired_orders():
    """
    后台任务：自动取消超过15分钟未支付的订单并释放库存
    """
    while True:
        try:
            await asyncio.sleep(60)  # 每分钟检查一次
            async with AsyncSessionLocal() as db:
                # 查询所有待支付且创建时间超过15分钟的订单
                result = await db.execute(
                    text("""
                        SELECT id, order_no, schedule_id, seat_count 
                        FROM orders 
                        WHERE status = 10 AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                    """)
                )
                expired_orders = result.mappings().all()
                
                for row in expired_orders:
                    order_id = row["id"]
                    schedule_id = row["schedule_id"]
                    order_no = row["order_no"]
                    restore_count = row["seat_count"] or 0
                    
                    # 查询订单是否使用了优惠券
                    coupon_result = await db.execute(
                        text("SELECT coupon_id FROM orders WHERE id = :order_id"),
                        {"order_id": order_id}
                    )
                    coupon_row = coupon_result.mappings().one_or_none()
                    if coupon_row and coupon_row["coupon_id"]:
                        await db.execute(
                            text("UPDATE user_coupons SET status = 1, used_order_id = NULL, used_at = NULL WHERE id = :coupon_id"),
                            {"coupon_id": coupon_row["coupon_id"]}
                        )
                    
                    # 取消订单（原子操作，必须确认状态仍为待支付）
                    cancel_result = await db.execute(
                        text("UPDATE orders SET status = 30, updated_at = NOW() WHERE id = :order_id AND status = 10"),
                        {"order_id": order_id}
                    )
                    
                    # 只有订单确实被取消了，才恢复库存（根据实际占座数恢复；自驾不占座则不恢复）
                    if cancel_result.rowcount > 0 and restore_count > 0:
                        if schedule_id:
                            await db.execute(
                                text("""
                                    UPDATE route_schedules 
                                    SET stock = stock + :restore_count, sold = sold - :restore_count 
                                    WHERE id = :schedule_id AND sold >= :restore_count
                                """),
                                {"schedule_id": schedule_id, "restore_count": restore_count}
                            )
                        await db.commit()
                        logger.info(f"Auto cancelled expired order: {order_no}, restored {restore_count} stock for schedule {schedule_id}")
                    else:
                        await db.commit()
                        logger.info(f"Auto cancel skipped: {order_no} was already cancelled")
        except Exception as e:
            logger.error(f"Auto cancel task error: {e}")


async def auto_expire_coupons():
    """
    后台任务：自动将过期优惠券状态更新为已过期（每天凌晨3点执行）
    """
    while True:
        try:
            # 计算距离下一个凌晨3点的时间
            now = datetime.now()
            next_run = now.replace(hour=3, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            sleep_seconds = (next_run - now).total_seconds()
            await asyncio.sleep(sleep_seconds)
            
            # 执行过期更新
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    text("""
                        UPDATE user_coupons 
                        SET status = 3 
                        WHERE valid_end_time < NOW() AND status = 1
                    """)
                )
                await db.commit()
                affected = result.rowcount
                if affected > 0:
                    logger.info(f"Auto expired {affected} coupons")
        except Exception as e:
            logger.error(f"Auto expire coupons task error: {e}")
            await asyncio.sleep(3600)  # 出错后1小时再试


async def auto_grant_monthly_member_coupons():
    """
    后台任务：每月1日凌晨4点给会员发放月度优惠券
    
    配置方式：在 member_plans.benefit_config 中添加 monthly_coupons 字段
    格式示例：
    {
        "monthly_coupons": {
            "templates": [
                {"template_id": 1, "count": 2, "valid_days": 30},
                {"template_id": 2, "count": 1, "valid_days": 30}
            ]
        }
    }
    """
    while True:
        try:
            # 计算距离下个月1日凌晨4点的时间
            now = datetime.now()
            if now.day == 1 and now.hour < 4:
                # 今天就是1号且还没到4点，今天执行
                next_run = now.replace(hour=4, minute=0, second=0, microsecond=0)
            else:
                # 下个月1日
                if now.month == 12:
                    next_run = now.replace(year=now.year + 1, month=1, day=1, hour=4, minute=0, second=0, microsecond=0)
                else:
                    next_run = now.replace(month=now.month + 1, day=1, hour=4, minute=0, second=0, microsecond=0)
            sleep_seconds = (next_run - now).total_seconds()
            logger.info(f"Monthly coupon grant task will run at {next_run}, sleep {sleep_seconds/3600:.1f} hours")
            await asyncio.sleep(sleep_seconds)
            
            # 执行月度优惠券发放
            async with AsyncSessionLocal() as db:
                # 查询所有生效中的会员及其套餐配置
                result = await db.execute(
                    text("""
                        SELECT um.user_id, um.plan_id, mp.benefit_config, um.id as membership_id
                        FROM user_memberships um
                        JOIN member_plans mp ON um.plan_id = mp.id
                        WHERE um.status = 1 AND um.end_date >= CURDATE()
                    """)
                )
                memberships = result.mappings().all()
                
                total_granted = 0
                skipped = 0
                current_month = datetime.now().strftime("%Y-%m")
                
                for membership in memberships:
                    user_id = membership["user_id"]
                    plan_id = membership["plan_id"]
                    benefit_config = membership["benefit_config"]
                    
                    # 解析 benefit_config
                    if isinstance(benefit_config, str):
                        try:
                            benefit_config = json.loads(benefit_config)
                        except:
                            continue
                    
                    if not benefit_config or not isinstance(benefit_config, dict):
                        continue
                    
                    monthly_config = benefit_config.get("monthly_coupons", {})
                    templates_config = monthly_config.get("templates", [])
                    
                    if not templates_config:
                        continue
                    
                    # 检查本月是否已发放（防止重复发放）
                    # 通过查询本月是否已有source_type=3且source_id=plan_id的记录
                    check_result = await db.execute(
                        text("""
                            SELECT COUNT(*) FROM user_coupons 
                            WHERE user_id = :user_id 
                            AND source_type = 3 
                            AND source_id = :plan_id 
                            AND DATE_FORMAT(created_at, '%Y-%m') = :current_month
                        """),
                        {"user_id": user_id, "plan_id": plan_id, "current_month": current_month}
                    )
                    already_granted = check_result.scalar() or 0
                    
                    if already_granted > 0:
                        skipped += 1
                        logger.debug(f"Monthly coupons already granted for user {user_id} in {current_month}, skipping")
                        continue
                    
                    for item in templates_config:
                        template_id = item.get("template_id")
                        count = item.get("count", 1)
                        valid_days = item.get("valid_days", 30)
                        
                        if not template_id:
                            continue
                        
                        # 查询模板
                        template_result = await db.execute(
                            text("SELECT * FROM coupon_templates WHERE id = :template_id AND status = 1"),
                            {"template_id": template_id}
                        )
                        template = template_result.mappings().one_or_none()
                        if not template:
                            logger.warning(f"Monthly coupon template not found: {template_id}")
                            continue
                        
                        # 发放优惠券
                        valid_start = datetime.now()
                        valid_end = valid_start + timedelta(days=valid_days)
                        
                        for _ in range(count):
                            await db.execute(
                                text("""
                                    INSERT INTO user_coupons (
                                        user_id, template_id, coupon_no, name, type, value, 
                                        min_amount, max_discount, applicable_type, applicable_ids, 
                                        valid_start_time, valid_end_time, status, source_type, source_id, 
                                        description, created_at
                                    ) VALUES (
                                        :user_id, :template_id, :coupon_no, :name, :type, :value,
                                        :min_amount, :max_discount, :applicable_type, :applicable_ids,
                                        :valid_start, :valid_end, 1, 3, :source_id, :description, NOW()
                                    )
                                """),
                                {
                                    "user_id": user_id,
                                    "template_id": template["id"],
                                    "coupon_no": generate_coupon_no(),
                                    "name": template["name"],
                                    "type": template["type"],
                                    "value": template["value"],
                                    "min_amount": template["min_amount"],
                                    "max_discount": template["max_discount"],
                                    "applicable_type": template["applicable_type"],
                                    "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                                    "valid_start": valid_start,
                                    "valid_end": valid_end,
                                    "source_id": plan_id,
                                    "description": template.get("description") or f"会员每月发放 - {template['name']}",
                                }
                            )
                            total_granted += 1
                
                await db.commit()
                logger.info(f"Monthly member coupons granted: {total_granted} coupons, {skipped} members skipped (already granted) out of {len(memberships)} total members")
        except Exception as e:
            logger.error(f"Auto grant monthly coupons task error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await asyncio.sleep(3600)  # 出错后1小时再试


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    # 启动自动取消任务
    asyncio.create_task(auto_cancel_expired_orders())
    # 启动自动过期优惠券任务
    asyncio.create_task(auto_expire_coupons())
    # 启动会员每月发放优惠券任务
    asyncio.create_task(auto_grant_monthly_member_coupons())
    yield
    await redis_client.close()

app = FastAPI(title="订单服务", description="订单/支付/退款", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)

# 模拟订单数据库
ORDERS_DB = {}
ORDER_NO_COUNTER = 202404001

class CreateOrderRequest(BaseModel):
    route_id: int
    schedule_id: int
    route_name: str
    travel_date: str
    participant_count: int
    pet_count: int = 0
    participants: List[dict] = []
    pets: List[dict] = []
    contact: dict = {}
    route_price: float
    insurance_price: float = 0
    equipment_price: float = 0
    discount_amount: float = 0
    coupon_id: Optional[int] = None
    addons: List[dict] = []
    addon_amount: float = 0
    travel_type: Optional[str] = None
    package_type: Optional[str] = None
    is_free: int = 0
    is_member_only: Optional[int] = 0
    is_insurance_required: Optional[int] = 1


class AdminUpdateOrderRequest(BaseModel):
    contact: Optional[dict] = None
    participants: Optional[List[dict]] = None
    pets: Optional[List[dict]] = None
    participant_count: Optional[int] = None
    pet_count: Optional[int] = None
    travel_date: Optional[str] = None
    travel_type: Optional[str] = None
    remark: Optional[str] = None

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}

# 状态映射
STATUS_MAP = {
    10: "待支付",
    20: "待出行",
    30: "已取消",
    40: "退款中",
    45: "退款驳回",
    50: "已退款",
    55: "部分退款",
    60: "已完成",
    70: "已评价"
}

@app.get("/api/v1/orders")
async def get_orders(
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取订单列表（从数据库）"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    
    query = select(Order).where(Order.user_id == user_id)
    
    if status:
        query = query.where(Order.status == status)
    
    query = query.order_by(Order.created_at.desc())
    
    # 分页
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    orders_db = result.scalars().all()
    
    # 补充缺失的路线封面图（旧订单可能没有保存 route_cover）
    route_ids = list({o.route_id for o in orders_db if o.route_id and not o.route_cover})
    route_cover_map = {}
    if route_ids:
        placeholders = ",".join([f":id_{i}" for i in range(len(route_ids))])
        params = {f"id_{i}": route_id for i, route_id in enumerate(route_ids)}
        cover_result = await db.execute(
            text(f"SELECT id, cover_image FROM routes WHERE id IN ({placeholders})"),
            params
        )
        route_cover_map = {row["id"]: row["cover_image"] for row in cover_result.mappings().all()}
    
    orders = []
    for o in orders_db:
        orders.append({
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "route_id": o.route_id,
            "is_free": o.is_free,
            "route_name": o.route_name,
            "route_cover": o.route_cover or route_cover_map.get(o.route_id, ""),
            "travel_date": o.travel_date.isoformat(),
            "participant_count": o.participant_count,
            "pet_count": o.pet_count,
            "travel_type": o.travel_type,
            "package_type": o.package_type,
            "participants": o.participants or [],
            "pets": o.pets or [],
            "contact": o.contact or {},
            "route_price": float(o.route_price),
            "insurance_price": float(o.insurance_price),
            "addon_amount": float(o.addon_amount),
            "travel_type": o.travel_type,
            "package_type": o.package_type,
            "pay_amount": float(o.pay_amount),
            "status": o.status,
            "status_name": STATUS_MAP.get(o.status, "未知"),
                
            "pay_time": o.pay_time.isoformat() if o.pay_time else None,
            "order_time": o.created_at.isoformat(),
            "created_at": o.created_at.isoformat(),
            "refund_reject_reason": o.refund_reject_reason
        })
    
    return success({
        "total": total,
        "page": page,
        "page_size": page_size,
        "orders": orders
    })

@app.get("/api/v1/orders/{order_id}")
async def get_order_detail(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取订单详情（从数据库）"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    o = result.scalar_one_or_none()
    
    if not o:
        return success({})
    
    # 直接使用订单存储的联系人信息
    contact = o.contact or {}
    
    # 补全宠物档案信息（按 id 优先匹配，再按名字匹配）
    order_pets = o.pets or []
    pets = order_pets
    if o.user_id and order_pets:
        pet_result = await db.execute(
            text("""
                SELECT id, user_id, name, breed, breed_type, birth_date, age_str,
                       gender, weight, vaccine_date, vaccine_book, health_notes,
                       avatar, tags, is_default, status, created_at, updated_at
                FROM pet_profiles
                WHERE user_id = :user_id
            """),
            {"user_id": o.user_id}
        )
        pet_map_by_id = {}
        pet_map_by_name = {}
        for row in pet_result.fetchall():
            pet_data = {
                "id": row[0],
                "user_id": row[1],
                "name": row[2],
                "breed": row[3],
                "breed_type": row[4],
                "birth_date": row[5].isoformat() if row[5] else None,
                "age_str": row[6],
                "gender": row[7],
                "weight": row[8],
                "vaccine_date": row[9].isoformat() if row[9] else None,
                "vaccine_book": row[10],
                "health_notes": row[11],
                "avatar": row[12],
                "tags": parse_pet_tags(row[13]),
                "is_default": row[14],
                "status": row[15],
                "created_at": row[16].isoformat() if row[16] else None,
                "updated_at": row[17].isoformat() if row[17] else None,
            }
            pet_map_by_id[row[0]] = pet_data
            pet_map_by_name[(row[1], row[2])] = pet_data
        
        enriched_pets = []
        for p in order_pets:
            pet_profile = pet_map_by_id.get(p.get("id")) or pet_map_by_name.get((o.user_id, p.get("name"))) or {}
            enriched_pets.append({
                "id": pet_profile.get("id") or p.get("id") or "",
                "name": p.get("name") or pet_profile.get("name") or "",
                "breed": p.get("breed") if p.get("breed") is not None else pet_profile.get("breed") or "",
                "breed_type": pet_profile.get("breed_type") or "",
                "gender": p.get("gender") if p.get("gender") is not None else pet_profile.get("gender"),
                "birth_date": pet_profile.get("birth_date") or "",
                "age_str": pet_profile.get("age_str") or "",
                "weight": p.get("weight") if p.get("weight") is not None else (float(pet_profile.get("weight")) if pet_profile.get("weight") is not None else None),
                "vaccine_date": pet_profile.get("vaccine_date") or "",
                "vaccine_book": pet_profile.get("vaccine_book") or "",
                "health_notes": pet_profile.get("health_notes") or "",
                "avatar": pet_profile.get("avatar") or "",
                "tags": pet_profile.get("tags") or [],
                "is_default": pet_profile.get("is_default") or 0,
                "status": pet_profile.get("status") or 1,
                "created_at": pet_profile.get("created_at") or "",
                "updated_at": pet_profile.get("updated_at") or "",
            })
        pets = enriched_pets
    
    # 查询退款记录
    from app.models.refund_record import RefundRecord
    refund_records_result = await db.execute(
        select(RefundRecord).where(RefundRecord.order_id == o.id).order_by(RefundRecord.created_at.desc())
    )
    refund_records = refund_records_result.scalars().all()
    
    order = {
        "id": o.id,
        "order_no": o.order_no,
        "user_id": o.user_id,
        "schedule_id": o.schedule_id,
        "route_id": o.route_id,
        "is_free": o.is_free,
        "route_name": o.route_name,
        "route_cover": o.route_cover,
        "travel_date": o.travel_date.isoformat(),
        "participant_count": o.participant_count,
        "pet_count": o.pet_count,
        "participants": o.participants or [],
        "pets": pets,
        "contact": contact,
        "route_price": float(o.route_price),
        "insurance_price": float(o.insurance_price),
        "equipment_price": float(o.equipment_price),
        "addon_amount": float(o.addon_amount),
        "addons": o.addons or [],
        "travel_type": o.travel_type,
        "package_type": o.package_type,
        "total_amount": float(o.total_amount),
        "discount_amount": float(o.discount_amount),
        "pay_amount": float(o.pay_amount),
        "refunded_amount": float(o.refunded_amount or 0),
        "status": o.status,
        "status_name": STATUS_MAP.get(o.status, "未知"),
                
        "pay_time": o.pay_time.isoformat() if o.pay_time else None,
        "pay_channel": o.pay_channel,
        "remark": o.remark,
        "order_time": o.created_at.isoformat(),
        "created_at": o.created_at.isoformat(),
        "qrcode": o.qrcode,
        "guide_info": o.guide_info or {},
        "refund_reject_reason": o.refund_reject_reason,
        "refund_records": [
            {
                "id": r.id,
                "refund_no": r.refund_no,
                "amount": float(r.amount),
                "reason": r.reason,
                "type": r.type,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in refund_records
        ]
    }
    
    return success(order)

def generate_order_no() -> str:
    """生成订单号"""
    now = datetime.now()
    return f"QD{now.strftime('%Y%m%d%H%M%S')}{now.microsecond // 1000:03d}"


# ==================== 订单核销 API ====================

@app.post("/api/v1/orders/{order_id}/verify")
async def verify_order(
    order_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    订单核销（扫码核销）
    
    Request Body:
        - verify_code: 核销码（与订单号匹配）
    """
    from app.models.order import Order
    
    verify_code = data.get("verify_code", "")
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    # 校验订单状态（只能核销待出行订单）
    if order.status != 20:
        return {"code": 400, "message": f"订单状态不允许核销，当前状态: {STATUS_MAP.get(order.status, order.status)}", "data": None}
    
    # 校验核销码
    if not verify_order_code(order.order_no, verify_code):
        logger.warning(f"Invalid verify code for order {order_id}: {verify_code}")
        return {"code": 400, "message": "核销码错误", "data": None}
    
    # 核销：更新订单状态为已完成（待评价）
    order.status = 60
    order.updated_at = datetime.now()
    await db.commit()
    
    logger.info(f"Order verified: {order.order_no}, id={order_id}")
    
    return success({
        "order_id": order_id,
        "order_no": order.order_no,
        "status": 60,
        "status_name": "待评价",
        "verified_at": datetime.now().isoformat()
    }, message="核销成功")


@app.post("/api/v1/admin/orders/{order_id}/verify")
async def admin_verify_order(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    管理后台直接核销订单（无需核销码，用于线下特殊情况）
    """
    from app.models.order import Order
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    if order.status != 20:
        return {"code": 400, "message": f"订单状态不允许核销，当前: {STATUS_MAP.get(order.status, order.status)}", "data": None}
    
    order.status = 60
    order.updated_at = datetime.now()
    await db.commit()
    
    logger.info(f"Order admin verified: {order.order_no}, id={order_id}")
    
    return success({
        "order_id": order_id,
        "order_no": order.order_no,
        "status": 60
    }, message="核销成功")


# 库存相关函数已移除（不限制名额）


@app.post("/api/v1/orders")
async def create_order(
    data: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建订单（校验库存并扣减）"""
    from app.models.order import Order
    from app.models.coupon import UserCoupon
    
    user_id = current_user.get("user_id", 1)
    
    # 判断用户是否会员
    member_result = await db.execute(
        text("""
            SELECT 1 FROM user_memberships 
            WHERE user_id = :user_id AND status = 1 AND end_date >= CURDATE()
            LIMIT 1
        """),
        {"user_id": user_id}
    )
    is_member = member_result.scalar() is not None
    
    # 会员专享免费路线：非会员按付费处理
    route_is_member_only = getattr(data, 'is_member_only', 0) or 0
    route_is_insurance_required = getattr(data, 'is_insurance_required', 1) or 1
    order_is_free = data.is_free
    actual_route_price = data.route_price
    actual_insurance_price = data.insurance_price
    
    if order_is_free == 1 and route_is_member_only == 1 and not is_member:
        # 非会员购买会员专享免费路线 = 按原价
        order_is_free = 0
    
    # 保险配置：不需要保险则保险费为0
    if route_is_insurance_required == 0:
        actual_insurance_price = 0
    
    # 计算金额
    total_amount = (actual_route_price + 
                   actual_insurance_price + 
                   data.equipment_price +
                   data.addon_amount)
    
    # 处理优惠券
    coupon_id = data.coupon_id
    coupon_name = None
    discount_amount = data.discount_amount or 0
    
    if coupon_id:
        coupon_result = await db.execute(
            select(UserCoupon).where(
                UserCoupon.id == coupon_id,
                UserCoupon.user_id == user_id,
                UserCoupon.status == 1
            )
        )
        coupon = coupon_result.scalar_one_or_none()
        
        if coupon:
            # 礼品券不能用于订单抵扣
            if coupon.type == 4:
                coupon_id = None
                discount_amount = 0
            else:
                # 校验有效期
                now = datetime.now()
                if coupon.valid_start_time <= now <= coupon.valid_end_time:
                    # 查询模板最新配置
                    template = None
                    if coupon.template_id:
                        from app.models.coupon import CouponTemplate
                        template_result = await db.execute(
                            select(CouponTemplate).where(CouponTemplate.id == coupon.template_id)
                        )
                        template = template_result.scalar_one_or_none()
                    
                    min_amount = float(template.min_amount) if template else float(coupon.min_amount)
                    max_discount = float(template.max_discount) if template else float(coupon.max_discount or 0)
                    applicable_type = template.applicable_type if template else coupon.applicable_type
                    applicable_ids = template.applicable_ids if template else coupon.applicable_ids
                    
                    # 校验是否不可叠加（is_exclusive=1时，不能与其他优惠同时使用）
                    # 当前系统只有优惠券一种优惠方式，此校验主要为将来扩展预留
                    is_exclusive = template.is_exclusive if template else (coupon.is_exclusive or 0)
                    if is_exclusive == 1:
                        # 当前只有优惠券一种优惠，所以此校验总是通过
                        # 将来如果有会员折扣、活动折扣等，需要在这里校验是否同时使用了其他优惠
                        pass
                    
                    # 所有优惠券只减免路线价格，不减保险/装备/选配
                    discount_base = actual_route_price
                    
                    # 校验金额门槛
                    if min_amount <= discount_base:
                        # 校验适用范围
                        applicable = True
                        if applicable_type == 2 and applicable_ids:
                            # 指定路线
                            if data.route_id not in applicable_ids:
                                applicable = False
                        elif applicable_type == 3 and applicable_ids:
                            # 指定路线类型
                            route_result = await db.execute(
                                select(Route.route_type).where(Route.id == data.route_id)
                            )
                            route_type = route_result.scalar()
                            if route_type not in applicable_ids:
                                applicable = False
                        elif applicable_type == 4 and applicable_ids:
                            # 指定用户
                            if user_id not in applicable_ids:
                                applicable = False
                        
                        if applicable:
                            discount_amount = calculate_discount(
                                coupon.type, float(coupon.value), discount_base, max_discount
                            )
                            coupon_name = coupon.name
                        else:
                            coupon_id = None
                            discount_amount = 0
                    else:
                        coupon_id = None
                        discount_amount = 0
                else:
                    coupon_id = None
                    discount_amount = 0
        else:
            coupon_id = None
            discount_amount = 0
    
    # 免费路线（金额为0）直接标记为已支付
    if total_amount <= 0:
        pay_amount = 0
        order_status = 20  # 待出行（已支付）
    else:
        pay_amount = max(0.01, round(total_amount - discount_amount, 2))
        order_status = 10  # 待支付
    
    # 生成订单号
    order_no = generate_order_no()
    
    # 解析日期
    try:
        travel_date = date.fromisoformat(data.travel_date)
    except Exception:
        raise BadRequestException("出行日期格式错误")
    
    # 计算占座数（免费订单按1个占位，大巴按人+宠，自驾不占座）
    seat_count = 1 if order_is_free else (data.participant_count + data.pet_count if data.travel_type == 'bus' else 0)
    
    # 校验并扣减库存
    if seat_count > 0:
        stock_result = await db.execute(
            text("""
                UPDATE route_schedules 
                SET stock = stock - :seat_count, sold = sold + :seat_count 
                WHERE id = :schedule_id AND stock >= :seat_count
            """),
            {"schedule_id": data.schedule_id, "seat_count": seat_count}
        )
        if stock_result.rowcount == 0:
            raise BadRequestException("该排期库存不足或已售罄，请选择其他日期")
    
    # 查询路线封面图
    route_cover = None
    if data.route_id:
        route_cover_result = await db.execute(
            text("SELECT cover_image FROM routes WHERE id = :route_id"),
            {"route_id": data.route_id}
        )
        route_cover_row = route_cover_result.mappings().first()
        route_cover = route_cover_row["cover_image"] if route_cover_row else None
    
    # 查询用户手机号和真实姓名（用于设置联系人为账号本人）
    user_phone = None
    user_real_name = None
    user_id_card = None
    if user_id:
        user_res = await db.execute(
            text("SELECT phone, real_name, id_card FROM users WHERE id = :user_id LIMIT 1"),
            {"user_id": user_id}
        )
        user_row = user_res.fetchone()
        if user_row:
            user_phone = user_row[0]
            user_real_name = user_row[1]
            user_id_card = user_row[2]
    
    # 构建联系人信息：固定为下单账号本人
    if user_id and user_phone:
        contact_info = {
            'name': user_real_name or '未知',
            'phone': user_phone,
            'id_card': user_id_card or ''
        }
    else:
        # 未获取到用户信息时回退到前端传入的联系人
        contact_info = data.contact or {}
    logger.info(f"[DEBUG] user_id={user_id}, contact_info={contact_info}")
    
    # 构建完整的出行人列表：前端传入的 participants 即为实际出行人
    all_participants = data.participants or []
    
    # 创建订单
    order = Order(
        order_no=order_no,
        user_id=user_id,
        schedule_id=data.schedule_id,
        route_id=data.route_id,
        is_free=order_is_free,
        route_name=data.route_name,
        route_cover=route_cover,
        travel_date=travel_date,
        participant_count=data.participant_count,
        pet_count=data.pet_count,
        seat_count=seat_count,
        participants=all_participants,
        pets=data.pets,
        contact=contact_info,
        route_price=actual_route_price,
        insurance_price=actual_insurance_price,
        equipment_price=data.equipment_price,
        addon_amount=data.addon_amount,
        addons=data.addons,
        travel_type=data.travel_type,
        package_type=data.package_type,
        total_amount=total_amount,
        discount_amount=discount_amount,
        coupon_id=coupon_id,
        coupon_name=coupon_name,
        pay_amount=pay_amount,
        status=order_status,
        qrcode=generate_verify_code(order_no)
    )
    
    db.add(order)
    await db.flush()
    
    # 免费订单直接核销优惠券（绕过支付回调）
    if total_amount <= 0 and coupon_id:
        await db.execute(
            text("UPDATE user_coupons SET status = 2, used_at = NOW(), used_order_id = :order_id WHERE id = :coupon_id"),
            {"coupon_id": coupon_id, "order_id": order.id}
        )
        logger.info(f"Free order coupon written off: coupon_id={coupon_id}, order_id={order.id}")
    
    await db.commit()
    
    # 设置支付超时自动取消（15分钟）
    # 实际项目中使用 Redis + 定时任务或延迟队列
    try:
        await redis_client.setex(
            f"order:expire:{order_no}",
            900,  # 15分钟
            json.dumps({
                "order_id": order.id,
                "schedule_id": data.schedule_id,
                "seat_count": seat_count
            })
        )
    except:
        pass
    
    logger.info(f"Order created: {order_no}, id: {order.id}, user: {user_id}, amount: {pay_amount}")
    
    return success({
        "order_no": order_no,
        "order_id": order.id,
        "pay_amount": float(pay_amount),
        "expire_time": 900  # 15分钟支付有效期
    })

@app.post("/api/v1/orders/{order_id}/pay")
async def pay_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """发起微信支付"""
    from app.models.order import Order
    import httpx
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    logger.info(f"Pay order check: order_id={order_id}, status={order.status}, expected=10")
    if order.status != 10:  # 只能支付待支付订单
        raise BadRequestException(f"订单状态不允许支付，当前状态:{order.status}")
    
    # 直接从JWT中获取openid
    openid = current_user.get("openid", "")
    
    if not openid:
        raise BadRequestException("用户未绑定微信，无法发起支付")
    
    # 调用 pay-service 创建支付订单
    pay_service_url = os.getenv("PAY_SERVICE_URL", "http://localhost:8006")
    pay_payload = {
        "order_no": order.order_no,
        "amount": float(order.pay_amount),
        "description": f"尾巴旅行-{order.route_name or '订单支付'}",
        "method": "wechat_jsapi",
        "openid": openid,
        "out_trade_no": order.order_no  # 使用业务订单号作为微信商户单号，确保支付和退款一致
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            pay_response = await client.post(
                f"{pay_service_url}/api/v1/pay/create",
                json=pay_payload,
                headers={"Authorization": f"Bearer {current_user.get('token', '')}"}
            )
            pay_result = pay_response.json()
    except Exception as e:
        logger.error(f"Call pay-service failed: {e}")
        raise HTTPException(status_code=500, detail=f"支付服务调用失败: {str(e)}")
    
    if pay_result.get("code") != 200:
        logger.error(f"Pay-service error: {pay_result}")
        raise HTTPException(status_code=500, detail=pay_result.get("message", "支付下单失败"))
    
    pay_data = pay_result.get("data", {})
    logger.info(f"Pay order created: {order.order_no}, pay_order_no={pay_data.get('pay_order_no')}, mock={pay_data.get('mock')}")
    
    # Mock 模式下直接更新订单为已支付状态（开发环境模拟支付）
    if pay_data.get("mock"):
        order.status = 20
        order.pay_time = datetime.now()
        order.pay_channel = "mock"
        order.pay_trade_no = f"MOCK{datetime.now().strftime('%Y%m%d%H%M%S')}"
        await db.commit()
        # 核销优惠券
        if order.coupon_id:
            await db.execute(
                text("UPDATE user_coupons SET status = 2, used_at = NOW(), used_order_id = :order_id WHERE id = :coupon_id"),
                {"coupon_id": order.coupon_id, "order_id": order.id}
            )
            await db.commit()
            logger.info(f"Mock pay coupon written off: coupon_id={order.coupon_id}, order_id={order.id}")
        logger.info(f"Mock pay success, order updated: {order.order_no}")
    
    return success({
        "pay_order_no": pay_data.get("pay_order_no"),
        "pay_params": pay_data.get("pay_params"),
        "mock": pay_data.get("mock", False)
    })

@app.post("/api/v1/orders/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """取消订单（更新数据库，恢复库存）"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        return success({"message": "订单不存在"})
    
    if order.status not in [10, 20]:  # 只能取消待支付或待出行订单
        return success({"message": "订单状态不允许取消"})
    
    # 根据当前状态决定新状态和退款信息
    new_status = 40 if (order.status == 20 and float(order.pay_amount or 0) > 0) else 30
    refund_amount = float(order.pay_amount) if new_status == 40 else None
    refund_reason = "用户取消订单" if new_status == 40 else None
    
    # 原子更新订单状态（防止并发重复取消）
    status_result = await db.execute(
        text("""
            UPDATE orders 
            SET status = :new_status, refund_amount = :refund_amount, refund_reason = :refund_reason, updated_at = NOW() 
            WHERE id = :order_id AND user_id = :user_id AND status IN (10, 20)
        """),
        {
            "order_id": order_id,
            "user_id": user_id,
            "new_status": new_status,
            "refund_amount": refund_amount,
            "refund_reason": refund_reason
        }
    )
    
    if status_result.rowcount == 0:
        return success({"message": "订单状态已变更，请刷新后重试"})
    
    # 状态更新成功，恢复库存（根据订单实际占座数恢复；自驾不占座则不恢复）
    restore_count = getattr(order, 'seat_count', None) or 0
    if order.schedule_id and restore_count > 0:
        await db.execute(
            text("""
                UPDATE route_schedules 
                SET stock = stock + :restore_count, sold = sold - :restore_count 
                WHERE id = :schedule_id AND sold >= :restore_count
            """),
            {"schedule_id": order.schedule_id, "restore_count": restore_count}
        )
    
    # 恢复优惠券：待支付/待出行（含免费）订单直接恢复；已支付且需退款订单等退款完成后再恢复
    if order.coupon_id and order.status in [10, 20]:
        await db.execute(
            text("UPDATE user_coupons SET status = 1, used_at = NULL, used_order_id = NULL WHERE id = :coupon_id"),
            {"coupon_id": order.coupon_id}
        )
        logger.info(f"Coupon restored (unpaid order): coupon_id={order.coupon_id}, order_id={order_id}")
    
    if new_status == 40:
        logger.info(f"Order cancelled with refund: {order_id}, amount={order.pay_amount}")
    else:
        logger.info(f"Order cancelled: {order_id}, stock restored for schedule {order.schedule_id}")
    
    await db.commit()
    
    return success({"message": "取消成功"})

@app.post("/api/v1/orders/{order_id}/refund")
async def refund_order(
    order_id: int,
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """用户申请退款"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    reason = data.get("reason", "")
    
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    # 只能对待出行、部分退款或退款驳回的订单申请退款
    if order.status not in [20, 45, 55]:
        return {"code": 400, "message": "当前订单状态不允许申请退款", "data": None}
    
    # 更新订单状态为退款中，清空之前的拒绝原因
    order.status = 40
    order.refund_amount = float(order.pay_amount)
    order.refund_reason = reason
    order.refund_reject_reason = None
    order.updated_at = datetime.now()
    
    await db.commit()
    
    logger.info(f"User refund request: order={order_id}, amount={order.pay_amount}, reason={reason}")
    
    return success({
        "order_id": order_id,
        "refund_amount": float(order.pay_amount),
        "status": 40,
        "status_name": "退款中",
        "message": "退款申请已提交"
    })

@app.get("/api/v1/orders/stats")
async def get_order_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取订单统计（从数据库）"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    
    # 查询各状态数量
    stats = {
        "unpaid": 0,
        "untravel": 0,
        "unevaluate": 0,
        "refund": 0,
        "total": 0
    }
    
    result = await db.execute(
        select(Order.status, func.count()).where(Order.user_id == user_id).group_by(Order.status)
    )
    
    for status, count in result.all():
        if status == 10:
            stats["unpaid"] = count
        elif status == 20:
            stats["untravel"] = count
        elif status == 60:
            stats["unevaluate"] = count
        elif status in [40, 45, 50]:
            stats["refund"] += count
        stats["total"] += count
    
    return success(stats)

@app.post("/api/v1/orders/{order_id}/evaluate")
async def evaluate_order(
    order_id: int,
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """订单评价（保存到数据库）"""
    from app.models.order import Order, OrderEvaluation
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        return success({"message": "订单不存在"})
    
    rating = data.get("rating", 5)
    content = data.get("content", "")
    tags = data.get("tags", [])
    images = data.get("images", [])
    is_anonymous = data.get("is_anonymous", False)
    
    # 创建评价
    evaluation = OrderEvaluation(
        order_id=order_id,
        user_id=user_id,
        route_id=order.route_id,
        rating=rating,
        content=content,
        tags=tags,
        images=images,
        is_anonymous=1 if is_anonymous else 0
    )
    
    db.add(evaluation)
    
    # 更新订单状态为已评价
    order.status = 70
    
    await db.flush()
    await db.commit()
    
    logger.info(f"Order evaluated: order={order_id}, user={user_id}, rating={rating}")
    
    return success({
        "evaluate_id": evaluation.id,
        "order_id": order_id,
        "rating": rating,
        "content": content,
        "tags": tags,
        "images": images,
        "is_anonymous": is_anonymous,
        "created_at": evaluation.created_at.isoformat(),
        "message": "评价成功"
    })

@app.post("/api/v1/orders/pay/callback")
async def pay_callback(data: dict, db: AsyncSession = Depends(get_db)):
    """
    支付回调 - 更新订单支付状态
    
    由 pay-service 调用，通知订单支付结果
    """
    logger.info(f"Pay callback received: {data}")
    
    from app.models.order import Order
    
    # 获取订单标识
    order_no = data.get("order_no") or data.get("out_trade_no")
    transaction_id = data.get("transaction_id", "")
    pay_channel = data.get("pay_channel", "wechat")
    
    if not order_no:
        logger.error("Pay callback missing order_no")
        return {"code": "FAIL", "message": "Missing order_no"}
    
    try:
        # 先查询普通订单
        result = await db.execute(select(Order).where(Order.order_no == order_no))
        order = result.scalar_one_or_none()
        
        if order:
            # 普通订单处理 —— 处理竞态：订单可能已被自动取消但用户已付款
            if order.status == 30:
                # 订单被自动取消但用户已付款，恢复为已支付
                logger.warning(f"Order was auto-cancelled but paid, restoring: {order_no}")
                order.status = 20
                order.pay_time = datetime.now()
                order.pay_channel = pay_channel
                order.pay_trade_no = transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
            elif order.status != 10:
                logger.warning(f"Pay callback order status invalid: {order_no}, status={order.status}")
                return {"code": "SUCCESS", "message": "Order already processed"}
            else:
                order.status = 20
                order.pay_time = datetime.now()
                order.pay_channel = pay_channel
                order.pay_trade_no = transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # 核销优惠券
            if order.coupon_id:
                await db.execute(
                    text("UPDATE user_coupons SET status = 2, used_at = NOW(), used_order_id = :order_id WHERE id = :coupon_id"),
                    {"coupon_id": order.coupon_id, "order_id": order.id}
                )
                logger.info(f"Coupon written off: coupon_id={order.coupon_id}, order_id={order.id}")
            
            await db.commit()
            logger.info(f"Order paid via callback: {order_no}, id={order.id}")
            return {"code": "SUCCESS", "message": "OK"}
        
        # 普通订单不存在，尝试查找会员订单
        member_result = await db.execute(
            text("SELECT * FROM member_orders WHERE order_no = :order_no"),
            {"order_no": order_no}
        )
        member_order = member_result.mappings().one_or_none()
        
        if member_order:
            # 会员订单处理 —— 使用原子UPDATE确保幂等性
            update_result = await db.execute(
                text("UPDATE member_orders SET status = 20, pay_time = NOW(), pay_channel = :pay_channel, pay_trade_no = :trade_no, updated_at = NOW() WHERE id = :order_id AND status = 10"),
                {"order_id": member_order["id"], "pay_channel": pay_channel, "trade_no": transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"}
            )
            
            if update_result.rowcount == 0:
                # 订单可能已被处理过，或已被取消/退款
                if member_order["status"] == 20:
                    logger.info(f"Member order already paid, skipping: {order_no}")
                    return {"code": "SUCCESS", "message": "Member order already processed"}
                elif member_order["status"] == 30:
                    # 订单被自动取消了但用户已付款，恢复为已支付
                    await db.execute(
                        text("UPDATE member_orders SET status = 20, pay_time = NOW(), pay_channel = :pay_channel, pay_trade_no = :trade_no, updated_at = NOW() WHERE id = :order_id"),
                        {"order_id": member_order["id"], "pay_channel": pay_channel, "trade_no": transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"}
                    )
                    logger.warning(f"Member order was cancelled but paid, restored: {order_no}")
                else:
                    logger.info(f"Member order status not payable: {order_no}, status={member_order['status']}")
                    return {"code": "SUCCESS", "message": "Member order status not payable"}
            
            # Process membership
            plan_result = await db.execute(
                text("SELECT * FROM member_plans WHERE id = :plan_id"),
                {"plan_id": member_order["plan_id"]}
            )
            plan = plan_result.mappings().one_or_none()
            user_id = member_order["user_id"]
            
            membership_result = await db.execute(
                text("SELECT * FROM user_memberships WHERE user_id = :user_id AND status = 1"),
                {"user_id": user_id}
            )
            existing = membership_result.mappings().one_or_none()
            
            now = datetime.now()
            if existing:
                new_end = existing["end_date"] + timedelta(days=plan["duration_days"] if plan else 30)
                await db.execute(
                    text("UPDATE user_memberships SET end_date = :end_date, order_id = :order_id, pay_amount = :pay_amount, benefit_snapshot = :benefit_snapshot, updated_at = NOW() WHERE id = :membership_id"),
                    {
                        "end_date": new_end,
                        "order_id": member_order["id"],
                        "pay_amount": member_order["pay_amount"],
                        "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                        "membership_id": existing["id"],
                    }
                )
            else:
                await db.execute(
                    text("INSERT INTO user_memberships (user_id, plan_id, status, start_date, end_date, order_id, pay_amount, benefit_snapshot, created_at, updated_at) VALUES (:user_id, :plan_id, 1, :start_date, :end_date, :order_id, :pay_amount, :benefit_snapshot, NOW(), NOW())"),
                    {
                        "user_id": user_id,
                        "plan_id": member_order["plan_id"],
                        "start_date": date.today(),
                        "end_date": date.today() + timedelta(days=plan["duration_days"] if plan else 30),
                        "order_id": member_order["id"],
                        "pay_amount": member_order["pay_amount"],
                        "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                    }
                )
            
            # Issue coupons
            if plan and plan["coupon_package"]:
                coupon_package = plan["coupon_package"]
                if isinstance(coupon_package, str):
                    coupon_package = json.loads(coupon_package)
                
                # Support both list format [1,2,3] and object format {"templates": [...]}
                if isinstance(coupon_package, list):
                    template_ids = coupon_package
                    templates_config = [{"template_id": tid, "count": 1, "valid_days": 30} for tid in template_ids]
                elif isinstance(coupon_package, dict):
                    templates_config = coupon_package.get("templates", [])
                else:
                    templates_config = []
                
                for item in templates_config:
                    template_result = await db.execute(
                        text("SELECT * FROM coupon_templates WHERE id = :template_id"),
                        {"template_id": item["template_id"]}
                    )
                    template = template_result.mappings().one_or_none()
                    if not template:
                        continue
                    valid_days = item.get("valid_days", 30)
                    for _ in range(item.get("count", 1)):
                        await db.execute(
                            text("INSERT INTO user_coupons (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount, applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, description, created_at) VALUES (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount, :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, :description, NOW())"),
                            {
                                "user_id": user_id,
                                "template_id": template["id"],
                                "coupon_no": generate_coupon_no(),
                                "name": template["name"],
                                "type": template["type"],
                                "value": template["value"],
                                "min_amount": template["min_amount"],
                                "max_discount": template["max_discount"],
                                "applicable_type": template["applicable_type"],
                                "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                                "valid_start": now,
                                "valid_end": now + timedelta(days=valid_days),
                                "source_id": member_order["id"],
                                "description": template.get("description"),
                            }
                        )
            
            await db.commit()
            logger.info(f"Member order paid via callback: {order_no}, id={member_order['id']}")
            return {"code": "SUCCESS", "message": "OK"}
        
        logger.error(f"Pay callback order not found: {order_no}")
        return {"code": "FAIL", "message": "Order not found"}
        
    except Exception as e:
        logger.error(f"Pay callback processing error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": "FAIL", "message": "Internal error"}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/orders")
async def admin_get_orders(
    status: Optional[int] = None,
    is_free: Optional[int] = None,
    order_no: Optional[str] = None,
    keyword: Optional[str] = None,
    user_id: Optional[int] = None,
    route_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ids: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取订单列表"""
    try:
        from app.models.order import Order
        from sqlalchemy import and_
        
        query = select(Order)
        
        # 如果传入 ids，优先按 ids 查询（导出场景）
        if ids:
            try:
                id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
                if id_list:
                    query = query.where(Order.id.in_(id_list))
            except ValueError:
                return {"code": 400, "message": "ids 参数格式错误", "data": None}
        else:
            # 筛选条件
            if status is not None:
                query = query.where(Order.status == status)
            if is_free is not None:
                query = query.where(Order.is_free == is_free)
            if order_no:
                query = query.where(Order.order_no.contains(order_no))
            if keyword:
                query = query.where(Order.route_name.contains(keyword))
            if user_id:
                query = query.where(Order.user_id == user_id)
            if route_id:
                query = query.where(Order.route_id == route_id)
            if start_date:
                query = query.where(Order.created_at >= start_date)
            if end_date:
                query = query.where(Order.created_at <= end_date)
        
        query = query.order_by(Order.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        orders_db = result.scalars().all()
        
        # 批量查询用户信息（用于联系人显示）和会员状态（避免N+1）
        user_ids = [o.user_id for o in orders_db if o.user_id]
        user_map = {}
        member_map = {}
        if user_ids:
            from sqlalchemy import text
            user_res = await db.execute(
                text("""
                    SELECT id, nickname, real_name, phone, id_card FROM users 
                    WHERE id IN :user_ids
                """),
                {"user_ids": tuple(user_ids)}
            )
            for row in user_res.fetchall():
                user_map[row[0]] = {
                    "name": row[2] or row[1] or "未知",
                    "phone": row[3] or "",
                    "id_card": row[4] or ""
                }
            # 批量查询会员状态
            member_res = await db.execute(
                text("""
                    SELECT user_id FROM user_memberships 
                    WHERE user_id IN :user_ids AND status = 1
                """),
                {"user_ids": tuple(user_ids)}
            )
            for row in member_res.fetchall():
                member_map[row[0]] = True
        
        orders = []
        for o in orders_db:
            contact = user_map.get(o.user_id, {"name": "", "phone": "", "id_card": ""}) if o.user_id else (o.contact or {})
            
            # 补全宠物档案信息（头像、年龄、疫苗本等）
            order_pets = o.pets or []
            enriched_pets = []
            if o.user_id and order_pets:
                pet_result = await db.execute(
                    text("""
                        SELECT id, user_id, name, breed, age_str, gender, weight, avatar, vaccine_book
                        FROM pet_profiles
                        WHERE user_id = :user_id
                    """),
                    {"user_id": o.user_id}
                )
                pet_map = {}
                for row in pet_result.fetchall():
                    key = (row[1], row[2])  # (user_id, name)
                    pet_map[key] = {
                        "id": row[0],
                        "user_id": row[1],
                        "name": row[2],
                        "breed": row[3],
                        "age_str": row[4],
                        "gender": row[5],
                        "weight": float(row[6]) if row[6] is not None else None,
                        "avatar": row[7],
                        "vaccine_book": row[8],
                    }
                
                logger.info(f"[admin orders] pet_map keys: {list(pet_map.keys())}, pet_map ids: {[p.get('id') for p in pet_map.values()]}")
                
                for p in order_pets:
                    # 优先按 id 匹配，再按名字匹配
                    pet_profile = None
                    pet_id = p.get("id")
                    logger.info(f"[admin orders] matching pet_id: {pet_id}, type: {type(pet_id)}")
                    if pet_id:
                        pet_id_str = str(pet_id)
                        for profile in pet_map.values():
                            profile_id = profile.get("id")
                            logger.info(f"[admin orders] comparing pet_id_str: {pet_id_str} with profile_id: {profile_id}, type: {type(profile_id)}")
                            if str(profile_id) == pet_id_str:
                                pet_profile = profile
                                logger.info(f"[admin orders] matched! pet_profile: {pet_profile}")
                                break
                    if not pet_profile:
                        pet_key = (o.user_id, p.get("name"))
                        pet_profile = pet_map.get(pet_key) or {}
                        logger.info(f"[admin orders] fallback by name, pet_key: {pet_key}, found: {bool(pet_profile)}")
                    enriched_pets.append({
                        "id": pet_profile.get("id") or p.get("id") or "",
                        "name": p.get("name") or pet_profile.get("name") or "",
                        "breed": p.get("breed") or pet_profile.get("breed") or "",
                        "gender": p.get("gender") if p.get("gender") is not None else pet_profile.get("gender"),
                        "age_str": pet_profile.get("age_str") or "",
                        "weight": p.get("weight") if p.get("weight") is not None else pet_profile.get("weight"),
                        "avatar": pet_profile.get("avatar") or "",
                        "vaccine_book": pet_profile.get("vaccine_book") or "",
                    })
            else:
                enriched_pets = order_pets
            
            orders.append({
                "id": o.id,
                "order_no": o.order_no,
                "user_id": o.user_id,
                "route_id": o.route_id,
                "is_free": o.is_free,
                "is_member": member_map.get(o.user_id, False),
                "route_name": o.route_name,
                "route_cover": o.route_cover,
                "travel_date": o.travel_date.isoformat() if o.travel_date else None,
                "participant_count": o.participant_count,
                "pet_count": o.pet_count,
                "participants": o.participants or [],
                "pets": enriched_pets,
                "contact": contact,
                "route_price": float(o.route_price) if o.route_price else 0,
                "insurance_price": float(o.insurance_price) if o.insurance_price else 0,
                "pay_amount": float(o.pay_amount) if o.pay_amount else 0,
                "status": o.status,
                "status_name": STATUS_MAP.get(o.status, "未知"),
                
                "pay_time": o.pay_time.isoformat() if o.pay_time else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "orders": orders
        })
    except Exception as e:
        logger.error(f"Error getting admin orders: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/orders/insurance-export")
async def admin_export_orders_for_insurance(
    status: Optional[int] = None,
    is_free: Optional[int] = None,
    keyword: Optional[str] = None,
    order_no: Optional[str] = None,
    travel_date: Optional[str] = None,
    ids: Optional[str] = None,
    page_size: int = 5000,
    db: AsyncSession = Depends(get_db)
):
    """
    保险专用订单导出
    按人头展开，每行包含：订单信息 + 个人完整信息 + 该订单所有宠物信息
    """
    try:
        from app.models.order import Order
        from sqlalchemy import text

        # 1. 查询符合条件的订单（默认导出所有状态，可通过 status 参数筛选）
        query = select(Order)
        if ids:
            try:
                id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
                if id_list:
                    query = query.where(Order.id.in_(id_list))
            except ValueError:
                return {"code": 400, "message": "ids 参数格式错误", "data": None}
        if status:
            query = query.where(Order.status == status)
        if is_free is not None:
            query = query.where(Order.is_free == is_free)
        if keyword:
            query = query.where(or_(
                Order.route_name.contains(keyword),
                Order.order_no.contains(keyword)
            ))
        if order_no:
            query = query.where(Order.order_no.contains(order_no))
        if travel_date:
            query = query.where(Order.travel_date == travel_date)

        query = query.order_by(Order.travel_date.asc(), Order.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        orders_db = result.scalars().all()

        if not orders_db:
            return success([])

        user_ids = [o.user_id for o in orders_db if o.user_id]

        # 2. 批量查询出行人表补全身份证、生日、性别、紧急联系人等信息
        traveler_map: dict = {}
        if user_ids:
            traveler_result = await db.execute(
                text("""
                    SELECT id, user_id, name, phone, id_card, gender, birthday,
                           emergency_name, emergency_phone
                    FROM travelers
                    WHERE user_id IN :user_ids AND status = 1
                """),
                {"user_ids": tuple(user_ids)}
            )
            for row in traveler_result.fetchall():
                key = (row[1], row[2])  # (user_id, name)
                traveler_map[key] = {
                    "id": row[0],
                    "user_id": row[1],
                    "name": row[2],
                    "phone": row[3],
                    "id_card": row[4],
                    "gender": row[5],
                    "birthday": row[6].isoformat() if row[6] else None,
                    "emergency_name": row[7],
                    "emergency_phone": row[8],
                }

        # 3. 批量查询宠物档案表补全宠物完整信息
        pet_map: dict = {}
        if user_ids:
            pet_result = await db.execute(
                text("""
                    SELECT id, user_id, name, breed, breed_type, birth_date, age_str,
                           gender, weight, vaccine_date, vaccine_book, health_notes,
                           avatar, tags, is_default, status, created_at, updated_at
                    FROM pet_profiles
                    WHERE user_id IN :user_ids
                """),
                {"user_ids": tuple(user_ids)}
            )
            for row in pet_result.fetchall():
                key = (row[1], row[2])  # (user_id, name)
                pet_map[key] = {
                    "id": row[0],
                    "user_id": row[1],
                    "name": row[2],
                    "breed": row[3],
                    "breed_type": row[4],
                    "birth_date": row[5].isoformat() if row[5] else None,
                    "age_str": row[6],
                    "gender": row[7],
                    "weight": float(row[8]) if row[8] is not None else None,
                    "vaccine_date": row[9].isoformat() if row[9] else None,
                    "vaccine_book": row[10],
                    "health_notes": row[11],
                    "avatar": row[12],
                    "tags": parse_pet_tags(row[13]),
                    "is_default": row[14],
                    "status": row[15],
                    "created_at": row[16].isoformat() if row[16] else None,
                    "updated_at": row[17].isoformat() if row[17] else None,
                }

        # 4. 组装保险导出数据
        rows = []
        for o in orders_db:
            contact = o.contact or {}
            participants = o.participants or []
            pets_in_order = o.pets or []

            # 补全联系人信息
            contact_key = (o.user_id, contact.get("name"))
            contact_traveler = traveler_map.get(contact_key) or {}
            contact_full = {
                "name": contact.get("name") or contact_traveler.get("name") or "",
                "phone": contact.get("phone") or contact_traveler.get("phone") or "",
                "id_card": contact.get("id_card") or contact_traveler.get("id_card") or "",
                "gender": contact_traveler.get("gender") or 0,
                "birthday": contact_traveler.get("birthday") or "",
                "emergency_name": contact_traveler.get("emergency_name") or "",
                "emergency_phone": contact_traveler.get("emergency_phone") or "",
            }

            # 构建该订单下所有宠物的完整信息
            order_pets_full = []
            for p in pets_in_order:
                pet_key = (o.user_id, p.get("name"))
                pet_profile = pet_map.get(pet_key) or {}
                order_pets_full.append({
                    "id": pet_profile.get("id") or "",
                    "name": p.get("name") or pet_profile.get("name") or "",
                    "breed": p.get("breed") or pet_profile.get("breed") or "",
                    "breed_type": pet_profile.get("breed_type") or "",
                    "gender": p.get("gender") if p.get("gender") is not None else pet_profile.get("gender"),
                    "birth_date": pet_profile.get("birth_date") or "",
                    "age_str": pet_profile.get("age_str") or "",
                    "weight": p.get("weight") if p.get("weight") is not None else (float(pet_profile.get("weight")) if pet_profile.get("weight") is not None else None),
                    "vaccine_date": pet_profile.get("vaccine_date") or "",
                    "vaccine_book": pet_profile.get("vaccine_book") or "",
                    "health_notes": pet_profile.get("health_notes") or "",
                    "avatar": pet_profile.get("avatar") or "",
                    "tags": pet_profile.get("tags") or [],
                    "is_default": pet_profile.get("is_default") or 0,
                    "status": pet_profile.get("status") or 1,
                    "created_at": pet_profile.get("created_at") or "",
                    "updated_at": pet_profile.get("updated_at") or "",
                })

            # 要导出的人员列表：联系人 + 所有出行人
            persons = [{"role": "联系人", **contact_full}]
            for idx, participant in enumerate(participants):
                part_key = (o.user_id, participant.get("name"))
                part_traveler = traveler_map.get(part_key) or {}
                persons.append({
                    "role": f"出行人{idx + 1}",
                    "name": participant.get("name") or part_traveler.get("name") or "",
                    "phone": participant.get("phone") or part_traveler.get("phone") or "",
                    "id_card": participant.get("id_card") or part_traveler.get("id_card") or "",
                    "gender": participant.get("gender") if participant.get("gender") is not None else part_traveler.get("gender"),
                    "birthday": part_traveler.get("birthday") or "",
                    "emergency_name": part_traveler.get("emergency_name") or "",
                    "emergency_phone": part_traveler.get("emergency_phone") or "",
                })

            # 每人生成一行
            for person in persons:
                row = {
                    "order_no": o.order_no or "",
                    "user_id": o.user_id,
                    "route_name": o.route_name or "",
                    "travel_date": o.travel_date.isoformat() if o.travel_date else "",
                    "status": o.status,
                    "status_name": STATUS_MAP.get(o.status, "未知"),
                    "pay_amount": float(o.pay_amount) if o.pay_amount is not None else 0,
                    "created_at": o.created_at.isoformat() if o.created_at else "",
                    "role": person["role"],
                    "person_name": person["name"],
                    "person_phone": person["phone"],
                    "person_id_card": person["id_card"],
                    "person_gender": {0: "未知", 1: "男", 2: "女"}.get(person["gender"], "未知"),
                    "person_birthday": person["birthday"],
                    "emergency_name": person["emergency_name"],
                    "emergency_phone": person["emergency_phone"],
                    "pet_count": len(order_pets_full),
                }
                # 动态追加宠物字段
                for i, pet in enumerate(order_pets_full, start=1):
                    prefix = f"pet{i}_"
                    row[f"{prefix}id"] = pet["id"]
                    row[f"{prefix}name"] = pet["name"]
                    row[f"{prefix}breed"] = pet["breed"]
                    row[f"{prefix}breed_type"] = {1: "小型", 2: "中型", 3: "大型", 4: "巨型"}.get(pet["breed_type"], "")
                    row[f"{prefix}gender"] = {0: "母", 1: "公"}.get(pet["gender"], "未知")
                    row[f"{prefix}birth_date"] = pet["birth_date"]
                    row[f"{prefix}age_str"] = pet["age_str"]
                    row[f"{prefix}weight"] = pet["weight"] if pet["weight"] is not None else ""
                    row[f"{prefix}vaccine_date"] = pet["vaccine_date"]
                    row[f"{prefix}vaccine_book"] = pet["vaccine_book"]
                    row[f"{prefix}health_notes"] = pet["health_notes"]
                    row[f"{prefix}avatar"] = pet["avatar"]
                    tags = pet.get("tags") if isinstance(pet, dict) else None
                    if isinstance(tags, list):
                        row[f"{prefix}tags"] = ",".join(str(t) for t in tags)
                    elif tags:
                        row[f"{prefix}tags"] = str(tags)
                    else:
                        row[f"{prefix}tags"] = ""
                    row[f"{prefix}is_default"] = pet["is_default"]
                    row[f"{prefix}status"] = pet["status"]
                    row[f"{prefix}created_at"] = pet["created_at"]
                    row[f"{prefix}updated_at"] = pet["updated_at"]
                rows.append(row)

        return success(rows)
    except Exception as e:
        logger.error(f"Error exporting orders for insurance: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"导出失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/orders/{order_id}")
async def admin_get_order_detail(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取订单详情"""
    try:
        from app.models.order import Order
        from sqlalchemy import text
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        o = result.scalar_one_or_none()
        
        if not o:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        # 如果路线封面为空，尝试从routes表查询
        route_cover = o.route_cover
        if not route_cover and o.route_id:
            route_res = await db.execute(
                text("SELECT cover_image FROM routes WHERE id = :route_id"),
                {"route_id": o.route_id}
            )
            route_row = route_res.fetchone()
            if route_row:
                route_cover = route_row[0]
        
        # 查询联系人信息（固定为下单账号本人）
        contact = {"name": "", "phone": "", "id_card": ""}
        user_phone = None
        if o.user_id:
            user_res = await db.execute(
                text("SELECT nickname, real_name, phone, id_card FROM users WHERE id = :user_id LIMIT 1"),
                {"user_id": o.user_id}
            )
            user_row = user_res.fetchone()
            if user_row:
                contact = {
                    "name": user_row[1] or user_row[0] or "未知",
                    "phone": user_row[2] or "",
                    "id_card": user_row[3] or ""
                }
                user_phone = user_row[2]
        
        # 补全宠物档案信息
        order_pets = o.pets or []
        pets = order_pets
        if o.user_id and order_pets:
            pet_result = await db.execute(
                text("""
                    SELECT id, user_id, name, breed, breed_type, birth_date, age_str,
                           gender, weight, vaccine_date, vaccine_book, health_notes,
                           avatar, tags, is_default, status, created_at, updated_at
                    FROM pet_profiles
                    WHERE user_id = :user_id
                """),
                {"user_id": o.user_id}
            )
            pet_map = {}
            for row in pet_result.fetchall():
                key = (row[1], row[2])  # (user_id, name)
                pet_map[key] = {
                    "id": row[0],
                    "user_id": row[1],
                    "name": row[2],
                    "breed": row[3],
                    "breed_type": row[4],
                    "birth_date": row[5].isoformat() if row[5] else None,
                    "age_str": row[6],
                    "gender": row[7],
                    "weight": row[8],
                    "vaccine_date": row[9].isoformat() if row[9] else None,
                    "vaccine_book": row[10],
                    "health_notes": row[11],
                    "avatar": row[12],
                    "tags": parse_pet_tags(row[13]),
                    "is_default": row[14],
                    "status": row[15],
                    "created_at": row[16].isoformat() if row[16] else None,
                    "updated_at": row[17].isoformat() if row[17] else None,
                }
            
            enriched_pets = []
            for p in order_pets:
                pet_key = (o.user_id, p.get("name"))
                pet_profile = pet_map.get(pet_key) or {}
                enriched_pets.append({
                    "id": pet_profile.get("id") or p.get("id") or "",
                    "name": p.get("name") or pet_profile.get("name") or "",
                    "breed": p.get("breed") or pet_profile.get("breed") or "",
                    "breed_type": pet_profile.get("breed_type") or "",
                    "gender": p.get("gender") if p.get("gender") is not None else pet_profile.get("gender"),
                    "birth_date": pet_profile.get("birth_date") or "",
                    "age_str": pet_profile.get("age_str") or "",
                    "weight": p.get("weight") if p.get("weight") is not None else (float(pet_profile.get("weight")) if pet_profile.get("weight") is not None else None),
                    "vaccine_date": pet_profile.get("vaccine_date") or "",
                    "vaccine_book": pet_profile.get("vaccine_book") or "",
                    "health_notes": pet_profile.get("health_notes") or "",
                    "avatar": pet_profile.get("avatar") or "",
                    "tags": pet_profile.get("tags") or [],
                    "is_default": pet_profile.get("is_default") or 0,
                    "status": pet_profile.get("status") or 1,
                    "created_at": pet_profile.get("created_at") or "",
                    "updated_at": pet_profile.get("updated_at") or "",
                })
            pets = enriched_pets
        
        # 查询退款记录
        from app.models.refund_record import RefundRecord
        refund_records_result = await db.execute(
            select(RefundRecord).where(RefundRecord.order_id == o.id).order_by(RefundRecord.created_at.desc())
        )
        refund_records = refund_records_result.scalars().all()
        
        order = {
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "user_phone": user_phone,
            "route_id": o.route_id,
            "is_free": o.is_free,
            "route_name": o.route_name,
            "route_cover": route_cover,
            "travel_date": o.travel_date.isoformat() if o.travel_date else None,
            "participant_count": o.participant_count,
            "pet_count": o.pet_count,
            "travel_type": o.travel_type,
            "package_type": o.package_type,
            "participants": o.participants or [],
            "pets": pets,
            "contact": contact,
            "route_price": float(o.route_price) if o.route_price else 0,
            "insurance_price": float(o.insurance_price) if o.insurance_price else 0,
            "equipment_price": float(o.equipment_price) if o.equipment_price else 0,
            "addon_amount": float(o.addon_amount) if o.addon_amount else 0,
            "addons": o.addons or [],
            "discount_amount": float(o.discount_amount) if o.discount_amount else 0,
            "pay_amount": float(o.pay_amount) if o.pay_amount else 0,
            "total_amount": float(o.total_amount) if o.total_amount else 0,
            "refunded_amount": float(o.refunded_amount or 0),
            "status": o.status,
            "status_name": STATUS_MAP.get(o.status, "未知"),
                
            "pay_time": o.pay_time.isoformat() if o.pay_time else None,
            "pay_channel": o.pay_channel,
            "pay_trade_no": o.pay_trade_no,
            "pay_transaction_id": o.pay_transaction_id,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
            "refund_reject_reason": o.refund_reject_reason,
            "refund_records": [
                {
                    "id": r.id,
                    "refund_no": r.refund_no,
                    "amount": float(r.amount),
                    "reason": r.reason,
                    "type": r.type,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in refund_records
            ]
        }
        
        return success(order)
    except Exception as e:
        logger.error(f"Error getting order detail: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/orders/{order_id}")
async def admin_update_order(
    order_id: int,
    data: AdminUpdateOrderRequest,
    db: AsyncSession = Depends(get_db)
):
    """管理后台修改订单信息"""
    try:
        from app.models.order import Order

        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()

        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}

        # 不允许修改已取消/已退款/退款中的订单
        if order.status in [30, 40, 50]:
            return {"code": 400, "message": "当前订单状态不允许修改", "data": None}

        # 计算新的 participant_count
        new_participant_count = order.participant_count
        if data.participants is not None:
            new_participant_count = len(data.participants) if len(data.participants) > 0 else (data.participant_count or order.participant_count)
        if data.participant_count is not None:
            new_participant_count = data.participant_count

        # 如果更换了排期，需要恢复旧排期库存并扣减新排期库存
        old_schedule_id = order.schedule_id
        new_schedule_id = old_schedule_id
        if data.travel_date is not None:
            # 根据 route_id 和 travel_date 查找新排期
            schedule_res = await db.execute(
                text("SELECT id FROM route_schedules WHERE route_id = :route_id AND schedule_date = :travel_date"),
                {"route_id": order.route_id, "travel_date": data.travel_date}
            )
            schedule_row = schedule_res.fetchone()
            if not schedule_row:
                return {"code": 400, "message": "目标日期没有可用排期", "data": None}
            new_schedule_id = schedule_row[0]

        # 处理库存变化（换排期时按订单占座数恢复旧排期库存、扣减新排期库存；自驾不占座则跳过）
        seat_count = getattr(order, 'seat_count', None) or 0
        if old_schedule_id != new_schedule_id and seat_count > 0:
            # 恢复旧排期库存
            await db.execute(
                text("""
                    UPDATE route_schedules 
                    SET stock = stock + :seat_count, sold = sold - :seat_count 
                    WHERE id = :schedule_id AND sold >= :seat_count
                """),
                {"schedule_id": old_schedule_id, "seat_count": seat_count}
            )
            # 扣减新排期库存
            stock_result = await db.execute(
                text("""
                    UPDATE route_schedules 
                    SET stock = stock - :seat_count, sold = sold + :seat_count 
                    WHERE id = :schedule_id AND stock >= :seat_count
                """),
                {"schedule_id": new_schedule_id, "seat_count": seat_count}
            )
            if stock_result.rowcount == 0:
                return {"code": 400, "message": "目标排期库存不足", "data": None}
            order.schedule_id = new_schedule_id
            order.travel_date = datetime.strptime(data.travel_date, "%Y-%m-%d").date()

        # 更新其他字段
        # 联系人固定为下单账号本人，不允许通过后台修改
        # if data.contact is not None:
        #     order.contact = data.contact
        if data.participants is not None:
            order.participants = data.participants
            order.participant_count = len(data.participants) if len(data.participants) > 0 else (data.participant_count or order.participant_count)
        if data.pets is not None:
            order.pets = data.pets
            order.pet_count = len(data.pets) if len(data.pets) > 0 else (data.pet_count or order.pet_count)
        if data.participant_count is not None:
            order.participant_count = data.participant_count
        if data.pet_count is not None:
            order.pet_count = data.pet_count
        if data.travel_type is not None:
            order.travel_type = data.travel_type
        if data.remark is not None:
            order.remark = data.remark

        order.updated_at = datetime.now()
        await db.commit()

        logger.info(f"Order updated by admin: {order.order_no}, id={order_id}")
        return success({"order_id": order_id, "order_no": order.order_no}, message="订单修改成功")
    except Exception as e:
        logger.error(f"Error updating order: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"修改失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/orders/{order_id}/cancel")
async def admin_cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台取消订单"""
    try:
        from app.models.order import Order

        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()

        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}

        # 只允许取消待支付和待出行的订单
        if order.status not in [10, 20]:
            return {"code": 400, "message": f"当前订单状态({STATUS_MAP.get(order.status, order.status)})不允许取消", "data": None}

        # 对于已支付的待出行订单，提示需先退款
        if order.status == 20 and float(order.pay_amount or 0) > 0:
            return {
                "code": 400,
                "message": "该订单已支付，请先使用退款功能处理后再取消",
                "data": {"status": order.status, "pay_amount": float(order.pay_amount)}
            }

        # 原子更新订单状态（防止并发重复取消）
        status_result = await db.execute(
            text("""
                UPDATE orders 
                SET status = 30, updated_at = NOW() 
                WHERE id = :order_id AND status IN (10, 20)
            """),
            {"order_id": order_id}
        )
        
        if status_result.rowcount == 0:
            return {"code": 400, "message": "订单状态已变更，请刷新后重试", "data": None}

        # 状态更新成功，恢复库存（根据订单实际占座数恢复；自驾不占座则不恢复）
        restore_count = getattr(order, 'seat_count', None) or 0
        if order.schedule_id and restore_count > 0:
            await db.execute(
                text("""
                    UPDATE route_schedules
                    SET stock = stock + :restore_count, sold = sold - :restore_count
                    WHERE id = :schedule_id AND sold >= :restore_count
                """),
                {"schedule_id": order.schedule_id, "restore_count": restore_count}
            )

        # 恢复优惠券
        if order.coupon_id:
            await db.execute(
                text("UPDATE user_coupons SET status = 1, used_at = NULL, used_order_id = NULL WHERE id = :coupon_id"),
                {"coupon_id": order.coupon_id}
            )

        await db.commit()

        logger.info(f"Order cancelled by admin: {order.order_no}, id={order_id}")
        return success({"order_id": order_id, "order_no": order.order_no, "status": 30}, message="订单已取消")
    except Exception as e:
        logger.error(f"Error cancelling order: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"取消失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/orders/{order_id}/refund")
async def admin_refund_order(
    order_id: int,
    refund_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台订单退款（仅申请，状态变为40退款中，等待审核）"""
    try:
        from app.models.order import Order
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        # 检查订单状态是否允许退款（待出行、部分退款、已完成、已评价）
        if order.status not in [20, 55, 60, 70]:
            return {"code": 400, "message": "当前订单状态不允许退款", "data": None}
        
        # 防止超退
        if order.refunded_amount and float(order.refunded_amount) >= float(order.pay_amount or 0):
            return {"code": 400, "message": "该订单已退完全部金额，不可重复退款", "data": None}
        
        refund_type = refund_data.get('refund_type', 'full')
        refund_reason = refund_data.get('refund_reason', '')
        
        # 计算退款金额
        if refund_type == 'full':
            refund_amount = float(order.pay_amount)
        else:
            refund_amount = refund_data.get('refund_amount', 0)
        
        # 更新订单状态为退款中
        order.status = 40  # 退款中
        order.refund_amount = refund_amount
        order.refund_reason = refund_reason
        
        await db.commit()
        
        logger.info(f"Order {order_id} refund applied: amount={refund_amount}, reason={refund_reason}")
        
        return {
            "code": 200,
            "message": "退款申请已提交",
            "data": {
                "order_id": order_id,
                "refund_amount": refund_amount,
                "status": 40
            }
        }
    except Exception as e:
        logger.error(f"Error refunding order: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"退款失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/refunds")
async def admin_get_refunds(
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取退款列表"""
    try:
        from app.models.order import Order
        
        # 查询退款中(40)、退款驳回(45)、已退款(50)或部分退款(55)的订单
        query = select(Order).where(Order.status.in_([40, 45, 50, 55]))
        
        if status:
            query = query.where(Order.status == status)
        
        query = query.order_by(Order.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        orders_db = result.scalars().all()
        
        refunds = []
        for o in orders_db:
            refunds.append({
                "id": o.id,
                "order_no": o.order_no,
                "user_id": o.user_id,
                "route_name": o.route_name,
                "pay_amount": float(o.pay_amount) if o.pay_amount else 0,
                "refund_amount": float(o.refund_amount) if o.refund_amount else 0,
                "refund_reason": o.refund_reason,
                "refund_time": o.refund_time.isoformat() if o.refund_time else None,
                "status": o.status,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "refunds": refunds
        })
    except Exception as e:
        logger.error(f"Error getting refunds: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/orders/{order_id}/direct-refund")
async def admin_direct_refund(
    order_id: int,
    refund_data: dict,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """管理后台直接退款（不走申请+审核流程，一键完成微信退款）"""
    try:
        from app.models.order import Order
        from app.models.refund_record import RefundRecord
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        # 检查订单状态是否允许退款
        if order.status not in [20, 55, 60, 70]:
            return {"code": 400, "message": "当前订单状态不允许退款", "data": None}
        
        # 防止超退
        already_refunded = float(order.refunded_amount or 0)
        pay_amount = float(order.pay_amount or 0)
        if already_refunded >= pay_amount:
            return {"code": 400, "message": "该订单已退完全部金额，不可重复退款", "data": None}
        
        refund_type = refund_data.get('refund_type', 'full')
        refund_reason = refund_data.get('refund_reason', '后台直接退款')
        
        # 计算退款金额
        if refund_type == 'full':
            refund_amount = pay_amount - already_refunded
        else:
            refund_amount = float(refund_data.get('refund_amount', 0))
        
        if refund_amount <= 0:
            return {"code": 400, "message": "退款金额必须大于0", "data": None}
        
        if already_refunded + refund_amount > pay_amount:
            return {"code": 400, "message": f"累计退款不能超过实付金额，剩余可退: {pay_amount - already_refunded:.2f}", "data": None}
        
        # 生成退款单号并创建记录
        refund_no = generate_refund_no()
        record = RefundRecord(
            order_id=order_id,
            refund_no=refund_no,
            amount=refund_amount,
            reason=refund_reason,
            type=refund_type,
            status=10,
        )
        db.add(record)
        
        # 先更新为退款中
        order.status = 40
        order.refund_amount = refund_amount
        order.refund_reason = refund_reason
        await db.commit()
        
        # 调用 pay-service 发起微信退款
        pay_service_url = os.getenv("PAY_SERVICE_URL", "http://localhost:8006")
        refund_payload = {
            "order_no": order.order_no,
            "refund_amount": refund_amount,
            "reason": refund_reason,
            "transaction_id": order.pay_transaction_id or order.pay_trade_no or "",
            "total_amount": float(order.pay_amount or order.total_amount or 0)
        }
        
        headers = {}
        if authorization:
            headers["Authorization"] = authorization
        
        pay_result = None
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                pay_response = await client.post(
                    f"{pay_service_url}/api/v1/pay/refund",
                    json=refund_payload,
                    headers=headers
                )
                pay_result = pay_response.json()
        except Exception as e:
            logger.error(f"Call pay-service refund failed: {e}")
            # 退款服务调用失败，回滚状态
            order.status = 20 if already_refunded == 0 else 55
            order.refund_amount = 0
            order.refund_reason = f"退款服务调用失败: {str(e)}"
            record.status = 30
            record.fail_reason = str(e)
            await db.commit()
            return {"code": 500, "message": f"退款服务调用失败: {str(e)}", "data": None}
        
        if pay_result.get("code") != 200:
            logger.error(f"Pay-service refund error: {pay_result}")
            # 微信退款失败，回滚状态
            order.status = 20 if already_refunded == 0 else 55
            order.refund_amount = 0
            order.refund_reason = f"退款失败: {pay_result.get('message', '未知错误')}"
            record.status = 30
            record.fail_reason = pay_result.get('message', '微信退款返回错误')
            await db.commit()
            return {"code": 500, "message": f"退款失败: {pay_result.get('message', '微信退款返回错误')}", "data": None}
        
        # 退款成功
        record.status = 20
        record.transaction_id = pay_result.get("data", {}).get("refund_id", "")
        order.refunded_amount = already_refunded + refund_amount
        
        # 判断是否为最后一笔退款
        if order.refunded_amount >= pay_amount:
            order.status = 50
            order.refund_time = datetime.now()
            # 全额退款才恢复优惠券
            if order.coupon_id:
                await db.execute(
                    text("UPDATE user_coupons SET status = 1, used_at = NULL, used_order_id = NULL WHERE id = :coupon_id"),
                    {"coupon_id": order.coupon_id}
                )
                logger.info(f"Coupon restored after full refund: coupon_id={order.coupon_id}, order_id={order_id}")
        else:
            order.status = 55  # 部分退款，优惠券不恢复（订单仍有效）
        
        await db.commit()
        
        logger.info(f"Order {order_id} direct refund success: amount={refund_amount}, total_refunded={order.refunded_amount}")
        
        return success({
            "order_id": order_id,
            "refund_amount": refund_amount,
            "refunded_amount": float(order.refunded_amount),
            "status": order.status,
            "status_name": STATUS_MAP.get(order.status, "未知"),
            "refund_time": order.refund_time.isoformat() if order.refund_time else None
        }, message="退款成功")
    except Exception as e:
        logger.error(f"Error direct refunding order: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"退款失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/refunds/{order_id}/approve")
async def admin_approve_refund(
    order_id: int,
    data: dict = {},
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """审核通过退款（支持全额或部分）"""
    try:
        from app.models.order import Order
        from app.models.refund_record import RefundRecord
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        if order.status != 40:
            return {"code": 400, "message": "订单不是退款中状态", "data": None}
        
        already_refunded = float(order.refunded_amount or 0)
        pay_amount = float(order.pay_amount or 0)
        
        # 判断是全额还是部分
        refund_type = data.get('refund_type', 'full')
        if refund_type == 'partial':
            refund_amount = float(data.get('refund_amount', 0))
            if refund_amount <= 0:
                return {"code": 400, "message": "退款金额必须大于0", "data": None}
            if already_refunded + refund_amount > pay_amount:
                return {"code": 400, "message": f"累计退款不能超过实付金额，剩余可退: {pay_amount - already_refunded:.2f}", "data": None}
        else:
            refund_amount = pay_amount - already_refunded
        
        # 创建退款记录
        refund_no = generate_refund_no()
        record = RefundRecord(
            order_id=order_id,
            refund_no=refund_no,
            amount=refund_amount,
            reason=order.refund_reason or "用户申请退款",
            type=refund_type,
            status=10,
        )
        db.add(record)
        await db.flush()
        
        # 调用 pay-service 发起退款
        pay_service_url = os.getenv("PAY_SERVICE_URL", "http://localhost:8006")
        refund_payload = {
            "order_no": order.order_no,
            "refund_amount": refund_amount,
            "reason": order.refund_reason or "用户申请退款",
            "transaction_id": order.pay_trade_no or order.pay_transaction_id or "",
            "total_amount": float(order.pay_amount or order.total_amount or 0)
        }
        
        headers = {}
        if authorization:
            headers["Authorization"] = authorization
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                pay_response = await client.post(
                    f"{pay_service_url}/api/v1/pay/refund",
                    json=refund_payload,
                    headers=headers
                )
                pay_result = pay_response.json()
        except Exception as e:
            logger.error(f"Call pay-service refund failed: {e}")
            record.status = 30
            record.fail_reason = str(e)
            await db.commit()
            return {"code": 500, "message": f"退款服务调用失败: {str(e)}", "data": None}
        
        if pay_result.get("code") != 200:
            logger.error(f"Pay-service refund error: {pay_result}")
            record.status = 30
            record.fail_reason = pay_result.get('message', '退款服务返回错误')
            await db.commit()
            return {"code": 500, "message": f"退款失败: {pay_result.get('message', '退款服务返回错误')}", "data": None}
        
        # 退款成功
        record.status = 20
        record.transaction_id = pay_result.get("data", {}).get("refund_id", "")
        order.refunded_amount = already_refunded + refund_amount
        
        # 判断是否为最后一笔退款
        if order.refunded_amount >= pay_amount:
            order.status = 50
            order.refund_time = datetime.now()
            # 全额退款才恢复优惠券
            if order.coupon_id:
                await db.execute(
                    text("UPDATE user_coupons SET status = 1, used_at = NULL, used_order_id = NULL WHERE id = :coupon_id"),
                    {"coupon_id": order.coupon_id}
                )
                logger.info(f"Coupon restored after full refund approve: coupon_id={order.coupon_id}, order_id={order_id}")
        else:
            order.status = 55  # 部分退款，优惠券不恢复（订单仍有效）
            order.refund_amount = 0  # 清空当前退款金额，允许再次申请
        
        await db.commit()
        
        return success({
            "order_id": order_id,
            "refund_amount": refund_amount,
            "refunded_amount": float(order.refunded_amount),
            "status": order.status,
            "status_name": STATUS_MAP.get(order.status, "未知"),
            "refund_time": order.refund_time.isoformat() if order.refund_time else None
        }, message="退款审核通过")
    except Exception as e:
        logger.error(f"Error approving refund: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"审核失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/refunds/{order_id}/reject")
async def admin_reject_refund(
    order_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """拒绝退款申请"""
    try:
        from app.models.order import Order
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        if order.status != 40:
            return {"code": 400, "message": "订单不是退款中状态", "data": None}
        
        # 更新为退款驳回状态(45)，保留用户申请原因，单独记录拒绝原因
        order.status = 45
        order.refund_amount = 0
        order.refund_reject_reason = data.get('reason', '')
        await db.commit()
        
        return success({
            "order_id": order_id,
            "status": 45,
            "status_name": "退款驳回"
        }, message="已拒绝退款申请")
    except Exception as e:
        logger.error(f"Error rejecting refund: {e}")
        return {"code": 500, "message": f"操作失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/evaluations")
async def admin_get_evaluations(
    route_id: Optional[int] = None,
    rating: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取评价列表"""
    try:
        from app.models.order import OrderEvaluation
        from sqlalchemy import and_
        
        query = select(OrderEvaluation)
        
        if route_id:
            query = query.where(OrderEvaluation.route_id == route_id)
        if rating:
            query = query.where(OrderEvaluation.rating == rating)
        
        query = query.order_by(OrderEvaluation.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        evals_db = result.scalars().all()
        
        evaluations = []
        for e in evals_db:
            evaluations.append({
                "id": e.id,
                "order_id": e.order_id,
                "user_id": e.user_id,
                "route_id": e.route_id,
                "rating": e.rating,
                "content": e.content,
                "tags": e.tags or [],
                "images": e.images or [],
                "is_anonymous": e.is_anonymous,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "evaluations": evaluations
        })
    except Exception as e:
        logger.error(f"Error getting evaluations: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/evaluations/{evaluation_id}")
async def admin_delete_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除评价"""
    try:
        from app.models.order import OrderEvaluation
        
        result = await db.execute(select(OrderEvaluation).where(OrderEvaluation.id == evaluation_id))
        evaluation = result.scalar_one_or_none()
        
        if not evaluation:
            return {"code": 404, "message": "评价不存在", "data": None}
        
        await db.delete(evaluation)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting evaluation: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/stats")
async def admin_get_stats(
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取首页统计数据"""
    try:
        from app.models.order import Order
        from sqlalchemy import func, and_
        from datetime import datetime, timedelta
        
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        # 总用户数（直接查询共享数据库）
        total_users_result = await db.execute(text("SELECT COUNT(*) FROM users"))
        total_users = total_users_result.scalar() or 0
        
        # 今日订单数
        today_orders_result = await db.execute(
            select(func.count()).where(
                and_(
                    Order.created_at >= today_start,
                    Order.created_at <= today_end
                )
            )
        )
        today_orders = today_orders_result.scalar()
        
        # 今日营业额
        today_revenue_result = await db.execute(
            select(func.sum(Order.pay_amount)).where(
                and_(
                    Order.status.in_([20, 60, 70]),  # 已支付、已完成、已评价
                    Order.created_at >= today_start,
                    Order.created_at <= today_end
                )
            )
        )
        today_revenue = float(today_revenue_result.scalar() or 0)
        
        # 总订单数
        total_orders_result = await db.execute(select(func.count()).select_from(Order))
        total_orders = total_orders_result.scalar()
        
        # 总营业额
        total_revenue_result = await db.execute(
            select(func.sum(Order.pay_amount)).where(
                Order.status.in_([20, 60, 70])
            )
        )
        total_revenue = float(total_revenue_result.scalar() or 0)
        
        # 待处理订单数（待支付 + 待出行）
        pending_orders_result = await db.execute(
            select(func.count()).where(Order.status.in_([10, 20]))
        )
        pending_orders = pending_orders_result.scalar()
        
        return success({
            "total_users": total_users,
            "today_orders": today_orders,
            "today_revenue": today_revenue,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "pending_orders": pending_orders,
        })
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"统计失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)


# ==================== 优惠券模块 ====================

import random
import string

def generate_coupon_no() -> str:
    """生成优惠券编号"""
    return f"CP{datetime.now().strftime('%Y%m%d%H%M%S')}{''.join(random.choices(string.digits, k=4))}"

def generate_member_order_no() -> str:
    """生成会员订单编号"""
    return f"MV{datetime.now().strftime('%Y%m%d%H%M%S')}{''.join(random.choices(string.digits, k=3))}"


def calculate_discount(coupon_type: int, value: float, order_amount: float, max_discount: float = 0) -> float:
    """计算优惠金额
    
    折扣券value存储格式：8.5表示8.5折
    计算：优惠金额 = 订单金额 * (1 - value/10)
    例如：8.5折，value=8.5，优惠=订单金额 * 0.15
    """
    if coupon_type == 4:  # 礼品券不参与订单金额抵扣
        return 0
    if coupon_type == 1:  # 满减券
        return min(value, order_amount)
    elif coupon_type == 2:  # 折扣券
        # value是折数，如8.5表示8.5折，即支付85%
        discount = order_amount * (1 - value / 10)
        if max_discount > 0:
            discount = min(discount, max_discount)
        return round(discount, 2)
    elif coupon_type == 3:  # 立减券
        return min(value, order_amount)
    return 0


@app.get("/api/v1/coupons")
async def get_user_coupons(
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户优惠券列表"""
    from app.models.coupon import UserCoupon, CouponTemplate
    
    user_id = current_user.get("user_id", 1)
    
    query = select(UserCoupon).where(UserCoupon.user_id == user_id)
    
    if status:
        query = query.where(UserCoupon.status == status)
    
    query = query.order_by(UserCoupon.created_at.desc())
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    coupons = result.scalars().all()
    
    # 查询模板最新配置
    template_ids = [c.template_id for c in coupons if c.template_id]
    template_map = {}
    if template_ids:
        template_result = await db.execute(
            select(CouponTemplate).where(CouponTemplate.id.in_(template_ids))
        )
        template_map = {t.id: t for t in template_result.scalars().all()}
    
    now = datetime.now()
    data = []
    for c in coupons:
        template = template_map.get(c.template_id)
        # 使用模板最新门槛配置
        min_amount = float(template.min_amount) if template else float(c.min_amount)
        
        item = {
            "id": c.id,
            "coupon_no": c.coupon_no,
            "name": c.name,
            "type": c.type,
            "type_text": {1: "满减券", 2: "折扣券", 3: "立减券", 4: "礼品券"}.get(c.type, "未知"),
            "value": float(c.value),
            "min_amount": min_amount,
            "valid_start_time": c.valid_start_time.isoformat() if c.valid_start_time else None,
            "valid_end_time": c.valid_end_time.isoformat() if c.valid_end_time else None,
            "status": c.status,
            "status_text": {1: "未使用", 2: "已使用", 3: "已过期", 4: "已作废"}.get(c.status, "未知"),
            "is_expired_soon": c.valid_end_time and (c.valid_end_time - now).days <= 3 if c.status == 1 else False,
            "source_type": c.source_type,
            "used_order_id": c.used_order_id,
            "description": c.description,
        }
        data.append(item)
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


@app.post("/api/v1/admin/coupons/grant")
async def admin_grant_coupons(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台主动发放优惠券给指定用户"""
    from app.models.coupon import CouponTemplate, UserCoupon
    
    template_id = data.get("template_id")
    user_ids = data.get("user_ids", [])
    
    if not template_id:
        return {"code": 400, "message": "缺少优惠券模板ID", "data": None}
    
    if not user_ids or not isinstance(user_ids, list):
        return {"code": 400, "message": "缺少用户ID列表", "data": None}
    
    # 查询模板
    result = await db.execute(select(CouponTemplate).where(CouponTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template or template.status != 1:
        return {"code": 400, "message": "优惠券模板不存在或已停用", "data": None}
    
    now = datetime.now()
    if template.valid_type == 2 and template.valid_end_time and template.valid_end_time <= now:
        return {"code": 400, "message": "优惠券模板已过期", "data": None}
    
    # 检查库存
    if template.total_count > 0:
        claimed_count_result = await db.execute(
            select(func.count()).where(UserCoupon.template_id == template_id)
        )
        claimed_count = claimed_count_result.scalar()
        remaining = template.total_count - claimed_count
        if remaining < len(user_ids):
            return {"code": 400, "message": f"库存不足，剩余{remaining}张，需发放{len(user_ids)}张", "data": None}
    
    # 计算有效期
    if template.valid_type == 1:
        valid_start = now
        valid_end = now + timedelta(days=template.valid_days)
    else:
        valid_start = template.valid_start_time or now
        valid_end = template.valid_end_time or (now + timedelta(days=7))
    
    # 是否强制发放（忽略每人限领）
    force = data.get('force', False)
    
    # 给每个用户发放优惠券
    granted_count = 0
    skipped_users = []
    
    for user_id in user_ids:
        # 检查用户限领（非强制发放时生效）
        if not force and template.per_user_limit > 0:
            user_count_result = await db.execute(
                select(func.count()).where(
                    UserCoupon.template_id == template_id,
                    UserCoupon.user_id == user_id
                )
            )
            user_count = user_count_result.scalar()
            if user_count >= template.per_user_limit:
                skipped_users.append({"user_id": user_id, "reason": "已达到领取上限"})
                continue
        
        # 创建用户优惠券
        user_coupon = UserCoupon(
            user_id=user_id,
            template_id=template.id,
            coupon_no=generate_coupon_no(),
            name=template.name,
            type=template.type,
            value=template.value,
            min_amount=template.min_amount,
            max_discount=template.max_discount,
            applicable_type=template.applicable_type,
            applicable_ids=template.applicable_ids,
            valid_start_time=valid_start,
            valid_end_time=valid_end,
            status=1,
            source_type=4,  # 4=管理后台发放
            source_id=template.id,
            description=template.description,
        )
        db.add(user_coupon)
        granted_count += 1
    
    await db.flush()
    await db.commit()
    
    return success({
        "granted_count": granted_count,
        "skipped_count": len(skipped_users),
        "skipped_users": skipped_users,
    }, message=f"成功发放{granted_count}张优惠券")


@app.get("/api/v1/coupons/claim-center")
async def get_claim_center(
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取领券中心列表"""
    from app.models.coupon import CouponTemplate, UserCoupon
    
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
    query = select(CouponTemplate).where(
        CouponTemplate.status == 1,
        CouponTemplate.source_type == 1  # 仅展示通用券
    ).where(
        (CouponTemplate.valid_type == 1) | 
        ((CouponTemplate.valid_type == 2) & (CouponTemplate.valid_end_time > now))
    ).where(
        (CouponTemplate.applicable_type != 4) | 
        (
            (CouponTemplate.applicable_type == 4) & 
            CouponTemplate.applicable_ids.is_not(None) &
            func.json_contains(CouponTemplate.applicable_ids, str(user_id))
        )
    ).order_by(CouponTemplate.created_at.desc())
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    templates = result.scalars().all()
    
    data = []
    for t in templates:
        # 查询已领取数量和用户已领取数量
        claimed_count_result = await db.execute(
            select(func.count()).where(UserCoupon.template_id == t.id)
        )
        claimed_count = claimed_count_result.scalar()
        
        user_claimed_count_result = await db.execute(
            select(func.count()).where(
                UserCoupon.template_id == t.id,
                UserCoupon.user_id == user_id
            )
        )
        user_claimed_count = user_claimed_count_result.scalar()
        
        can_claim = True
        reason = None
        if t.total_count > 0 and claimed_count >= t.total_count:
            can_claim = False
            reason = "已领完"
        elif t.per_user_limit > 0 and user_claimed_count >= t.per_user_limit:
            can_claim = False
            reason = "已达到领取上限"
        
        data.append({
            "template_id": t.id,
            "name": t.name,
            "type": t.type,
            "value": float(t.value),
            "min_amount": float(t.min_amount),
            "description": t.description or f"{'满' + str(int(t.min_amount)) + '减' if t.type == 1 else ''}{float(t.value)}{'折' if t.type == 2 else '元'}",
            "valid_type": t.valid_type,
            "valid_days": t.valid_days,
            "total_count": t.total_count,
            "claimed_count": claimed_count,
            "remaining_count": max(0, t.total_count - claimed_count) if t.total_count > 0 else None,
            "per_user_limit": t.per_user_limit,
            "user_claimed_count": user_claimed_count,
            "can_claim": can_claim,
            "cannot_claim_reason": reason,
            "applicable_type": t.applicable_type,
            "color": t.color,
        })
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


@app.post("/api/v1/coupons/claim")
async def claim_coupon(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """领取优惠券"""
    from app.models.coupon import CouponTemplate, UserCoupon
    
    user_id = current_user.get("user_id", 1)
    template_id = data.get("template_id")
    
    if not template_id:
        return {"code": 400, "message": "缺少template_id", "data": None}
    
    # 查询模板
    result = await db.execute(select(CouponTemplate).where(CouponTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template or template.status != 1:
        return {"code": 400, "message": "优惠券不存在或已停用", "data": None}
    
    if template.source_type != 1:
        return {"code": 400, "message": "该优惠券不支持主动领取", "data": None}
    
    now = datetime.now()
    if template.valid_type == 2 and template.valid_end_time and template.valid_end_time <= now:
        return {"code": 400, "message": "优惠券已过期", "data": None}
    
    # 检查库存
    if template.total_count > 0:
        claimed_count_result = await db.execute(
            select(func.count()).where(UserCoupon.template_id == template_id)
        )
        claimed_count = claimed_count_result.scalar()
        if claimed_count >= template.total_count:
            return {"code": 400, "message": "优惠券已领完", "data": None}
    
    # 检查用户限领
    if template.per_user_limit > 0:
        user_claimed_count_result = await db.execute(
            select(func.count()).where(
                UserCoupon.template_id == template_id,
                UserCoupon.user_id == user_id
            )
        )
        user_claimed_count = user_claimed_count_result.scalar()
        if user_claimed_count >= template.per_user_limit:
            return {"code": 400, "message": "已达到领取上限", "data": None}
    
    # 检查适用范围
    if template.applicable_type == 2 and template.applicable_ids:
        # 指定路线，不做领取限制（在订单使用时校验）
        pass
    elif template.applicable_type == 3 and template.applicable_ids:
        # 指定路线类型，不做领取限制（在订单使用时校验）
        pass
    elif template.applicable_type == 4 and template.applicable_ids:
        # 指定用户，检查当前用户是否在列表中
        if user_id not in template.applicable_ids:
            return {"code": 403, "message": "您没有权限领取该优惠券", "data": None}
    
    # 计算有效期
    if template.valid_type == 1:
        valid_start = now
        valid_end = now + timedelta(days=template.valid_days)
    else:
        valid_start = template.valid_start_time or now
        valid_end = template.valid_end_time or (now + timedelta(days=7))
    
    # 创建用户优惠券
    user_coupon = UserCoupon(
        user_id=user_id,
        template_id=template.id,
        coupon_no=generate_coupon_no(),
        name=template.name,
        type=template.type,
        value=template.value,
        min_amount=template.min_amount,
        max_discount=template.max_discount,
        applicable_type=template.applicable_type,
        applicable_ids=template.applicable_ids,
        valid_start_time=valid_start,
        valid_end_time=valid_end,
        status=1,
        source_type=1,
        source_id=template.id,
    )
    db.add(user_coupon)
    await db.flush()
    await db.commit()
    
    return success({
        "user_coupon_id": user_coupon.id,
        "coupon_no": user_coupon.coupon_no,
        "valid_end_time": valid_end.isoformat()
    }, message="领取成功")


@app.get("/api/v1/coupons/available-for-order")
async def get_available_coupons_for_order(
    route_id: int,
    route_price: float = 0,  # 新参数，优先使用
    amount: float = 0,       # 旧参数兼容
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取订单可用优惠券"""
    from app.models.coupon import UserCoupon, CouponTemplate
    
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
    result = await db.execute(
        select(UserCoupon).where(
            UserCoupon.user_id == user_id,
            UserCoupon.status == 1,
            UserCoupon.valid_start_time <= now,
            UserCoupon.valid_end_time >= now,
            UserCoupon.type != 4  # 礼品券不参与订单优惠
        ).order_by(UserCoupon.value.desc())
    )
    coupons = result.scalars().all()
    
    # 查询模板最新配置
    template_ids = [c.template_id for c in coupons if c.template_id]
    template_map = {}
    if template_ids:
        template_result = await db.execute(
            select(CouponTemplate).where(CouponTemplate.id.in_(template_ids))
        )
        template_map = {t.id: t for t in template_result.scalars().all()}
    
    available = []
    unavailable = []
    best_coupon_id = None
    best_discount = 0
    
    # 查询当前路线的类型和是否免费/会员专享（用于路线类型校验和免费路线判断）
    route_type = None
    is_free_route = False
    route_is_member_only = 0
    try:
        from app.models.route import Route
        route_result = await db.execute(select(Route.route_type, Route.is_free, Route.is_member_only).where(Route.id == route_id))
        route_row = route_result.first()
        if route_row:
            route_type = route_row[0]
            is_free_route = bool(route_row[1])
            route_is_member_only = route_row[2] or 0
    except Exception:
        pass
    
    # 判断用户是否会员
    is_member = False
    try:
        member_result = await db.execute(
            text("""
                SELECT 1 FROM user_memberships 
                WHERE user_id = :user_id AND status = 1 AND end_date >= CURDATE()
                LIMIT 1
            """),
            {"user_id": user_id}
        )
        is_member = member_result.scalar() is not None
    except Exception:
        pass
    
    # 确定折扣基础：
    # - 全员免费路线始终为0
    # - 会员专享免费路线：会员为0，非会员按 route_price
    # - 非免费路线优先用 route_price，旧版回退到 amount
    if is_free_route:
        if route_is_member_only and not is_member:
            discount_base = route_price
        else:
            discount_base = 0
    elif route_price > 0:
        discount_base = route_price
    else:
        discount_base = amount
    
    logger.info(f"[available-for-order] route_id={route_id}, route_price={route_price}, amount={amount}, discount_base={discount_base}, is_free_route={is_free_route}, is_member={is_member}")
    
    for c in coupons:
        template = template_map.get(c.template_id)
        
        # 使用模板的最新配置（如果模板存在），否则回退到用户券的配置
        min_amount = float(template.min_amount) if template else float(c.min_amount)
        max_discount = float(template.max_discount) if template else float(c.max_discount or 0)
        applicable_type = template.applicable_type if template else c.applicable_type
        applicable_ids = template.applicable_ids if template else c.applicable_ids
        
        # 检查金额门槛（只按路线价格校验，不含保险/选配）
        if min_amount > 0 and discount_base < min_amount:
            logger.info(f"[available-for-order] coupon {c.id} ({c.name}) unavailable: discount_base={discount_base} < min_amount={min_amount}")
            unavailable.append({
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "value": float(c.value),
                "reason": f"订单金额未满{min_amount}元"
            })
            continue
        
        # 检查适用范围
        if applicable_type == 2 and applicable_ids:
            # 指定路线
            if route_id not in (applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前路线"
                })
                continue
        elif applicable_type == 3 and applicable_ids:
            # 指定路线类型
            if route_type is None or route_type not in (applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前路线类型"
                })
                continue
        elif applicable_type == 4 and applicable_ids:
            # 指定用户（理论上已过滤，兜底校验）
            if user_id not in (applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前用户"
                })
                continue
        
        # 优惠券只减免路线价格，不减保险/装备/选配
        discount = calculate_discount(c.type, float(c.value), discount_base, max_discount)
        
        item = {
            "id": c.id,
            "coupon_no": c.coupon_no,
            "name": c.name,
            "type": c.type,
            "value": float(c.value),
            "min_amount": min_amount,
            "discount_amount": discount,
            "valid_end_time": c.valid_end_time.isoformat() if c.valid_end_time else None,
            "description": c.description,
            "is_exclusive": template.is_exclusive if template else (c.is_exclusive or 0),
            "is_best": False,
        }
        available.append(item)
        
        if discount > best_discount:
            best_discount = discount
            best_coupon_id = c.id
    
    # 标记最优券
    for item in available:
        if item["id"] == best_coupon_id:
            item["is_best"] = True
    
    return success({
        "available": available,
        "unavailable": unavailable,
        "best_coupon_id": best_coupon_id
    })


@app.post("/api/v1/coupons/calculate")
async def calculate_coupon_discount(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """计算优惠券优惠金额"""
    from app.models.coupon import UserCoupon
    
    coupon_id = data.get("coupon_id")
    amount = data.get("amount", 0)
    
    if not coupon_id:
        return success({"original_amount": amount, "discount_amount": 0, "pay_amount": amount})
    
    user_id = current_user.get("user_id", 1)
    
    result = await db.execute(
        select(UserCoupon).where(
            UserCoupon.id == coupon_id,
            UserCoupon.user_id == user_id,
            UserCoupon.status == 1
        )
    )
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        return {"code": 400, "message": "优惠券不存在或不可用", "data": None}
    
    if coupon.type == 4:
        return {"code": 400, "message": "礼品券不能用于订单抵扣", "data": None}
    
    discount = calculate_discount(coupon.type, float(coupon.value), amount, float(coupon.max_discount or 0))
    
    return success({
        "original_amount": amount,
        "discount_amount": discount,
        "pay_amount": max(0.01, round(amount - discount, 2))
    })


@app.post("/api/v1/coupons/{coupon_id}/use")
async def use_coupon(
    coupon_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """用户使用礼品券（核销）"""
    from app.models.coupon import UserCoupon
    
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
    result = await db.execute(
        select(UserCoupon).where(
            UserCoupon.id == coupon_id,
            UserCoupon.user_id == user_id
        )
    )
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        return {"code": 404, "message": "优惠券不存在", "data": None}
    
    if coupon.type != 4:
        return {"code": 400, "message": "仅礼品券支持此方式核销", "data": None}
    
    if coupon.status == 2:
        return {"code": 400, "message": "该礼品券已使用", "data": None}
    
    if coupon.status == 3:
        return {"code": 400, "message": "该礼品券已过期", "data": None}
    
    if coupon.status == 4:
        return {"code": 400, "message": "该礼品券已作废", "data": None}
    
    if coupon.valid_end_time < now:
        coupon.status = 3
        await db.commit()
        return {"code": 400, "message": "该礼品券已过期", "data": None}
    
    coupon.status = 2
    coupon.used_at = now
    await db.commit()
    
    return success({
        "id": coupon.id,
        "coupon_no": coupon.coupon_no,
        "used_at": coupon.used_at.isoformat()
    }, message="核销成功")


# ==================== 管理后台：优惠券模板 ====================

@app.get("/api/v1/admin/coupon-templates")
async def admin_get_coupon_templates(
    status: Optional[int] = None,
    type: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取优惠券模板列表"""
    from app.models.coupon import CouponTemplate, UserCoupon
    
    query = select(CouponTemplate)
    
    if status is not None:
        query = query.where(CouponTemplate.status == status)
    if type is not None:
        query = query.where(CouponTemplate.type == type)
    if keyword:
        query = query.where(CouponTemplate.name.contains(keyword))
    
    query = query.order_by(CouponTemplate.created_at.desc())
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    templates = result.scalars().all()
    
    data = []
    for t in templates:
        claimed_count_result = await db.execute(
            select(func.count()).where(UserCoupon.template_id == t.id)
        )
        used_count_result = await db.execute(
            select(func.count()).where(
                UserCoupon.template_id == t.id,
                UserCoupon.status == 2
            )
        )
        claimed_count = claimed_count_result.scalar()
        used_count = used_count_result.scalar()
        
        data.append({
            "id": t.id,
            "name": t.name,
            "type": t.type,
            "type_text": {1: "满减券", 2: "折扣券", 3: "立减券", 4: "礼品券"}.get(t.type, "未知"),
            "value": float(t.value),
            "min_amount": float(t.min_amount),
            "max_discount": float(t.max_discount),
            "status": t.status,
            "total_count": t.total_count,
            "claimed_count": claimed_count,
            "used_count": used_count,
            "usage_rate": f"{used_count / claimed_count * 100:.1f}%" if claimed_count > 0 else "0%",
            "source_type": t.source_type,
            "applicable_type": t.applicable_type,
            "applicable_ids": t.applicable_ids,
            "valid_type": t.valid_type,
            "valid_days": t.valid_days,
            "valid_start_time": t.valid_start_time.isoformat() if t.valid_start_time else None,
            "valid_end_time": t.valid_end_time.isoformat() if t.valid_end_time else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "description": t.description or "",
        })
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


@app.post("/api/v1/admin/coupon-templates")
async def admin_create_coupon_template(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建优惠券模板"""
    from app.models.coupon import CouponTemplate
    
    template = CouponTemplate(
        name=data.get("name"),
        type=data.get("type"),
        value=data.get("value"),
        min_amount=data.get("min_amount", 0),
        max_discount=data.get("max_discount", 0),
        total_count=data.get("total_count", 0),
        per_user_limit=data.get("per_user_limit", 1),
        valid_type=data.get("valid_type", 1),
        valid_days=data.get("valid_days", 7),
        valid_start_time=data.get("valid_start_time"),
        valid_end_time=data.get("valid_end_time"),
        applicable_type=data.get("applicable_type", 1),
        applicable_ids=data.get("applicable_ids"),
        is_exclusive=data.get("is_exclusive", 0),
        source_type=data.get("source_type", 1),
        description=data.get("description"),
        color=data.get("color", "#FF6B35"),
        status=data.get("status", 1),
    )
    db.add(template)
    await db.flush()
    await db.commit()
    
    return success({"id": template.id, "name": template.name}, message="创建成功")


@app.put("/api/v1/admin/coupon-templates/{template_id}")
async def admin_update_coupon_template(
    template_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新优惠券模板"""
    from app.models.coupon import CouponTemplate
    
    result = await db.execute(select(CouponTemplate).where(CouponTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template:
        return {"code": 404, "message": "模板不存在", "data": None}
    
    allowed_fields = [
        "name", "type", "value", "min_amount", "max_discount", "total_count",
        "per_user_limit", "valid_type", "valid_days", "valid_start_time",
        "valid_end_time", "applicable_type", "applicable_ids", "is_exclusive",
        "source_type", "description", "color", "status"
    ]
    
    for field in allowed_fields:
        if field in data:
            setattr(template, field, data[field])
    
    await db.commit()
    return success({"id": template.id}, message="更新成功")


@app.delete("/api/v1/admin/coupon-templates/{template_id}")
async def admin_delete_coupon_template(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除优惠券模板（软删除：停用）"""
    from app.models.coupon import CouponTemplate
    
    result = await db.execute(select(CouponTemplate).where(CouponTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template:
        return {"code": 404, "message": "模板不存在", "data": None}
    
    template.status = 0
    await db.commit()
    return success(message="已停用")


@app.get("/api/v1/admin/user-coupons")
async def admin_get_user_coupons(
    status: Optional[int] = None,
    type: Optional[int] = None,
    keyword: Optional[str] = None,
    user_id: Optional[int] = None,
    source_type: Optional[int] = None,
    template_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台查询用户优惠券/核销记录（含礼品券）"""
    
    where_clauses = ["1=1"]
    params: dict = {}
    
    if status is not None:
        where_clauses.append("uc.status = :status")
        params["status"] = status
    if type is not None:
        where_clauses.append("uc.type = :type")
        params["type"] = type
    if user_id is not None:
        where_clauses.append("uc.user_id = :user_id")
        params["user_id"] = user_id
    if source_type is not None:
        where_clauses.append("uc.source_type = :source_type")
        params["source_type"] = source_type
    if template_id is not None:
        where_clauses.append("uc.template_id = :template_id")
        params["template_id"] = template_id
    if keyword:
        where_clauses.append("(uc.name LIKE :keyword OR uc.coupon_no LIKE :keyword OR u.nickname LIKE :keyword OR u.phone LIKE :keyword)")
        params["keyword"] = f"%{keyword}%"
    
    where_sql = " AND ".join(where_clauses)
    
    # 查询总数
    count_sql = f"""
        SELECT COUNT(*) 
        FROM user_coupons uc
        LEFT JOIN users u ON uc.user_id = u.id
        WHERE {where_sql}
    """
    total_result = await db.execute(text(count_sql), params)
    total = total_result.scalar() or 0
    
    # 查询列表
    list_sql = f"""
        SELECT 
            uc.id, uc.coupon_no, uc.name, uc.type, uc.value, uc.min_amount,
            uc.status, uc.valid_start_time, uc.valid_end_time, uc.used_at,
            uc.used_order_id, uc.source_type, uc.user_id, uc.created_at, uc.template_id,
            u.nickname, u.phone,
            o.order_no
        FROM user_coupons uc
        LEFT JOIN users u ON uc.user_id = u.id
        LEFT JOIN orders o ON uc.used_order_id = o.id
        WHERE {where_sql}
        ORDER BY uc.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    query_params = {**params, "limit": page_size, "offset": (page - 1) * page_size}
    result = await db.execute(text(list_sql), query_params)
    rows = result.mappings().all()
    
    data = []
    for row in rows:
        data.append({
            "id": row["id"],
            "coupon_no": row["coupon_no"],
            "name": row["name"],
            "type": row["type"],
            "type_text": {1: "满减券", 2: "折扣券", 3: "立减券", 4: "礼品券"}.get(row["type"], "未知"),
            "value": float(row["value"] or 0),
            "min_amount": float(row["min_amount"] or 0),
            "status": row["status"],
            "status_text": {1: "未使用", 2: "已使用", 3: "已过期", 4: "已作废"}.get(row["status"], "未知"),
            "valid_start_time": row["valid_start_time"].isoformat() if row["valid_start_time"] else None,
            "valid_end_time": row["valid_end_time"].isoformat() if row["valid_end_time"] else None,
            "used_at": row["used_at"].isoformat() if row["used_at"] else None,
            "used_order_id": row["used_order_id"],
            "order_no": row["order_no"],
            "source_type": row["source_type"],
            "source_type_text": {1: "通用", 2: "会员购买赠送", 3: "会员每月发放", 4: "管理后台发放"}.get(row["source_type"], "未知"),
            "template_id": row["template_id"],
            "user_id": row["user_id"],
            "nickname": row["nickname"],
            "phone": row["phone"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        })
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


# ==================== 会员购买订单模块 ====================

@app.post("/api/v1/member/orders")
async def create_member_order(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建会员购买订单"""
    from app.models.coupon import UserCoupon
    
    user_id = current_user.get("user_id", 1)
    plan_id = data.get("plan_id")
    
    if not plan_id:
        return {"code": 400, "message": "缺少plan_id", "data": None}
    
    # 查询套餐信息（通过 user-service 或本地查询）
    # 由于跨服务，这里使用 SQL 直接查询（两个服务共享数据库）
    plan_result = await db.execute(
        text("SELECT * FROM member_plans WHERE id = :plan_id AND status = 1"),
        {"plan_id": plan_id}
    )
    plan = plan_result.mappings().one_or_none()
    
    if not plan:
        return {"code": 404, "message": "套餐不存在或已下架", "data": None}
    
    # 检查是否已有生效中会员
    membership_result = await db.execute(
        text("SELECT * FROM user_memberships WHERE user_id = :user_id AND status = 1"),
        {"user_id": user_id}
    )
    existing_membership = membership_result.mappings().one_or_none()
    
    order_no = generate_member_order_no()
    
    platform = data.get("platform", "")
    
    # 创建订单
    await db.execute(
        text("""
            INSERT INTO member_orders 
            (order_no, user_id, plan_id, original_price, discount_amount, pay_amount, status, platform, created_at, updated_at)
            VALUES 
            (:order_no, :user_id, :plan_id, :original_price, :discount_amount, :pay_amount, 10, :platform, NOW(), NOW())
        """),
        {
            "order_no": order_no,
            "user_id": user_id,
            "plan_id": plan_id,
            "original_price": plan["original_price"],
            "discount_amount": float(plan["original_price"]) - float(plan["sale_price"]),
            "pay_amount": plan["sale_price"],
            "platform": platform,
        }
    )
    await db.commit()
    
    # 获取订单ID
    order_result = await db.execute(
        text("SELECT id FROM member_orders WHERE order_no = :order_no"),
        {"order_no": order_no}
    )
    order_id = order_result.scalar()
    
    return success({
        "order_id": order_id,
        "order_no": order_no,
        "plan_name": plan["name"],
        "pay_amount": float(plan["sale_price"]),
        "has_existing_membership": existing_membership is not None,
    })


@app.get("/api/v1/member/orders/{order_id}")
async def get_member_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """查询会员购买订单"""
    user_id = current_user.get("user_id", 1)
    
    order_result = await db.execute(
        text("SELECT * FROM member_orders WHERE id = :order_id AND user_id = :user_id"),
        {"order_id": order_id, "user_id": user_id}
    )
    order = order_result.mappings().one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    # 查询已发放的消费券
    coupon_result = await db.execute(
        text("""
            SELECT id, name, status, valid_end_time FROM user_coupons 
            WHERE user_id = :user_id AND source_type = 2 AND source_id = :order_id
        """),
        {"user_id": user_id, "order_id": order_id}
    )
    coupons = [dict(row) for row in coupon_result.mappings().all()]
    
    return success({
        "order_id": order["id"],
        "order_no": order["order_no"],
        "status": order["status"],
        "plan_name": None,  # 可补充查询
        "pay_amount": float(order["pay_amount"]),
        "pay_time": order["pay_time"].isoformat() if order["pay_time"] else None,
        "issued_coupons": coupons,
    })


@app.post("/api/v1/member/orders/{order_id}/pay")
async def pay_member_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """会员订单支付 - 调用微信支付"""
    import httpx
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    order_result = await db.execute(
        text("SELECT * FROM member_orders WHERE id = :order_id AND user_id = :user_id"),
        {"order_id": order_id, "user_id": user_id}
    )
    order = order_result.mappings().one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    if order["status"] != 10:
        return {"code": 400, "message": "订单状态不允许支付", "data": None}
    
    # 查询用户openid和session_key
    user_result = await db.execute(
        text("SELECT openid, session_key FROM users WHERE id = :user_id"),
        {"user_id": user_id}
    )
    user_row = user_result.mappings().one_or_none()
    openid = user_row["openid"] if user_row else current_user.get("openid", "")
    session_key = user_row["session_key"] if user_row else ""
    
    if not openid:
        return {"code": 400, "message": "用户未绑定微信，无法发起支付", "data": None}
    
    # 查询套餐信息
    plan_result = await db.execute(
        text("SELECT * FROM member_plans WHERE id = :plan_id"),
        {"plan_id": order["plan_id"]}
    )
    plan = plan_result.mappings().one_or_none()
    plan_name = plan["name"] if plan else "会员套餐"
    product_id = plan["product_id"] if plan else None
    
    # 调用 pay-service 创建普通微信支付订单
    # 使用业务订单号作为微信商户单号，确保微信支付后台和系统订单号一致
    pay_service_url = os.getenv("PAY_SERVICE_URL", "http://localhost:8006")
    pay_payload = {
        "order_no": order["order_no"],
        "amount": float(order["pay_amount"]),
        "description": f"尾巴旅行-{plan_name}",
        "method": "wechat_jsapi",
        "openid": openid,
        "out_trade_no": order["order_no"]
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            pay_response = await client.post(
                f"{pay_service_url}/api/v1/pay/create",
                json=pay_payload,
                headers={"Authorization": f"Bearer {current_user.get('token', '')}"}
            )
            pay_result = pay_response.json()
    except Exception as e:
        logger.error(f"Call pay-service create payment failed: {e}")
        return {"code": 500, "message": f"支付服务调用失败: {str(e)}"}
    
    if pay_result.get("code") != 200:
        return {"code": 500, "message": pay_result.get("message", "支付下单失败")}
    
    pay_data = pay_result.get("data", {})
    return success({
        "pay_order_no": pay_data.get("pay_order_no"),
        "pay_params": pay_data.get("pay_params"),
        "mock": pay_data.get("mock", False)
    })


@app.get("/api/v1/admin/member-orders")
async def admin_get_member_orders(
    keyword: Optional[str] = None,
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取会员订单列表"""
    try:
        where_clauses = ["1=1"]
        params: dict = {}

        if status is not None:
            where_clauses.append("mo.status = :status")
            params["status"] = status

        if keyword:
            where_clauses.append("(mo.order_no LIKE :keyword OR u.nickname LIKE :keyword OR u.phone LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"

        where_sql = " AND ".join(where_clauses)

        count_sql = f"""
            SELECT COUNT(*)
            FROM member_orders mo
            LEFT JOIN users u ON mo.user_id = u.id
            LEFT JOIN member_plans mp ON mo.plan_id = mp.id
            WHERE {where_sql}
        """
        total_result = await db.execute(text(count_sql), params)
        total = total_result.scalar() or 0

        list_sql = f"""
            SELECT
                mo.id, mo.order_no, mo.user_id, mo.plan_id, mo.original_price,
                mo.discount_amount, mo.pay_amount, mo.status, mo.pay_time,
                mo.pay_channel, mo.pay_trade_no, mo.platform, mo.refund_amount, mo.refund_time,
                mo.created_at, mo.updated_at,
                u.nickname, u.phone, u.avatar,
                mp.name as plan_name
            FROM member_orders mo
            LEFT JOIN users u ON mo.user_id = u.id
            LEFT JOIN member_plans mp ON mo.plan_id = mp.id
            WHERE {where_sql}
            ORDER BY mo.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size

        result = await db.execute(text(list_sql), params)
        rows = result.mappings().all()

        orders = []
        for row in rows:
            orders.append({
                "id": row.id,
                "order_no": row.order_no,
                "user_id": row.user_id,
                "nickname": row.nickname,
                "phone": row.phone,
                "avatar": row.avatar,
                "plan_id": row.plan_id,
                "plan_name": row.plan_name,
                "original_price": float(row.original_price) if row.original_price else 0,
                "discount_amount": float(row.discount_amount) if row.discount_amount else 0,
                "pay_amount": float(row.pay_amount) if row.pay_amount else 0,
                "status": row.status,
                "pay_time": row.pay_time.isoformat() if row.pay_time else None,
                "pay_channel": row.pay_channel,
                "pay_trade_no": row.pay_trade_no,
                "platform": row.platform,
                "refund_amount": float(row.refund_amount) if row.refund_amount else 0,
                "refund_time": row.refund_time.isoformat() if row.refund_time else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })

        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "list": orders
        })
    except Exception as e:
        logger.error(f"Error getting member orders: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/member-orders/{order_id}/refund")
async def admin_refund_member_order(
    order_id: int,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """管理后台会员订单退款"""
    try:
        order_result = await db.execute(
            text("SELECT * FROM member_orders WHERE id = :order_id"),
            {"order_id": order_id}
        )
        order = order_result.mappings().one_or_none()

        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}

        if order.status != 20:
            return {"code": 400, "message": "订单不是已支付状态，无法退款", "data": None}

        now = datetime.now()

        # 调用 pay-service 退款（统一走普通微信支付退款）
        # 使用业务订单号作为 out_trade_no，确保微信支付能找到订单
        pay_service_url = os.getenv("PAY_SERVICE_URL", "http://localhost:8006")
        refund_payload = {
            "order_no": order.order_no,
            "refund_amount": float(order.pay_amount),
            "reason": "管理员后台退款",
            "total_amount": float(order.pay_amount),
            "out_trade_no": order.order_no
        }

        headers = {}
        if authorization:
            headers["Authorization"] = authorization

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                pay_response = await client.post(
                    f"{pay_service_url}/api/v1/pay/refund",
                    json=refund_payload,
                    headers=headers
                )
                pay_result = pay_response.json()
        except Exception as e:
            logger.error(f"Call pay-service refund failed: {e}")
            return {"code": 500, "message": f"退款服务调用失败: {str(e)}", "data": None}

        if pay_result.get("code") != 200:
            logger.error(f"Pay-service refund error: {pay_result}")
            return {"code": 500, "message": f"退款失败: {pay_result.get('message', '退款服务返回错误')}", "data": None}

        # 更新订单状态为已退款
        await db.execute(
            text("""
                UPDATE member_orders
                SET status = 40, refund_amount = :pay_amount, refund_time = :now, updated_at = :now
                WHERE id = :order_id
            """),
            {"order_id": order_id, "pay_amount": float(order.pay_amount), "now": now}
        )

        # 更新会员状态为已退款
        await db.execute(
            text("""
                UPDATE user_memberships
                SET status = 3, updated_at = :now
                WHERE order_id = :order_id
            """),
            {"order_id": order_id, "now": now}
        )

        # 将会员订单发放的未使用优惠券作废（status=4 已作废）
        coupon_result = await db.execute(
            text("""
                SELECT id, status FROM user_coupons 
                WHERE user_id = :user_id AND source_type = 2 AND source_id = :order_id
            """),
            {"user_id": order.user_id, "order_id": order_id}
        )
        coupons = coupon_result.mappings().all()
        invalidated_count = 0
        for c in coupons:
            if c.status == 1:  # 仅作废未使用的券
                await db.execute(
                    text("UPDATE user_coupons SET status = 4, updated_at = :now WHERE id = :id"),
                    {"id": c.id, "now": now}
                )
                invalidated_count += 1
        if coupons:
            logger.info(f"Member order refund: invalidated {invalidated_count}/{len(coupons)} coupons for order {order_id}")

        await db.commit()

        return success({
            "order_id": order_id,
            "status": 40,
            "refund_time": now.isoformat()
        }, message="退款成功")
    except Exception as e:
        logger.error(f"Error refunding member order: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"退款失败: {str(e)}", "data": None}


