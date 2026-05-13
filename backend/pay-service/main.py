"""
支付服务 - Pay Service
端口: 8006
职责: 支付通道/对账/分账
"""
import sys
import os
import json
import hashlib
import hmac
import base64
import random
import string
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict
import uuid

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends, Header, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import httpx
from common.config import settings
from common.redis_client import redis_client
from common.database import AsyncSessionLocal
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.dependencies import get_current_user
from common.response import success
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

settings.app_name = "pay-service"
settings.app_port = 8006
logger = setup_logger("pay-service")

# 微信支付配置
WECHAT_PAY_CONFIG = {
    "appid": settings.wechat.appid or os.getenv("WECHAT_APPID", ""),
    "mchid": settings.wechat.mchid or os.getenv("WECHAT_MCHID", ""),
    "apikey": settings.wechat.apikey or os.getenv("WECHAT_APIKEY", ""),
    "notify_url": os.getenv("WECHAT_NOTIFY_URL", "https://your-domain.com/api/v1/pay/notify"),
    "sandbox": os.getenv("WECHAT_PAY_SANDBOX", "true").lower() == "true"
}

# 支付方式
PAYMENT_METHODS = {
    "wechat_jsapi": "微信支付-JSAPI",
    "wechat_native": "微信支付-Native",
    "wechat_h5": "微信支付-H5",
    "alipay": "支付宝",
    "mock": "模拟支付"
}


