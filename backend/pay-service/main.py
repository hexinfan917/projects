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

from fastapi import FastAPI, Depends, Header, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, PlainTextResponse
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

# 微信退款证书配置
WECHAT_CERT_PATH = os.getenv("WECHAT_CERT_PATH", "")
WECHAT_KEY_PATH = os.getenv("WECHAT_KEY_PATH", "")

# 支付方式
PAYMENT_METHODS = {
    "wechat_jsapi": "微信支付-JSAPI",
    "wechat_native": "微信支付-Native",
    "wechat_h5": "微信支付-H5",
    "alipay": "支付宝",
    "mock": "模拟支付",
    "virtual": "微信虚拟支付"
}

# 虚拟支付配置
VIRTUAL_PAY_CONFIG = {
    "offer_id": os.getenv("VIRTUAL_PAY_OFFER_ID", ""),
    "app_key_prod": os.getenv("VIRTUAL_PAY_APP_KEY_PROD", ""),
    "app_key_sandbox": os.getenv("VIRTUAL_PAY_APP_KEY_SANDBOX", ""),
    "env": int(os.getenv("VIRTUAL_PAY_ENV", "0")),  # 0=正式, 1=沙箱
    "notify_url": os.getenv("VIRTUAL_PAY_NOTIFY_URL", "")
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


def sign_v3(message: str, private_key_path: str) -> str:
    """
    微信支付 V3 API 签名 (SHA256withRSA)
    """
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    
    with open(private_key_path, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
    
    signature = private_key.sign(
        message.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode('utf-8')


def build_v3_auth_header(method: str, url_path: str, body: str, private_key_path: str, mchid: str, serial_no: str) -> str:
    """
    构建微信支付 V3 Authorization 头
    """
    timestamp = str(int(datetime.now().timestamp()))
    nonce_str = generate_nonce_str()
    message = f"{method}\n{url_path}\n{timestamp}\n{nonce_str}\n{body}\n"
    signature = sign_v3(message, private_key_path)
    return f'WECHATPAY2-SHA256-RSA2048 mchid="{mchid}",nonce_str="{nonce_str}",signature="{signature}",timestamp="{timestamp}",serial_no="{serial_no}"'


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


def dict_to_xml(data: dict) -> str:
    """将字典转换为微信支付 XML 格式"""
    xml = ['<xml>']
    for k, v in data.items():
        xml.append(f'<{k}><![CDATA[{v}]]></{k}>')
    xml.append('</xml>')
    return ''.join(xml)


def xml_to_dict(xml_str: str) -> dict:
    """将微信支付 XML 响应解析为字典"""
    import xml.etree.ElementTree as ET
    root = ET.fromstring(xml_str)
    return {child.tag: child.text for child in root}


async def call_wechat_unified_order(params: dict) -> dict:
    """
    调用微信支付统一下单接口 (V2)
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
    
    url = "https://api.mch.weixin.qq.com/pay/unifiedorder"
    if config["sandbox"]:
        url = "https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder"
    
    xml_data = dict_to_xml(params)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, 
                data=xml_data, 
                headers={"Content-Type": "application/xml"},
                timeout=30.0
            )
            result = xml_to_dict(response.text)
            
            logger.info(f"WeChat unified order response: {result}")
            
            return {
                "return_code": result.get("return_code"),
                "return_msg": result.get("return_msg"),
                "result_code": result.get("result_code"),
                "prepay_id": result.get("prepay_id"),
                "trade_type": result.get("trade_type"),
                "err_code": result.get("err_code"),
                "err_code_des": result.get("err_code_des"),
                "mock": False
            }
    except Exception as e:
        logger.error(f"WeChat unified order failed: {e}")
        raise HTTPException(status_code=500, detail=f"微信支付统一下单请求失败: {str(e)}")


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
    out_trade_no = data.get("out_trade_no", "")
    
    if not order_no or not amount:
        raise HTTPException(status_code=400, detail="缺少必要参数: order_no, amount")
    
    # 使用业务订单号作为微信商户单号，确保两边一致
    pay_order_no = out_trade_no or generate_out_trade_no()
    
    # 金额转换为分（使用 round 避免浮点误差）
    amount_fen = round(float(amount) * 100)
    
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
        is_mock = True
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
        "mock": is_mock
    })


@app.post("/api/v1/pay/notify")
async def pay_notify(request: Request, background_tasks: BackgroundTasks):
    """
    微信支付回调通知
    
    处理微信支付结果通知，更新订单状态
    微信发送的是 XML 格式数据
    """
    body = await request.body()
    body_str = body.decode('utf-8')
    logger.info(f"Pay notify raw body: {body_str}")
    
    # 解析 XML
    try:
        data = xml_to_dict(body_str)
    except Exception as e:
        logger.error(f"Failed to parse notify XML: {e}, body: {body_str}")
        return PlainTextResponse("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid XML]]></return_msg></xml>", status_code=200)
    
    logger.info(f"Pay notify parsed: {data}")
    
    config = WECHAT_PAY_CONFIG
    
    # 验证签名（生产环境必须验证）
    if config["apikey"]:
        if not await verify_wechat_notify(data.copy(), config["apikey"]):
            logger.error("Invalid notify sign")
            return PlainTextResponse("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid sign]]></return_msg></xml>", status_code=200)
    
    # 获取订单信息
    out_trade_no = data.get("out_trade_no")
    result_code = data.get("result_code")
    
    if result_code == "SUCCESS":
        # 支付成功，更新订单状态
        background_tasks.add_task(update_order_paid, out_trade_no, data)
        logger.info(f"Payment success for order: {out_trade_no}")
    else:
        logger.warning(f"Payment failed for order: {out_trade_no}")
    
    # 返回成功响应给微信（必须返回 XML）
    return PlainTextResponse("<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>", status_code=200)


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
        - transaction_id: 微信支付单号（可选）
        - total_amount: 订单总金额（可选）
    """
    order_no = data.get("order_no")
    refund_amount = data.get("refund_amount")
    reason = data.get("reason", "")
    transaction_id = data.get("transaction_id", "")
    total_amount = data.get("total_amount", refund_amount)
    out_trade_no = data.get("out_trade_no", "")
    
    if not order_no or not refund_amount:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    refund_no = f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"
    
    config = WECHAT_PAY_CONFIG
    
    # 检查是否配置了微信支付
    if config["mchid"]:
        if not WECHAT_KEY_PATH or not os.path.exists(WECHAT_KEY_PATH):
            logger.error(f"WeChat refund certificate missing: {WECHAT_KEY_PATH}")
            return {"code": 500, "message": "微信退款证书缺失，无法发起退款", "data": None}
        # 使用微信支付 V3 API 退款（只需要私钥+序列号，不需要证书文件）
        try:
            refund_amount_fen = round(float(refund_amount) * 100)
            total_fee_fen = round(float(total_amount) * 100)
            
            url_path = "/v3/refund/domestic/refunds"
            url = f"https://api.mch.weixin.qq.com{url_path}"
            
            refund_body = {
                "out_refund_no": refund_no,
                "reason": reason[:80] if reason else "用户申请退款",
                "amount": {
                    "refund": refund_amount_fen,
                    "total": total_fee_fen,
                    "currency": "CNY"
                }
            }
            
            if transaction_id:
                refund_body["transaction_id"] = transaction_id
            elif out_trade_no:
                refund_body["out_trade_no"] = out_trade_no
            else:
                refund_body["out_trade_no"] = order_no
            
            body_json = json.dumps(refund_body, separators=(',', ':'), ensure_ascii=False)
            
            serial_no = os.getenv("WECHAT_CERT_SERIAL_NO", "")
            if not serial_no:
                logger.error("WECHAT_CERT_SERIAL_NO not configured")
                return {"code": 500, "message": "微信商户证书序列号未配置，无法发起退款", "data": None}
            
            auth_header = build_v3_auth_header(
                "POST", url_path, body_json, WECHAT_KEY_PATH, config["mchid"], serial_no
            )
            
            logger.info(f"Calling WeChat V3 refund API: order_no={order_no}, refund_no={refund_no}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": auth_header,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    content=body_json
                )
            
            if response.status_code == 200:
                wx_result = response.json()
                # V3 退款是异步的，需要检查 status
                if wx_result.get("status") == "SUCCESS":
                    refund_status = "success"
                    logger.info(f"WeChat V3 refund success: {refund_no} for order {order_no}")
                elif wx_result.get("status") == "PROCESSING":
                    refund_status = "processing"
                    logger.info(f"WeChat V3 refund processing: {refund_no} for order {order_no}")
                else:
                    err_msg = wx_result.get("status", "未知状态")
                    logger.error(f"WeChat V3 refund abnormal status: {err_msg}")
                    return {"code": 500, "message": f"微信退款异常状态: {err_msg}", "data": None}
            else:
                try:
                    wx_error = response.json()
                    err_msg = wx_error.get("message", "未知错误")
                    err_code = wx_error.get("code", "")
                except:
                    err_msg = response.text or "未知错误"
                    err_code = ""
                logger.error(f"WeChat V3 refund failed: {response.status_code} - {err_msg}")
                return {"code": 500, "message": f"微信退款失败: {err_msg}", "data": None}
                
        except Exception as e:
            logger.error(f"WeChat V3 refund exception: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {"code": 500, "message": f"微信退款接口调用失败: {str(e)}", "data": None}
    else:
        # Mock 退款（开发测试环境）
        logger.warning(f"WeChat pay not configured, using mock refund for order: {order_no}")
        refund_status = "success"  # mock 环境直接成功
    
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


# ==================== 虚拟支付模块 ====================

def hmac_sha256_hex(key: str, data: str) -> str:
    """HMAC-SHA256 签名，返回 hex 字符串"""
    mac = hmac.new(key.encode('utf-8'), data.encode('utf-8'), hashlib.sha256)
    return mac.hexdigest()


def hmac_sha256_hex_with_bytes(key_bytes: bytes, data: str) -> str:
    """HMAC-SHA256 签名，key 为 bytes，返回 hex 字符串"""
    mac = hmac.new(key_bytes, data.encode('utf-8'), hashlib.sha256)
    return mac.hexdigest()


def build_virtual_sign_data(
    offer_id: str,
    product_id: str,
    goods_price: int,
    out_trade_no: str,
    buy_quantity: int = 1,
    env: int = 0,
    currency_type: str = "CNY",
    attach: str = ""
) -> str:
    """
    构建虚拟支付 signData JSON 字符串
    字段按字母顺序排列，与微信签名要求一致
    """
    data = {}
    if attach:
        data["attach"] = attach
    data["buyQuantity"] = buy_quantity
    data["currencyType"] = currency_type
    data["env"] = env
    data["goodsPrice"] = goods_price
    data["offerId"] = offer_id
    data["outTradeNo"] = out_trade_no
    data["productId"] = product_id
    # 紧凑 JSON，无空格，按字母顺序输出
    return json.dumps(data, separators=(',', ':'), ensure_ascii=False)


def calc_virtual_payment_sign(sign_data: str, session_key: str, app_key: str) -> dict:
    """
    计算虚拟支付签名
    
    Returns:
        {"paySig": "xxx", "signature": "xxx"}
    """
    # paySig 用 appKey 计算
    pay_sig = hmac_sha256_hex(app_key, f"requestVirtualPayment&{sign_data}")
    
    # signature 用 session_key 计算（直接使用原始字符串，不 base64 解码）
    signature = hmac_sha256_hex(session_key, sign_data)
    
    logger.info(f"Virtual pay sign: signData={sign_data}, paySig={pay_sig[:16]}..., signature={signature[:16]}...")
    return {"paySig": pay_sig, "signature": signature}


@app.post("/api/v1/pay/virtual/create")
async def create_virtual_payment(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    创建虚拟支付订单
    
    Request Body:
        - order_no: 业务订单号
        - product_id: 虚拟支付道具ID
        - amount: 支付金额（元）
        - session_key: 用户微信session_key
        - description: 商品描述（可选）
        - attach: 附加数据（可选）
    
    Response:
        - pay_order_no: 支付订单号
        - signData: 虚拟支付签名数据（JSON字符串）
        - paySig: 商户侧签名
        - signature: 用户态签名
    """
    order_no = data.get("order_no")
    product_id = data.get("product_id")
    amount = data.get("amount")
    session_key = data.get("session_key")
    attach = data.get("attach", "")
    
    if not order_no or not product_id or amount is None:
        raise HTTPException(status_code=400, detail="缺少必要参数: order_no, product_id, amount")
    
    config = VIRTUAL_PAY_CONFIG
    offer_id = config.get("offer_id", "")
    app_key = config.get("app_key_sandbox", "") if config.get("env") == 1 else config.get("app_key_prod", "")
    
    if not offer_id or not app_key:
        logger.warning("Virtual pay config not set, using mock mode")
        # Mock 模式：返回模拟的 signData
        return success({
            "pay_order_no": f"MOCKVP{generate_nonce_str(16)}",
            "signData": json.dumps({"mock": True, "order_no": order_no}),
            "paySig": "mock_pay_sig",
            "signature": "mock_signature",
            "mock": True
        })
    
    if not session_key:
        raise HTTPException(status_code=400, detail="缺少 session_key，无法计算用户态签名")
    
    # 金额转换为分（整数）
    goods_price = round(float(amount) * 100)
    # 使用业务订单号作为微信商户单号，确保微信支付后台和系统订单号一致
    pay_order_no = order_no
    
    # 构建 signData（attach 内部 JSON 必须紧凑无空格）
    compact_attach = json.dumps(json.loads(attach), separators=(',', ':')) if attach else ""
    sign_data = build_virtual_sign_data(
        offer_id=offer_id,
        product_id=product_id,
        goods_price=goods_price,
        out_trade_no=pay_order_no,
        env=config.get("env", 0),
        attach=compact_attach
    )
    
    # 计算签名
    signs = calc_virtual_payment_sign(sign_data, session_key, app_key)
    
    # 保存支付订单到 Redis
    pay_order_data = {
        "pay_order_no": pay_order_no,
        "order_no": order_no,
        "user_id": current_user.get("user_id"),
        "product_id": product_id,
        "amount": float(amount),
        "amount_fen": goods_price,
        "method": "virtual",
        "status": "pending",
        "created_at": datetime.now().isoformat()
    }
    try:
        await redis_client.set(f"pay:order:{pay_order_no}", json.dumps(pay_order_data), expire=3600)
    except:
        logger.warning("Failed to save virtual pay order to redis")
    
    logger.info(f"Virtual payment created: {pay_order_no} for order: {order_no}, product: {product_id}, amount: {amount}")
    
    return success({
        "pay_order_no": pay_order_no,
        "signData": sign_data,
        "paySig": signs["paySig"],
        "signature": signs["signature"],
        "mock": False
    })


@app.post("/api/v1/pay/virtual/notify")
async def virtual_pay_notify(request: Request, background_tasks: BackgroundTasks):
    """
    微信虚拟支付回调通知
    
    微信发送 JSON 格式数据
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse virtual pay notify: {e}")
        return JSONResponse({"code": "FAIL", "message": "Invalid JSON"}, status_code=200)
    
    logger.info(f"Virtual pay notify received: {body}")
    
    out_trade_no = body.get("outTradeNo")
    result_code = body.get("payStatus", "")
    
    if result_code == "SUCCESS":
        background_tasks.add_task(update_order_paid, out_trade_no, body)
        logger.info(f"Virtual payment success for order: {out_trade_no}")
    else:
        logger.warning(f"Virtual payment failed for order: {out_trade_no}, status: {result_code}")
    
    return JSONResponse({"code": "SUCCESS", "message": "OK"})


@app.post("/api/v1/pay/virtual/confirm")
async def virtual_pay_confirm(data: dict):
    """
    虚拟支付前端确认（支付成功后调用）
    
    Request Body:
        - pay_order_no: 支付订单号
    
    由于虚拟支付回调可能延迟，前端 success 回调中主动调用此接口确认支付
    """
    pay_order_no = data.get("pay_order_no")
    if not pay_order_no:
        raise HTTPException(status_code=400, detail="缺少 pay_order_no")
    
    try:
        # 从 Redis 获取支付订单
        pay_data = await redis_client.get(f"pay:order:{pay_order_no}")
        if not pay_data:
            logger.warning(f"Virtual pay confirm: order not found in redis: {pay_order_no}")
            return {"code": 404, "message": "支付订单不存在或已过期", "data": None}
        
        pay_info = json.loads(pay_data)
        order_no = pay_info.get("order_no")
        
        # 如果已经处理过，直接返回成功
        if pay_info.get("status") == "paid":
            return success({"order_no": order_no, "status": "paid"})
        
        # 通知 order-service 开通会员/更新订单
        notified = await notify_order_service(
            order_no=order_no,
            transaction_id=pay_order_no,
            pay_channel="virtual"
        )
        
        if not notified:
            logger.error(f"Virtual pay confirm: notify order-service failed for {order_no}")
            return {"code": 500, "message": "订单处理失败", "data": None}
        
        # 更新 Redis 状态
        pay_info["status"] = "paid"
        pay_info["paid_at"] = datetime.now().isoformat()
        pay_info["transaction_id"] = pay_order_no
        await redis_client.set(f"pay:order:{pay_order_no}", json.dumps(pay_info))
        
        logger.info(f"Virtual pay confirmed: {pay_order_no} for order: {order_no}")
        return success({"order_no": order_no, "status": "paid"})
    
    except Exception as e:
        logger.error(f"Virtual pay confirm failed: {e}")
        return {"code": 500, "message": f"确认失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
