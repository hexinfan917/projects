"""
自定义异常模块
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from common.response import ResponseCode, ResponseMessage


class APIException(Exception):
    """API异常基类"""
    
    def __init__(
        self,
        code: int = ResponseCode.INTERNAL_ERROR,
        message: str = None,
        data: dict = None
    ):
        self.code = code
        self.message = message or ResponseMessage.get(code)
        self.data = data or {}
        super().__init__(self.message)


class BadRequestException(APIException):
    """参数错误异常"""
    def __init__(self, message: str = None):
        super().__init__(ResponseCode.BAD_REQUEST, message)


class UnauthorizedException(APIException):
    """未授权异常"""
    def __init__(self, message: str = None):
        super().__init__(ResponseCode.UNAUTHORIZED, message)


class ForbiddenException(APIException):
    """禁止访问异常"""
    def __init__(self, message: str = None):
        super().__init__(ResponseCode.FORBIDDEN, message)


class NotFoundException(APIException):
    """资源不存在异常"""
    def __init__(self, message: str = None):
        super().__init__(ResponseCode.NOT_FOUND, message)


class ConflictException(APIException):
    """冲突异常"""
    def __init__(self, message: str = None):
        super().__init__(ResponseCode.CONFLICT, message)


async def api_exception_handler(request: Request, exc: APIException):
    """API异常处理器"""
    # 根据业务码映射HTTP状态码
    http_status_map = {
        200: 200,  # 成功
        400: 400,  # 参数错误
        401: 401,  # 未授权
        403: 403,  # 禁止访问
        404: 404,  # 资源不存在
        409: 409,  # 冲突
        429: 429,  # 请求过快
        500: 500,  # 服务器错误
    }
    http_status = http_status_map.get(exc.code, 200)
    
    return JSONResponse(
        status_code=http_status,
        content={
            "code": exc.code,
            "message": exc.message,
            "data": exc.data,
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """通用异常处理器"""
    from common.logger import logger
    logger.exception(f"Unhandled exception: {exc}")
    
    return JSONResponse(
        status_code=200,
        content={
            "code": ResponseCode.INTERNAL_ERROR,
            "message": ResponseMessage.get(ResponseCode.INTERNAL_ERROR),
            "data": None,
        }
    )
