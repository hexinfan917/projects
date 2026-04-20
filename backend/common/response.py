"""
统一响应格式模块
"""
from typing import Any, Optional
from fastapi.responses import JSONResponse


class ResponseCode:
    """响应状态码"""
    SUCCESS = 200
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    TOO_MANY = 429
    INTERNAL_ERROR = 500


class ResponseMessage:
    """响应消息"""
    MESSAGES = {
        ResponseCode.SUCCESS: "success",
        ResponseCode.BAD_REQUEST: "参数错误",
        ResponseCode.UNAUTHORIZED: "未授权",
        ResponseCode.FORBIDDEN: "禁止访问",
        ResponseCode.NOT_FOUND: "资源不存在",
        ResponseCode.CONFLICT: "冲突",
        ResponseCode.TOO_MANY: "请求过快",
        ResponseCode.INTERNAL_ERROR: "服务器错误",
    }
    
    @classmethod
    def get(cls, code: int) -> str:
        return cls.MESSAGES.get(code, "未知错误")


class APIResponse(JSONResponse):
    """统一API响应"""
    
    def __init__(
        self,
        code: int = ResponseCode.SUCCESS,
        message: Optional[str] = None,
        data: Any = None,
        request_id: Optional[str] = None,
        **kwargs
    ):
        content = {
            "code": code,
            "message": message or ResponseMessage.get(code),
            "data": data,
        }
        if request_id:
            content["request_id"] = request_id
        
        super().__init__(content=content, **kwargs)


def success(data: Any = None, message: str = "success") -> APIResponse:
    """成功响应"""
    return APIResponse(code=ResponseCode.SUCCESS, message=message, data=data)


def error(
    code: int = ResponseCode.INTERNAL_ERROR,
    message: Optional[str] = None
) -> APIResponse:
    """错误响应"""
    return APIResponse(code=code, message=message or ResponseMessage.get(code))


def bad_request(message: Optional[str] = None) -> APIResponse:
    """参数错误"""
    return error(ResponseCode.BAD_REQUEST, message)


def unauthorized(message: Optional[str] = None) -> APIResponse:
    """未授权"""
    return error(ResponseCode.UNAUTHORIZED, message)


def forbidden(message: Optional[str] = None) -> APIResponse:
    """禁止访问"""
    return error(ResponseCode.FORBIDDEN, message)


def not_found(message: Optional[str] = None) -> APIResponse:
    """资源不存在"""
    return error(ResponseCode.NOT_FOUND, message)


def conflict(message: Optional[str] = None) -> APIResponse:
    """冲突"""
    return error(ResponseCode.CONFLICT, message)


def too_many(message: Optional[str] = None) -> APIResponse:
    """请求过快"""
    return error(ResponseCode.TOO_MANY, message)


def internal_error(message: Optional[str] = None) -> APIResponse:
    """服务器错误"""
    return error(ResponseCode.INTERNAL_ERROR, message)