def generate_nonce_str(length=32):
    """生成随机字符串"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


def generate_out_trade_no():
    """生成商户订单号"""
    return f"{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8].upper()}"


def generate_sign(params: dict, key: str, sign_type: str = "MD5"):
    """
    生成微信支付签名
    
    Args:
        params: 参数字典
        key: API密钥
        sign_type: 签名类型 (MD5 或 RSA)
    """
    # 过滤空值和 sign 字段
    filtered_params = {k: v for k, v in params.items() if v is not None and k != "sign"}
    # 按参数名ASCII码从小到大排序
    sorted_params = sorted(filtered_params.items())
    # 拼接成字符串
    string_a = '&'.join([f"{k}={v}" for k, v in sorted_params])
    string_sign_temp = f"{string_a}&key={key}"
    
    if sign_type == "MD5":
        return hashlib.md5(string_sign_temp.encode('utf-8')).hexdigest().upper()
    elif sign_type == "HMAC-SHA256":
        return hmac.new(key.encode('utf-8'), string_sign_temp.encode('utf-8'), 
                       hashlib.sha256).hexdigest().upper()
    else:
        raise ValueError(f"Unsupported sign_type: {sign_type}")


def build_wechat_pay_params(prepay_id: str, appid: str, key: str) -> dict:
    """
    构建前端调起微信支付所需的参数
    """
    time_stamp = str(int(datetime.now().timestamp()))
    nonce_str = generate_nonce_str()
    package = f"prepay_id={prepay_id}"
    
    # 构造签名参数
    sign_params = {
        "appId": appid,
        "timeStamp": time_stamp,
        "nonceStr": nonce_str,
        "package": package,
        "signType": "MD5"
    }
    pay_sign = generate_sign(sign_params, key)
    
    return {
        "appId": appid,
        "timeStamp": time_stamp,
        "nonceStr": nonce_str,
        "package": package,
        "signType": "MD5",
        "paySign": pay_sign
    }


async def call_wechat_unified_order(params: dict) -> dict:
    """
    调用微信支付统一下单接口
    
    实际项目中需要:
    1. 将参数转换为 XML 格式
    2. 发送 POST 请求到微信 API
    3. 解析返回的 XML
    4. 获取 prepay_id
    
    这里使用模拟实现
    """
    config = WECHAT_PAY_CONFIG
    
    # 检查配置
    if not config["appid"] or not config["mchid"]:
        logger.warning("WeChat pay config not set, using mock mode")
        return {
            "return_code": "SUCCESS",
            "result_code": "SUCCESS",
            "prepay_id": f"wx{generate_nonce_str(20)}",
            "trade_type": "JSAPI",
            "mock": True
        }
    
    # TODO: 实现真实的微信支付 API 调用
    # url = "https://api.mch.weixin.qq.com/pay/unifiedorder"
    # if config["sandbox"]:
    #     url = "https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder"
    
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(url, data=xml_data)
    #     result = parse_xml(response.text)
    
    # 模拟返回
    return {
        "return_code": "SUCCESS",
        "result_code": "SUCCESS",
        "prepay_id": f"wx{generate_nonce_str(20)}",
        "trade_type": "JSAPI",
        "mock": True
    }


async def verify_wechat_notify(data: dict, api_key: str) -> bool:
    """
    验证微信支付回调通知的签名
    """
    sign = data.pop("sign", "")
    calculated_sign = generate_sign(data, api_key)
    return sign == calculated_sign


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    try:
        await redis_client.connect()
    except:
        logger.warning("Redis connection failed, continuing without Redis")
    
    # 检查支付配置
    if WECHAT_PAY_CONFIG["appid"]:
        logger.info(f"WeChat Pay initialized (sandbox: {WECHAT_PAY_CONFIG['sandbox']})")
    else:
        logger.warning("WeChat Pay not configured, using mock mode")
    
    yield
    try:
        await redis_client.close()
    except:
        pass


app = FastAPI(title="支付服务", description="支付通道/对账/分账", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok", 
        "service": settings.app_name,
        "wechat_configured": bool(WECHAT_PAY_CONFIG["appid"]),
        "sandbox": WECHAT_PAY_CONFIG["sandbox"]
    }


@app.post("/api/v1/pay/create")
async def create_payment(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    创建支付订单
    
    Request Body:
        - order_no: 业务订单号
        - amount: 支付金额（元）
        - description: 商品描述
        - method: 支付方式 (wechat_jsapi, mock)
        - openid: 用户openid (JSAPI支付必需)
    
    Response:
        - pay_order_no: 支付订单号
        - pay_params: 前端调起支付参数
    """
    order_no = data.get("order_no")
    amount = data.get("amount")
    description = data.get("description", "尾巴旅行-订单支付")
    method = data.get("method", "mock")
    openid = data.get("openid", current_user.get("openid", ""))
    
    if not order_no or not amount:
        raise HTTPException(status_code=400, detail="缺少必要参数: order_no, amount")
    
    # 生成支付订单号
    pay_order_no = generate_out_trade_no()
    
    # 金额转换为分
    amount_fen = int(float(amount) * 100)
    
    config = WECHAT_PAY_CONFIG
    
    # 构建微信支付参数
    if method in ["wechat_jsapi", "wechat_native", "wechat_h5"] and config["appid"]:
        # 真实的微信支付
        wx_params = {
            "appid": config["appid"],
            "mch_id": config["mchid"],
            "nonce_str": generate_nonce_str(),
            "body": description,
            "out_trade_no": pay_order_no,
            "total_fee": amount_fen,
            "spbill_create_ip": "127.0.0.1",
            "notify_url": config["notify_url"],
            "trade_type": "JSAPI" if method == "wechat_jsapi" else "NATIVE" if method == "wechat_native" else "MWEB",
            "openid": openid
        }
        
        # 生成签名
        wx_params["sign"] = generate_sign(wx_params, config["apikey"])
        
        # 调用微信统一下单
        wx_result = await call_wechat_unified_order(wx_params)
        
        if wx_result.get("return_code") == "SUCCESS" and wx_result.get("result_code") == "SUCCESS":
            prepay_id = wx_result.get("prepay_id")
            is_mock = wx_result.get("mock", False)
            
            # 构建前端支付参数
            if is_mock:
                pay_params = {
                    "appId": config["appid"] or "mock_appid",
                    "timeStamp": str(int(datetime.now().timestamp())),
                    "nonceStr": generate_nonce_str(),
                    "package": f"prepay_id={prepay_id}",
                    "signType": "MD5",
                    "paySign": "MOCK_SIGN"
                }
            else:
                pay_params = build_wechat_pay_params(prepay_id, config["appid"], config["apikey"])
        else:
            raise HTTPException(status_code=500, detail=f"微信支付下单失败: {wx_result.get('err_code_des', '未知错误')}")
    else:
        # 模拟支付
        logger.info(f"Using mock payment for order: {order_no}")
        pay_params = {
            "appId": "mock_appid",
            "timeStamp": str(int(datetime.now().timestamp())),
            "nonceStr": generate_nonce_str(),
            "package": f"prepay_id=mock_{generate_nonce_str(20)}",
            "signType": "MD5",
            "paySign": "MOCK_SIGN",
            "mock": True
        }
    
    # 保存支付订单到 Redis
    pay_order_data = {
        "pay_order_no": pay_order_no,
        "order_no": order_no,
        "user_id": current_user.get("user_id"),
        "openid": openid,
        "amount": float(amount),
        "amount_fen": amount_fen,
        "description": description,
        "method": method,
        "status": "pending",
        "created_at": datetime.now().isoformat()
    }
    
    try:
        await redis_client.set(f"pay:order:{pay_order_no}", json.dumps(pay_order_data), expire=3600)
    except:
        logger.warning("Failed to save pay order to redis")
    
    logger.info(f"Payment created: {pay_order_no} for order: {order_no}, amount: {amount}")
    
    return success({
        "pay_order_no": pay_order_no,
        "pay_params": pay_params,
        "mock": pay_params.get("mock", False)
    })


