"""
API网关 - API Gateway
端口: 8081
职责: 统一入口/路由转发/鉴权/限流
"""
import sys
import os
import jwt
import re
import json
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from contextlib import asynccontextmanager
from common.config import settings
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.logger import setup_logger
import httpx

settings.app_name = "api-gateway"
settings.app_port = 8000
logger = setup_logger("gateway")

# JWT 配置
JWT_SECRET = settings.jwt.secret
JWT_ALGORITHM = settings.jwt.algorithm

# 公开路径白名单（不需要鉴权）
PUBLIC_PATHS = [
    r"^/health$",
    r"^/api/v1/auth/.*",
    r"^/api/v1/routes$",
    r"^/api/v1/routes/\d+$",
    r"^/api/v1/routes/types$",
    r"^/api/v1/routes/\d+/schedules$",
    r"^/api/v1/map/pois$",
    r"^/api/v1/map/pois/nearby$",
    r"^/api/v1/map/pois/\d+$",
    r"^/api/v1/contents/articles$",
    r"^/api/v1/contents/articles/\d+$",
    r"^/api/v1/contents/articles/\d+/like$",
    r"^/api/v1/contents/banners$",
    r"^/api/v1/agreements$",
    r"^/api/v1/agreements/\d+$",
    r"^/api/v1/charities/activities$",
    r"^/api/v1/charities/activities/\d+$",
    r"^/api/v1/pay/notify$",
    r"^/api/v1/pay/refund/notify$",
    r"^/api/v1/map/.*",
    r"^/api/v1/files/static/.*",
    r"^/api/v1/popups/member-activity$",
    r"^/api/v1/popups/\d+/log$",
    r"^/api/v1/settings/public$",
    r"^/api/v1/addon-categories$",
]


def is_public_path(path: str) -> bool:
    """检查路径是否在公开白名单中"""
    for pattern in PUBLIC_PATHS:
        if re.match(pattern, path):
            return True
    return False


