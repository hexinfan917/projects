"""
API网关 - API Gateway
端口: 8000
职责: 统一入口/路由转发/鉴权/限流
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from common.config import settings
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.logger import setup_logger
import httpx

settings.app_name = "api-gateway"
settings.app_port = 8081
logger = setup_logger("gateway")

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
    "/api/v1/admin/routes": "http://localhost:8033",
    "/api/v1/admin/schedules": "http://localhost:8033",
    "/api/v1/routes": "http://localhost:8033",
    "/api/v1/admin/orders": "http://localhost:8003",
    "/api/v1/admin/stats": "http://localhost:8003",
    "/api/v1/admin/evaluations": "http://localhost:8003",
    "/api/v1/admin/refunds": "http://localhost:8003",
    "/api/v1/orders": "http://localhost:8003",
    "/api/v1/map": "http://localhost:8004",
    "/api/v1/contents": "http://localhost:8005",
    "/api/v1/admin/articles": "http://localhost:8005",
    "/api/v1/pay": "http://localhost:8006",
    "/api/v1/message": "http://localhost:8007",
    "/api/v1/files": "http://localhost:8008",
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
    """路由转发"""
    # 查找目标服务
    target_service = None
    for route_prefix, service_url in SERVICE_ROUTES.items():
        if request.url.path.startswith(route_prefix):
            target_service = service_url
            break
    
    if not target_service:
        logger.warning(f"Service not found for path: {request.url.path}")
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "Service not found", "data": None}
        )
    
    # 构建目标URL
    target_url = f"{target_service}{request.url.path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    logger.info(f"Proxy: {request.method} {request.url.path} -> {target_url}")
    
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
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json()
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