@app.post("/api/v1/pay/notify")
async def pay_notify(data: dict, background_tasks: BackgroundTasks):
    """
    微信支付回调通知
    
    处理微信支付结果通知，更新订单状态
    """
    logger.info(f"Pay notify received: {data}")
    
    config = WECHAT_PAY_CONFIG
    
    # 验证签名（真实环境）
    if config["apikey"] and not data.get("mock"):
        if not await verify_wechat_notify(data.copy(), config["apikey"]):
            logger.error("Invalid notify sign")
            return {"code": "FAIL", "message": "Invalid sign"}
    
    # 获取订单信息
    out_trade_no = data.get("out_trade_no")
    result_code = data.get("result_code")
    
    if result_code == "SUCCESS":
        # 支付成功，更新订单状态
        background_tasks.add_task(update_order_paid, out_trade_no, data)
        logger.info(f"Payment success for order: {out_trade_no}")
    else:
        logger.warning(f"Payment failed for order: {out_trade_no}")
    
    # 返回成功响应给微信
    return {"code": "SUCCESS", "message": "OK"}


async def notify_order_service(order_no: str, transaction_id: str, pay_channel: str = "wechat") -> bool:
    """
    通知 order-service 更新订单支付状态
    """
    order_service_url = os.getenv("ORDER_SERVICE_URL", "http://localhost:8003")
    callback_url = f"{order_service_url}/api/v1/orders/pay/callback"
    
    payload = {
        "order_no": order_no,
        "transaction_id": transaction_id,
        "pay_channel": pay_channel,
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(callback_url, json=payload)
            result = response.json()
            
            if result.get("code") == "SUCCESS":
                logger.info(f"Notified order-service success: {order_no}")
                return True
            else:
                logger.error(f"Notified order-service failed: {order_no}, response={result}")
                return False
    except Exception as e:
        logger.error(f"Failed to notify order-service: {e}")
        return False


async def update_order_paid(pay_order_no: str, notify_data: dict):
    """
    异步更新订单支付状态
    """
    try:
        # 从 Redis 获取支付订单
        pay_data = await redis_client.get(f"pay:order:{pay_order_no}")
        if pay_data:
            pay_info = json.loads(pay_data)
            order_no = pay_info.get("order_no")
            
            # 调用 order-service 更新订单状态
            notified = await notify_order_service(
                order_no=order_no,
                transaction_id=notify_data.get("transaction_id", pay_order_no),
                pay_channel=pay_info.get("method", "wechat")
            )
            
            if not notified:
                # TODO: 通知失败时加入重试队列（如 RabbitMQ / 延迟任务）
                logger.warning(f"Order service notification failed for {order_no}, will retry")
            
            # 更新支付订单状态
            pay_info["status"] = "paid"
            pay_info["paid_at"] = datetime.now().isoformat()
            pay_info["transaction_id"] = notify_data.get("transaction_id")
            await redis_client.set(f"pay:order:{pay_order_no}", json.dumps(pay_info))
    except Exception as e:
        logger.error(f"Failed to update order status: {e}")


@app.get("/api/v1/pay/status/{pay_order_no}")
async def get_pay_status(
    pay_order_no: str,
    current_user: dict = Depends(get_current_user)
):
    """查询支付状态"""
    try:
        pay_data = await redis_client.get(f"pay:order:{pay_order_no}")
        if pay_data:
            pay_info = json.loads(pay_data)
            return success({
                "pay_order_no": pay_order_no,
                "status": pay_info.get("status"),
                "amount": pay_info.get("amount"),
                "order_no": pay_info.get("order_no"),
                "paid_at": pay_info.get("paid_at"),
                "method": pay_info.get("method")
            })
    except:
        pass
    
    return success({"status": "not_found", "pay_order_no": pay_order_no})


@app.post("/api/v1/pay/refund")
async def create_refund(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    申请退款
    
    Request Body:
        - order_no: 业务订单号
        - refund_amount: 退款金额
        - reason: 退款原因
    """
    order_no = data.get("order_no")
    refund_amount = data.get("refund_amount")
    reason = data.get("reason", "")
    
    if not order_no or not refund_amount:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    refund_no = f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"
    
    config = WECHAT_PAY_CONFIG
    
    # 检查是否配置了微信支付
    if config["appid"] and config["mchid"] and config["apikey"]:
        # TODO: 调用微信退款 API (V2 或 V3)
        # V2: https://api.mch.weixin.qq.com/secapi/pay/refund （需要客户端证书）
        # V3: https://api.mch.weixin.qq.com/v3/refund/domestic/refunds （需要商户私钥+证书）
        logger.info(f"Calling WeChat refund API for order: {order_no}")
        # 真实退款逻辑待接入商户证书后实现
        refund_status = "processing"
    else:
        # Mock 退款（开发测试环境）
        logger.warning(f"WeChat pay not configured, using mock refund for order: {order_no}")
        refund_status = "processing"
    
    # 保存退款记录到 Redis
    refund_data = {
        "refund_no": refund_no,
        "order_no": order_no,
        "refund_amount": float(refund_amount),
        "reason": reason,
        "status": refund_status,
        "created_at": datetime.now().isoformat()
    }
    try:
        await redis_client.set(f"pay:refund:{refund_no}", json.dumps(refund_data), expire=86400)
    except:
        logger.warning("Failed to save refund record to redis")
    
    logger.info(f"Refund created: {refund_no} for order: {order_no}, amount: {refund_amount}")
    
    return success({
        "refund_no": refund_no,
        "order_no": order_no,
        "refund_amount": refund_amount,
        "reason": reason,
        "status": refund_status
    })


@app.post("/api/v1/pay/refund/notify")
async def refund_notify(data: dict):
    """退款结果通知"""
    logger.info(f"Refund notify received: {data}")
    return {"code": "SUCCESS", "message": "OK"}


@app.get("/api/v1/pay/bills")
async def get_bills(
    start_date: str,
    end_date: str,
    current_user: dict = Depends(get_current_user)
):
    """
    获取对账单
    
    Query Params:
        - start_date: 开始日期 (YYYY-MM-DD)
        - end_date: 结束日期 (YYYY-MM-DD)
    """
    # 模拟对账单数据
    bills = [
        {
            "date": "2026-04-09",
            "order_count": 15,
            "total_amount": 3500.00,
            "refund_amount": 199.00,
            "net_amount": 3301.00
        }
    ]
    return success({"bills": bills, "start_date": start_date, "end_date": end_date})


@app.post("/api/v1/pay/mock/confirm")
async def mock_pay_confirm(data: dict):
    """
    模拟支付确认（仅测试环境使用）
    
    用于开发测试时模拟支付成功
    """
    pay_order_no = data.get("pay_order_no")
    
    if not pay_order_no:
        raise HTTPException(status_code=400, detail="缺少 pay_order_no")
    
    try:
        pay_data = await redis_client.get(f"pay:order:{pay_order_no}")
        if pay_data:
            pay_info = json.loads(pay_data)
            pay_info["status"] = "paid"
            pay_info["paid_at"] = datetime.now().isoformat()
            pay_info["transaction_id"] = f"MOCK{generate_nonce_str(20)}"
            await redis_client.set(f"pay:order:{pay_order_no}", json.dumps(pay_info))
            
            logger.info(f"Mock payment confirmed: {pay_order_no}")
            return success({"status": "paid", "pay_order_no": pay_order_no})
    except Exception as e:
        logger.error(f"Mock confirm failed: {e}")
    
    return success({"status": "not_found"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
