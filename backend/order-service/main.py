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
from sqlalchemy import select, func, text
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


def generate_verify_code(order_no: str) -> str:
    """生成订单核销码（HMAC-SHA256）"""
    return hmac.new(
        VERIFY_SECRET.encode('utf-8'),
        order_no.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()[:16].upper()


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
                        SELECT id, order_no, schedule_id, participant_count 
                        FROM orders 
                        WHERE status = 10 AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                    """)
                )
                expired_orders = result.mappings().all()
                
                for row in expired_orders:
                    order_id = row["id"]
                    schedule_id = row["schedule_id"]
                    quantity = row["participant_count"]
                    order_no = row["order_no"]
                    
                    # 取消订单
                    await db.execute(
                        text("UPDATE orders SET status = 30, updated_at = NOW() WHERE id = :order_id"),
                        {"order_id": order_id}
                    )
                    
                    # 恢复库存
                    if schedule_id and quantity:
                        await db.execute(
                            text("""
                                UPDATE route_schedules 
                                SET stock = stock + :quantity, sold = sold - :quantity 
                                WHERE id = :schedule_id
                            """),
                            {"schedule_id": schedule_id, "quantity": quantity}
                        )
                    
                    await db.commit()
                    logger.info(f"Auto cancelled expired order: {order_no}, restored stock for schedule {schedule_id}")
        except Exception as e:
            logger.error(f"Auto cancel task error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    # 启动自动取消任务
    asyncio.create_task(auto_cancel_expired_orders())
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
    
    orders = []
    for o in orders_db:
        orders.append({
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "route_id": o.route_id,
            "route_name": o.route_name,
            "route_cover": o.route_cover,
            "travel_date": o.travel_date.isoformat(),
            "participant_count": o.participant_count,
            "pet_count": o.pet_count,
            "participants": o.participants or [],
            "pets": o.pets or [],
            "contact": o.contact or {},
            "route_price": float(o.route_price),
            "insurance_price": float(o.insurance_price),
            "addon_amount": float(o.addon_amount),
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
    
    order = {
        "id": o.id,
        "order_no": o.order_no,
        "user_id": o.user_id,
        "schedule_id": o.schedule_id,
        "route_id": o.route_id,
        "route_name": o.route_name,
        "route_cover": o.route_cover,
        "travel_date": o.travel_date.isoformat(),
        "participant_count": o.participant_count,
        "pet_count": o.pet_count,
        "participants": o.participants or [],
        "pets": o.pets or [],
        "contact": o.contact or {},
        "route_price": float(o.route_price),
        "insurance_price": float(o.insurance_price),
        "equipment_price": float(o.equipment_price),
        "addon_amount": float(o.addon_amount),
        "addons": o.addons or [],
        "total_amount": float(o.total_amount),
        "discount_amount": float(o.discount_amount),
        "pay_amount": float(o.pay_amount),
        "status": o.status,
        "status_name": STATUS_MAP.get(o.status, "未知"),
        "pay_time": o.pay_time.isoformat() if o.pay_time else None,
        "pay_channel": o.pay_channel,
        "remark": o.remark,
        "order_time": o.created_at.isoformat(),
        "created_at": o.created_at.isoformat(),
        "qrcode": o.qrcode,
        "guide_info": o.guide_info or {},
        "refund_reject_reason": o.refund_reject_reason
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
    
    # 计算金额
    total_amount = (data.route_price + 
                   data.insurance_price + 
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
            # 校验有效期
            now = datetime.now()
            if coupon.valid_start_time <= now <= coupon.valid_end_time:
                # 校验金额门槛
                if float(coupon.min_amount) <= total_amount:
                    # 校验适用范围
                    applicable = True
                    if coupon.applicable_type == 2 and coupon.applicable_ids:
                        if data.route_id not in coupon.applicable_ids:
                            applicable = False
                    
                    if applicable:
                        discount_amount = calculate_discount(
                            coupon.type, float(coupon.value), total_amount, float(coupon.max_discount or 0)
                        )
                        coupon_name = coupon.name
                    else:
                        coupon_id = None
                else:
                    coupon_id = None
            else:
                coupon_id = None
        else:
            coupon_id = None
    
    pay_amount = max(0.01, round(total_amount - discount_amount, 2))
    
    # 生成订单号
    order_no = generate_order_no()
    
    # 解析日期
    try:
        travel_date = date.fromisoformat(data.travel_date)
    except:
        travel_date = date.today()
    
    # 校验并扣减库存
    quantity = data.participant_count or 1
    stock_result = await db.execute(
        text("""
            UPDATE route_schedules 
            SET stock = stock - :quantity, sold = sold + :quantity 
            WHERE id = :schedule_id AND stock >= :quantity
        """),
        {"schedule_id": data.schedule_id, "quantity": quantity}
    )
    
    if stock_result.rowcount == 0:
        raise BadRequestException("该排期库存不足或已售罄，请选择其他日期")
    
    # 创建订单
    order = Order(
        order_no=order_no,
        user_id=user_id,
        schedule_id=data.schedule_id,
        route_id=data.route_id,
        route_name=data.route_name,
        travel_date=travel_date,
        participant_count=data.participant_count,
        pet_count=data.pet_count,
        participants=data.participants,
        pets=data.pets,
        contact=data.contact,
        route_price=data.route_price,
        insurance_price=data.insurance_price,
        equipment_price=data.equipment_price,
        addon_amount=data.addon_amount,
        addons=data.addons,
        total_amount=total_amount,
        discount_amount=discount_amount,
        coupon_id=coupon_id,
        coupon_name=coupon_name,
        pay_amount=pay_amount,
        status=10,
        qrcode=generate_verify_code(order_no)
    )
    
    db.add(order)
    await db.flush()
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
                "quantity": data.participant_count
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
    """发起支付并模拟支付成功（更新订单状态）"""
    from app.models.order import Order
    
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
    
    # 模拟支付成功 - 更新订单状态
    from datetime import datetime
    order.status = 20  # 待出行
    order.pay_time = datetime.now()
    order.pay_channel = "wechat"
    order.pay_trade_no = f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # 核销优惠券
    if order.coupon_id:
        from app.models.coupon import UserCoupon
        coupon_result = await db.execute(
            select(UserCoupon).where(UserCoupon.id == order.coupon_id)
        )
        coupon = coupon_result.scalar_one_or_none()
        if coupon:
            coupon.status = 2  # 已使用
            coupon.used_order_id = order.id
            coupon.used_at = datetime.now()
    
    await db.flush()
    await db.commit()
    
    logger.info(f"Order paid: {order.order_no}, id: {order_id}, user: {user_id}")
    
    # 返回支付参数（模拟）
    time_stamp = str(int(datetime.now().timestamp()))
    nonce_str = ''.join(__import__('random').choices(__import__('string').ascii_letters + __import__('string').digits, k=32))
    
    return success({
        "appId": settings.wechat.appid or "wx_test_appid",
        "timeStamp": time_stamp,
        "nonceStr": nonce_str,
        "package": "prepay_id=wx_test_prepayid",
        "signType": "RSA",
        "paySign": "test_signature",
        "message": "支付成功"
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
    
    if order.status != 10:  # 只能取消待支付订单
        return success({"message": "订单状态不允许取消"})
    
    # 恢复库存
    if order.schedule_id and order.participant_count:
        await db.execute(
            text("""
                UPDATE route_schedules 
                SET stock = stock + :quantity, sold = sold - :quantity 
                WHERE id = :schedule_id
            """),
            {"schedule_id": order.schedule_id, "quantity": order.participant_count}
        )
    
    order.status = 30  # 已取消
    await db.flush()
    await db.commit()
    
    logger.info(f"Order cancelled: {order_id}, stock restored for schedule {order.schedule_id}")
    return success({"message": "取消成功，库存已释放"})

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
    
    # 只能对待出行或退款驳回的订单申请退款
    if order.status not in [20, 45]:
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
        # 查询订单
        result = await db.execute(select(Order).where(Order.order_no == order_no))
        order = result.scalar_one_or_none()
        
        if not order:
            logger.error(f"Pay callback order not found: {order_no}")
            return {"code": "FAIL", "message": "Order not found"}
        
        # 只能更新待支付订单
        if order.status != 10:
            logger.warning(f"Pay callback order status invalid: {order_no}, status={order.status}")
            return {"code": "SUCCESS", "message": "Order already processed"}
        
        # 更新订单状态
        order.status = 20  # 待出行
        order.pay_time = datetime.now()
        order.pay_channel = pay_channel
        order.pay_trade_no = transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        await db.commit()
        
        logger.info(f"Order paid via callback: {order_no}, id={order.id}")
        
        # TODO: 扣减排期库存（如需恢复库存管理，调用 route-service 扣减库存）
        # TODO: 发送支付成功通知（短信/推送）
        
    except Exception as e:
        logger.error(f"Pay callback processing error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": "FAIL", "message": "Internal error"}
    
    return {"code": "SUCCESS", "message": "OK"}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/orders")
async def admin_get_orders(
    status: Optional[int] = None,
    order_no: Optional[str] = None,
    user_id: Optional[int] = None,
    route_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取订单列表"""
    try:
        from app.models.order import Order
        from sqlalchemy import and_
        
        query = select(Order)
        
        # 筛选条件
        if status:
            query = query.where(Order.status == status)
        if order_no:
            query = query.where(Order.order_no.contains(order_no))
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
        
        orders = []
        for o in orders_db:
            orders.append({
                "id": o.id,
                "order_no": o.order_no,
                "user_id": o.user_id,
                "route_id": o.route_id,
                "route_name": o.route_name,
                "route_cover": o.route_cover,
                "travel_date": o.travel_date.isoformat() if o.travel_date else None,
                "participant_count": o.participant_count,
                "pet_count": o.pet_count,
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


@app.get("/api/v1/admin/orders/{order_id}")
async def admin_get_order_detail(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取订单详情"""
    try:
        from app.models.order import Order
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        o = result.scalar_one_or_none()
        
        if not o:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        order = {
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "route_id": o.route_id,
            "route_name": o.route_name,
            "route_cover": o.route_cover,
            "travel_date": o.travel_date.isoformat() if o.travel_date else None,
            "participant_count": o.participant_count,
            "pet_count": o.pet_count,
            "participants": o.participants,
            "contact": o.contact,
            "route_price": float(o.route_price) if o.route_price else 0,
            "insurance_price": float(o.insurance_price) if o.insurance_price else 0,
            "discount_amount": float(o.discount_amount) if o.discount_amount else 0,
            "pay_amount": float(o.pay_amount) if o.pay_amount else 0,
            "status": o.status,
            "status_name": STATUS_MAP.get(o.status, "未知"),
            "pay_time": o.pay_time.isoformat() if o.pay_time else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
            "refund_reject_reason": o.refund_reject_reason,
        }
        
        return success(order)
    except Exception as e:
        logger.error(f"Error getting order detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/orders/{order_id}/refund")
async def admin_refund_order(
    order_id: int,
    refund_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台订单退款"""
    try:
        from app.models.order import Order
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        # 检查订单状态是否允许退款
        if order.status not in [20, 60, 70]:  # 待出行、已完成、已评价
            return {"code": 400, "message": "当前订单状态不允许退款", "data": None}
        
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
        
        # TODO: 调用微信支付退款接口
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
        
        # 查询退款中(40)、退款驳回(45)或已退款(50)的订单
        query = select(Order).where(Order.status.in_([40, 45, 50]))
        
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


@app.post("/api/v1/admin/refunds/{order_id}/approve")
async def admin_approve_refund(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """审核通过退款"""
    try:
        from app.models.order import Order
        from datetime import datetime
        
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            return {"code": 404, "message": "订单不存在", "data": None}
        
        if order.status != 40:
            return {"code": 400, "message": "订单不是退款中状态", "data": None}
        
        # 更新为已退款状态
        order.status = 50
        order.refund_time = datetime.now()
        await db.commit()
        
        return success({
            "order_id": order_id,
            "status": 50,
            "refund_time": order.refund_time.isoformat()
        }, message="退款审核通过")
    except Exception as e:
        logger.error(f"Error approving refund: {e}")
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
        total_users_result = await db.execute(text("SELECT COUNT(*) FROM users WHERE status = 1"))
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
    """计算优惠金额"""
    if coupon_type == 1:  # 满减券
        return min(value, order_amount)
    elif coupon_type == 2:  # 折扣券
        discount = order_amount * (1 - value)
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
    from app.models.coupon import UserCoupon
    
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
    
    now = datetime.now()
    data = []
    for c in coupons:
        item = {
            "id": c.id,
            "coupon_no": c.coupon_no,
            "name": c.name,
            "type": c.type,
            "type_text": {1: "满减券", 2: "折扣券", 3: "立减券"}.get(c.type, "未知"),
            "value": float(c.value),
            "min_amount": float(c.min_amount),
            "valid_start_time": c.valid_start_time.isoformat() if c.valid_start_time else None,
            "valid_end_time": c.valid_end_time.isoformat() if c.valid_end_time else None,
            "status": c.status,
            "status_text": {1: "未使用", 2: "已使用", 3: "已过期", 4: "已作废"}.get(c.status, "未知"),
            "is_expired_soon": c.valid_end_time and (c.valid_end_time - now).days <= 3 if c.status == 1 else False,
            "source_type": c.source_type,
            "used_order_id": c.used_order_id,
        }
        data.append(item)
    
    return success({"list": data, "total": total, "page": page, "page_size": page_size})


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
    amount: float,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取订单可用优惠券"""
    from app.models.coupon import UserCoupon
    
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
    result = await db.execute(
        select(UserCoupon).where(
            UserCoupon.user_id == user_id,
            UserCoupon.status == 1,
            UserCoupon.valid_start_time <= now,
            UserCoupon.valid_end_time >= now
        ).order_by(UserCoupon.value.desc())
    )
    coupons = result.scalars().all()
    
    available = []
    unavailable = []
    best_coupon_id = None
    best_discount = 0
    
    # 查询当前路线的类型（用于路线类型校验）
    route_type = None
    try:
        from app.models.route import Route
        route_result = await db.execute(select(Route.route_type).where(Route.id == route_id))
        route_type = route_result.scalar()
    except Exception:
        pass
    
    for c in coupons:
        # 检查金额门槛
        if c.min_amount > 0 and amount < float(c.min_amount):
            unavailable.append({
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "value": float(c.value),
                "reason": f"订单金额未满{c.min_amount}元"
            })
            continue
        
        # 检查适用范围
        if c.applicable_type == 2 and c.applicable_ids:
            # 指定路线
            if route_id not in (c.applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前路线"
                })
                continue
        elif c.applicable_type == 3 and c.applicable_ids:
            # 指定路线类型
            if route_type is None or route_type not in (c.applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前路线类型"
                })
                continue
        elif c.applicable_type == 4 and c.applicable_ids:
            # 指定用户（理论上已过滤，兜底校验）
            if user_id not in (c.applicable_ids or []):
                unavailable.append({
                    "id": c.id,
                    "name": c.name,
                    "type": c.type,
                    "value": float(c.value),
                    "reason": "不适用当前用户"
                })
                continue
        
        discount = calculate_discount(c.type, float(c.value), amount, float(c.max_discount or 0))
        
        item = {
            "id": c.id,
            "coupon_no": c.coupon_no,
            "name": c.name,
            "type": c.type,
            "value": float(c.value),
            "min_amount": float(c.min_amount),
            "discount_amount": discount,
            "valid_end_time": c.valid_end_time.isoformat() if c.valid_end_time else None,
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
    
    discount = calculate_discount(coupon.type, float(coupon.value), amount, float(coupon.max_discount or 0))
    
    return success({
        "original_amount": amount,
        "discount_amount": discount,
        "pay_amount": max(0.01, round(amount - discount, 2))
    })


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
            "type_text": {1: "满减券", 2: "折扣券", 3: "立减券"}.get(t.type, "未知"),
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
    
    # 创建订单
    await db.execute(
        text("""
            INSERT INTO member_orders 
            (order_no, user_id, plan_id, original_price, discount_amount, pay_amount, status, created_at, updated_at)
            VALUES 
            (:order_no, :user_id, :plan_id, :original_price, :discount_amount, :pay_amount, 10, NOW(), NOW())
        """),
        {
            "order_no": order_no,
            "user_id": user_id,
            "plan_id": plan_id,
            "original_price": plan["original_price"],
            "discount_amount": float(plan["original_price"]) - float(plan["sale_price"]),
            "pay_amount": plan["sale_price"],
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
    """会员订单支付（模拟支付成功）"""
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
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
    
    # 查询套餐
    plan_result = await db.execute(
        text("SELECT * FROM member_plans WHERE id = :plan_id"),
        {"plan_id": order["plan_id"]}
    )
    plan = plan_result.mappings().one_or_none()
    
    # 更新订单状态
    await db.execute(
        text("""
            UPDATE member_orders 
            SET status = 20, pay_time = NOW(), pay_channel = 'wechat', pay_trade_no = :trade_no, updated_at = NOW()
            WHERE id = :order_id
        """),
        {"order_id": order_id, "trade_no": f"WX{now.strftime('%Y%m%d%H%M%S')}"}
    )
    
    # 检查是否已有生效会员，如果有则续期
    membership_result = await db.execute(
        text("SELECT * FROM user_memberships WHERE user_id = :user_id AND status = 1"),
        {"user_id": user_id}
    )
    existing = membership_result.mappings().one_or_none()
    
    if existing:
        # 续期：在原有结束日期上增加
        new_end = existing["end_date"] + timedelta(days=plan["duration_days"])
        await db.execute(
            text("""
                UPDATE user_memberships 
                SET end_date = :end_date, order_id = :order_id, pay_amount = :pay_amount, 
                    benefit_snapshot = :benefit_snapshot, updated_at = NOW()
                WHERE id = :membership_id
            """),
            {
                "end_date": new_end,
                "order_id": order_id,
                "pay_amount": order["pay_amount"],
                "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                "membership_id": existing["id"],
            }
        )
    else:
        # 新建会员
        await db.execute(
            text("""
                INSERT INTO user_memberships 
                (user_id, plan_id, status, start_date, end_date, order_id, pay_amount, benefit_snapshot, created_at, updated_at)
                VALUES 
                (:user_id, :plan_id, 1, :start_date, :end_date, :order_id, :pay_amount, :benefit_snapshot, NOW(), NOW())
            """),
            {
                "user_id": user_id,
                "plan_id": order["plan_id"],
                "start_date": date.today(),
                "end_date": date.today() + timedelta(days=plan["duration_days"] if plan else 30),
                "order_id": order_id,
                "pay_amount": order["pay_amount"],
                "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
            }
        )
    
    # 发放消费券
    if plan and plan["coupon_package"]:
        coupon_package = plan["coupon_package"]
        if isinstance(coupon_package, str):
            coupon_package = json.loads(coupon_package)
        
        templates = coupon_package.get("templates", [])
        for item in templates:
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
                    text("""
                        INSERT INTO user_coupons 
                        (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount,
                         applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, created_at)
                        VALUES 
                        (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount,
                         :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, NOW())
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
                        "valid_start": now,
                        "valid_end": now + timedelta(days=valid_days),
                        "source_id": order_id,
                    }
                )
    
    await db.commit()
    
    return success({
        "order_id": order_id,
        "status": 20,
        "message": "支付成功"
    })


