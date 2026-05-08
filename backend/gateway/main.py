"""
API网关 - API Gateway
端口: 8081
职责: 统一入口/路由转发/鉴权/限流
"""
import sys
import jwt
import re
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
settings.app_port = 8081
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
    r"^/api/v1/charities/activities$",
    r"^/api/v1/charities/activities/\d+$",
    r"^/api/v1/pay/notify$",
    r"^/api/v1/pay/refund/notify$",
    r"^/api/v1/map/.*",
    r"^/api/v1/files/static/.*",
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
SERVICE_ROUTES = {
    "/api/v1/user": "http://localhost:8001",
    "/api/v1/pets": "http://localhost:8001",
    "/api/v1/auth": "http://localhost:8001",
    "/api/v1/travelers": "http://localhost:8001",
    "/api/v1/admin/users": "http://localhost:8001",
    "/api/v1/admin/pets": "http://localhost:8001",
    "/api/v1/admin/travelers": "http://localhost:8001",
    "/api/v1/admin/settings": "http://localhost:8001",
    "/api/v1/admin/operation-logs": "http://localhost:8001",
    "/api/v1/admin/route-types": "http://localhost:8033",
    "/api/v1/admin/routes": "http://localhost:8033",
    "/api/v1/admin/addons": "http://localhost:8033",
    "/api/v1/admin/schedules": "http://localhost:8033",
    "/api/v1/routes": "http://localhost:8033",
    "/api/v1/admin/orders": "http://localhost:8003",
    "/api/v1/admin/stats": "http://localhost:8003",
    "/api/v1/admin/evaluations": "http://localhost:8003",
    "/api/v1/admin/refunds": "http://localhost:8003",
    "/api/v1/orders": "http://localhost:8003",
    "/api/v1/map": "http://localhost:8004",
    "/api/v1/contents": "http://localhost:8005",
    "/api/v1/contents/banners": "http://localhost:8005",
    "/api/v1/admin/articles": "http://localhost:8005",
    "/api/v1/admin/banners": "http://localhost:8005",
    "/api/v1/pay": "http://localhost:8006",
    "/api/v1/notifications": "http://localhost:8007",
    "/api/v1/admin/notifications": "http://localhost:8007",
    "/api/v1/message": "http://localhost:8007",
    "/api/v1/files": "http://localhost:8008",
    "/api/v1/charities": "http://localhost:8009",
    "/api/v1/admin/charities": "http://localhost:8009",
    "/api/v1/charity": "http://localhost:8009",
}

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
    
    # 鉴权检查（非公开路径需要验证JWT）
    if not is_public_path(current_path):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            logger.warning(f"Unauthorized access to {current_path}: missing token")
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": "未登录或登录已过期", "data": None}
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
                content={"code": 401, "message": str(e), "data": None}
            )
    
    # 查找目标服务
    target_service = None
    for route_prefix, service_url in SERVICE_ROUTES.items():
        if current_path.startswith(route_prefix):
            target_service = service_url
            break
    
    if not target_service:
        logger.warning(f"Service not found for path: {current_path}")
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "Service not found", "data": None}
        )
    
    # 构建目标URL
    target_url = f"{target_service}{current_path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    logger.info(f"Proxy: {request.method} {current_path} -> {target_url}")
    
    # 转发请求
    try:
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        
        body = await request.body()
        
        response = await request.app.state.http_client.request(
            method=method,
            url=target_url,
            headers=headers,
            content=body,
            timeout=30.0
        )
        
        logger.info(f"Proxy response: {response.status_code} for {target_url}")
        
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
            return JSONResponse(
                status_code=response.status_code,
                content=response.json()
            )
        except Exception:
            # 非 JSON 文本响应
            return Response(
                status_code=response.status_code,
                content=response.text,
                headers={"content-type": content_type}
            )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return JSONResponse(
            status_code=500,
            content={"code": 500, "message": "Service unavailable", "data": None}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
