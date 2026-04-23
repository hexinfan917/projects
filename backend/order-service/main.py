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
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.dependencies import get_current_user
from common.database import get_db, AsyncSessionLocal
from common.response import success

settings.app_name = "order-service"
settings.app_port = 8003
logger = setup_logger("order-service")

# 核销密钥（应与环境变量或配置中心同步）
VERIFY_SECRET = os.getenv("ORDER_VERIFY_SECRET", "quandouxing-verify-secret-2024")


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

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}

# 状态映射
STATUS_MAP = {
    10: "待支付",
    20: "待出行",
    30: "已取消",
    40: "退款中",
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
            "pay_amount": float(o.pay_amount),
            "status": o.status,
            "status_name": STATUS_MAP.get(o.status, "未知"),
            "pay_time": o.pay_time.isoformat() if o.pay_time else None,
            "order_time": o.created_at.isoformat(),
            "created_at": o.created_at.isoformat()
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
        "guide_info": o.guide_info or {}
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
    
    user_id = current_user.get("user_id", 1)
    
    # 计算金额
    total_amount = (data.route_price + 
                   data.insurance_price + 
                   data.equipment_price)
    pay_amount = max(0, total_amount - data.discount_amount)
    
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
        raise HTTPException(status_code=400, detail="该排期库存不足或已售罄，请选择其他日期")
    
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
        total_amount=total_amount,
        discount_amount=data.discount_amount,
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
        raise HTTPException(status_code=400, detail=f"订单状态不允许支付，当前状态:{order.status}")
    
    # 模拟支付成功 - 更新订单状态
    from datetime import datetime
    order.status = 20  # 待出行
    order.pay_time = datetime.now()
    order.pay_channel = "wechat"
    order.pay_trade_no = f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
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
    current_user: dict = Depends(get_current_user)
):
    """申请退款"""
    refund_amount = data.get("amount", 199)
    reason = data.get("reason", "")
    
    logger.info(f"Refund request: order={order_id}, amount={refund_amount}, reason={reason}")
    
    return success({
        "refund_id": f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "refund_amount": refund_amount,
        "status": "processing",
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
        elif status in [40, 50]:
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
        
        # 查询退款中的订单(40)或已退款的订单(50)
        query = select(Order).where(Order.status.in_([40, 50]))
        
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
        
        # 恢复到待出行状态(20)
        order.status = 20
        order.refund_amount = 0
        order.refund_reason = f"拒绝原因: {data.get('reason', '无')}"
        await db.commit()
        
        return success({
            "order_id": order_id,
            "status": 20
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
