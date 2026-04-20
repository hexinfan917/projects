"""
FastAPI依赖模块
"""
from typing import Optional
from fastapi import Header, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import get_db
from common.redis_client import redis_client
from common.config import settings
import jwt

security = HTTPBearer(auto_error=False)


async def get_db_session() -> AsyncSession:
    """获取数据库会话"""
    async for session in get_db():
        return session


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    获取当前登录用户
    
    从Authorization头中解析JWT token
    开发环境支持特殊mock token
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="缺少认证信息")
    
    token = credentials.credentials
    
    # 开发环境支持mock token
    if token.startswith('mock_token_') or token.endswith('_dev'):
        return {
            "user_id": 1,
            "openid": "mock_openid_dev",
            "token": token,
        }
    
    try:
        payload = jwt.decode(
            token,
            settings.jwt.secret,
            algorithms=[settings.jwt.algorithm]
        )
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="无效的Token")
        
        return {
            "user_id": user_id,
            "openid": payload.get("openid"),
            "token": token,
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的Token")


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """可选的用户认证（未登录返回None）"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None


async def get_pagination(
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """获取分页参数"""
    return {
        "page": max(1, page),
        "page_size": min(100, max(1, page_size)),
        "offset": (max(1, page) - 1) * min(100, max(1, page_size)),
    }


async def verify_wechat_signature(
    signature: str = Header(None, alias="X-Wechat-Signature"),
    timestamp: str = Header(None, alias="X-Wechat-Timestamp"),
    nonce: str = Header(None, alias="X-Wechat-Nonce"),
):
    """验证微信签名（用于微信支付回调等）"""
    # TODO: 实现微信签名验证逻辑
    pass