def verify_token(token: str) -> dict:
    """验证 JWT Token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token已过期")
    except jwt.InvalidTokenError:
        raise ValueError("无效的Token")

# 服务路由配置
# 注意：较长的路径（如 /api/v1/admin/routes）必须排在较短的（如 /api/v1/routes）之前

# Docker 容器名称映射（生产环境）
DOCKER_SERVICE_MAP = {
    8001: "petway-user-service",
    8003: "petway-order-service",
    8004: "petway-map-service",
    8005: "petway-content-service",
    8006: "petway-pay-service",
    8007: "petway-message-service",
    8008: "petway-file-service",
    8009: "petway-charity-service",
    8033: "petway-route-service",
}

# 本地开发路由配置
LOCAL_SERVICE_ROUTES = {
    "/api/v1/user": "http://localhost:8001",
    "/api/v1/pets": "http://localhost:8001",
    "/api/v1/auth": "http://localhost:8001",
    "/api/v1/travelers": "http://localhost:8001",
    "/api/v1/admin/users": "http://localhost:8001",
    "/api/v1/admin/pets": "http://localhost:8001",
    "/api/v1/admin/travelers": "http://localhost:8001",
    "/api/v1/admin/settings": "http://localhost:8001",
    "/api/v1/admin/operation-logs": "http://localhost:8001",
    "/api/v1/admin/me": "http://localhost:8001",
    "/api/v1/admin/menus/tree": "http://localhost:8001",
    "/api/v1/admin/menus": "http://localhost:8001",
    "/api/v1/admin/roles": "http://localhost:8001",
    "/api/v1/admin/admins": "http://localhost:8001",
    "/api/v1/admin/route-types": "http://localhost:8033",
    "/api/v1/admin/routes": "http://localhost:8033",
    "/api/v1/admin/addons": "http://localhost:8033",
    "/api/v1/admin/addon-categories": "http://localhost:8033",
    "/api/v1/addon-categories": "http://localhost:8033",
    "/api/v1/admin/schedules": "http://localhost:8033",
    "/api/v1/routes": "http://localhost:8033",
    "/api/v1/admin/orders": "http://localhost:8003",
    "/api/v1/admin/stats": "http://localhost:8003",
    "/api/v1/admin/evaluations": "http://localhost:8003",
    "/api/v1/admin/refunds": "http://localhost:8003",
    "/api/v1/orders": "http://localhost:8003",
    "/api/v1/map": "http://localhost:8004",
    "/api/v1/settings/public": "http://localhost:8001",
    "/api/v1/contents": "http://localhost:8005",
    "/api/v1/contents/banners": "http://localhost:8005",
    "/api/v1/admin/articles": "http://localhost:8005",
    "/api/v1/admin/banners": "http://localhost:8005",
    "/api/v1/admin/agreements": "http://localhost:8005",
    "/api/v1/agreements": "http://localhost:8005",
    "/api/v1/pay": "http://localhost:8006",
    "/api/v1/notifications": "http://localhost:8007",
    "/api/v1/admin/notifications": "http://localhost:8007",
    "/api/v1/message": "http://localhost:8007",
    "/api/v1/files": "http://localhost:8008",
    "/api/v1/charities": "http://localhost:8009",
    "/api/v1/admin/charities": "http://localhost:8009",
    "/api/v1/charity": "http://localhost:8009",
    "/api/v1/coupons": "http://localhost:8003",
    "/api/v1/admin/coupon-templates": "http://localhost:8003",
    "/api/v1/admin/user-coupons": "http://localhost:8003",
    "/api/v1/member/orders": "http://localhost:8003",
    "/api/v1/member/plans": "http://localhost:8001",
    "/api/v1/member/center": "http://localhost:8001",
    "/api/v1/member/coupons": "http://localhost:8001",
    "/api/v1/popups": "http://localhost:8001",
    "/api/v1/admin/member-plans": "http://localhost:8001",
    "/api/v1/admin/popups": "http://localhost:8001",
    "/api/v1/admin/memberships": "http://localhost:8001",
    "/api/v1/admin/member-orders": "http://localhost:8003",
}


def _build_docker_routes():
    """将本地路由配置转换为 Docker 容器名路由配置"""
    import re as _re
    docker_routes = {}
    for path, url in LOCAL_SERVICE_ROUTES.items():
        match = _re.search(r':(\d+)', url)
        if match:
            port = int(match.group(1))
            container = DOCKER_SERVICE_MAP.get(port)
            if container:
                docker_routes[path] = f"http://{container}:8000"
            else:
                docker_routes[path] = url
        else:
            docker_routes[path] = url
    return docker_routes


# 根据环境变量选择路由配置
_is_docker = os.environ.get("DOCKER_MODE", "").lower() in ("true", "1", "yes")
SERVICE_ROUTES = _build_docker_routes() if _is_docker else LOCAL_SERVICE_ROUTES

logger.info(f"Gateway mode: {'DOCKER' if _is_docker else 'LOCAL'}, routes loaded: {len(SERVICE_ROUTES)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    # Redis 暂时跳过
    try:
        await redis_client.connect()
    except:
        logger.warning("Redis connection failed, continuing without Redis")
    app.state.http_client = httpx.AsyncClient()
    yield
    await app.state.http_client.aclose()
    try:
        await redis_client.close()
    except:
        pass

app = FastAPI(title="API网关", description="统一入口/路由转发", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}

@app.get("/")
async def root():
    return {
        "service": "API Gateway",
        "version": "1.0.0",
        "routes": list(SERVICE_ROUTES.keys())
    }

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(request: Request, path: str):
    """路由转发（含鉴权）"""
    current_path = request.url.path
    
    user_payload = None
    # 鉴权检查（非公开路径需要验证JWT）
    if not is_public_path(current_path):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            logger.warning(f"Unauthorized access to {current_path}: missing token")
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": "未登录或登录已过期", "data": None},
                media_type="application/json; charset=utf-8"
            )
        
        token = auth_header[7:]  # 去掉 "Bearer "
        try:
            user_payload = verify_token(token)
            # 将用户信息注入请求头，方便下游服务使用
            # 注意：这里不修改原始请求对象，而是通过自定义header透传
        except ValueError as e:
            logger.warning(f"Unauthorized access to {current_path}: {e}")
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": str(e), "data": None},
                media_type="application/json; charset=utf-8"
            )
    
    # 查找目标服务（按路径长度降序匹配，确保长路径优先）
    target_service = None
    for route_prefix, service_url in sorted(SERVICE_ROUTES.items(), key=lambda x: -len(x[0])):
        if current_path.startswith(route_prefix):
            target_service = service_url
            break
    
    if not target_service:
        logger.warning(f"Service not found for path: {current_path}")
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "Service not found", "data": None},
            media_type="application/json; charset=utf-8"
        )
    
    # 构建目标URL
    target_url = f"{target_service}{current_path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    logger.info(f"Proxy: {request.method} {current_path} -> {target_url}")
    
    # 读取请求体（用于转发和日志）
    body = await request.body()
    
    # 转发请求
    try:
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        
        response = await request.app.state.http_client.request(
            method=method,
            url=target_url,
            headers=headers,
            content=body,
            timeout=30.0
        )
        
        logger.info(f"Proxy response: {response.status_code} for {target_url}")
        
        # 记录操作日志（admin 写操作）
        if method in ("POST", "PUT", "DELETE", "PATCH") and current_path.startswith("/api/v1/admin/") and "operation-logs" not in current_path:
            try:
                await _log_operation(request, current_path, method, response.status_code, body, user_payload)
            except Exception as e:
                logger.warning(f"Operation log failed: {e}")
        
        # 检查响应内容类型，二进制数据（如图片、Excel）直接流式转发
        content_type = response.headers.get("content-type", "")
        if content_type.startswith(("image/", "video/", "audio/", "application/octet-stream", "application/vnd.openxmlformats-officedocument")):
            return Response(
                status_code=response.status_code,
                content=response.content,
                headers={"content-type": content_type}
            )
        
        # JSON 响应正常解析转发
        try:
            body = json.dumps(response.json(), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            return Response(
                status_code=response.status_code,
                content=body,
                headers={"content-type": "application/json; charset=utf-8"}
            )
        except Exception:
            # 非 JSON 文本响应
            return Response(
                status_code=response.status_code,
                content=response.content,
                headers={"content-type": content_type}
            )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return JSONResponse(
            status_code=500,
            content={"code": 500, "message": "Service unavailable", "data": None},
            media_type="application/json; charset=utf-8"
        )


# 敏感字段，日志中需要脱敏
_SENSITIVE_KEYS = {"password", "token", "secret", "id_card", "phone", "credit_card", "bank_card", "api_key", "appsecret", "cert", "private_key", "signature", "code", "verify_code", "sms_code", "captcha"}


def _sanitize_body(body_bytes: bytes) -> str:
    """过滤请求体中的敏感信息，限制长度"""
    if not body_bytes:
        return ""
    try:
        data = json.loads(body_bytes)
    except Exception:
        text = body_bytes.decode("utf-8", errors="ignore")
        return text[:500] if len(text) <= 500 else text[:500] + "..."
    
    def _redact(obj):
        if isinstance(obj, dict):
            result = {}
            for k, v in obj.items():
                if any(sk in k.lower() for sk in _SENSITIVE_KEYS):
                    result[k] = "***"
                else:
                    result[k] = _redact(v)
            return result
        elif isinstance(obj, list):
            return [_redact(i) for i in obj]
        return obj
    
    sanitized = _redact(data)
    result = json.dumps(sanitized, ensure_ascii=False)
    return result[:1000] if len(result) <= 1000 else result[:1000] + "..."


def _extract_module_action(path: str, method: str) -> tuple:
    """从请求路径和方法推导 module 和 action"""
    parts = path.strip("/").split("/")
    # 路径格式: api/v1/admin/xxx/... 或 api/v1/admin/xxx/{id}
    module = parts[3] if len(parts) >= 4 else "admin"
    
    action_map = {
        "POST": "CREATE",
        "PUT": "UPDATE",
        "PATCH": "UPDATE",
        "DELETE": "DELETE",
    }
    action = action_map.get(method, "QUERY")
    return module, action


async def _log_operation(request: Request, path: str, method: str, status_code: int, body: bytes, user_payload: dict):
    """异步记录操作日志（fire-and-forget）"""
    try:
        user_service_url = SERVICE_ROUTES.get("/api/v1/admin/operation-logs")
        if not user_service_url:
            return
        
        module, action = _extract_module_action(path, method)
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "")
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()
        
        log_payload = {
            "user_id": (user_payload.get("id") or user_payload.get("user_id")) if user_payload else None,
            "username": (user_payload.get("username") or user_payload.get("openid")) if user_payload else None,
            "module": module,
            "action": action,
            "description": f"{method} {path}",
            "request_method": method,
            "request_path": path,
            "request_params": _sanitize_body(body),
            "response_code": status_code,
            "ip_address": client_ip,
        }
        
        res = await request.app.state.http_client.post(
            f"{user_service_url}/api/v1/admin/operation-logs",
            json=log_payload,
            timeout=5.0
        )
        data = res.json()
        if data.get("code") != 200:
            logger.warning(f"Operation log failed: {data.get('message')}")
        else:
            logger.info(f"Operation log recorded: {module}/{action} {path}")
    except Exception as e:
        logger.warning(f"Operation log failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
