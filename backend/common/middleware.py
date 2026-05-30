"""
FastAPI中间件模块
"""
import os
import time
import uuid
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from common.logger import logger


class RequestLogMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start_time = time.time()
        response: Response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"- Status: {response.status_code} - Time: {process_time:.2f}ms"
        )
        response.headers["X-Request-ID"] = request_id
        return response


class ExceptionMiddleware(BaseHTTPMiddleware):
    """异常处理中间件"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            logger.exception(f"Unhandled exception: {e}")
            from common.response import internal_error
            return internal_error("服务器内部错误")


def setup_cors(app, allow_origins=None):
    """配置CORS - 生产环境只允许 tailtravel.cn"""
    if allow_origins is None:
        # 生产环境限制域名，开发环境允许所有
        app_env = os.environ.get("APP_ENV", "development")
        if app_env == "production":
            allow_origins = [
                "https://tailtravel.cn",
                "https://tailtravel.westilt.com",
            ]
        else:
            allow_origins = ["*"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
    )
