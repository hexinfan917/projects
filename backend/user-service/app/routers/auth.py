"""
认证路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import get_db
from common.response import success, error
from common.logger import logger

from app.schemas.user import UserLogin, WechatLoginResponse
from app.services.wechat import WechatService

router = APIRouter()
wechat_service = WechatService()


@router.post("/wechat/login", response_model=WechatLoginResponse)
async def wechat_login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    微信登录
    
    - **code**: 微信登录凭证
    """
    try:
        result = await wechat_service.login(login_data.code, db)
        return success(result)
    except Exception as e:
        logger.error(f"Wechat login failed: {e}")
        return error(message="登录失败")


@router.post("/admin/login")
async def admin_login(login_data: dict):
    """
    管理后台登录
    
    - **username**: 管理员账号
    - **password**: 管理员密码
    """
    try:
        username = login_data.get("username")
        password = login_data.get("password")
        if username != "admin" or password != "admin123":
            return error(message="账号或密码错误")
        
        import jwt
        from datetime import datetime, timedelta
        from common.config import settings
        
        now = datetime.utcnow()
        payload = {
            "user_id": 0,
            "openid": "admin",
            "role": "admin",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=8),
        }
        token = jwt.encode(payload, settings.jwt.secret, algorithm=settings.jwt.algorithm)
        
        return success({
            "token": token,
            "role": "admin",
            "username": "admin"
        })
    except Exception as e:
        logger.error(f"Admin login failed: {e}")
        return error(message="登录失败")


@router.post("/wechat/refresh")
async def refresh_token(refresh_token: str):
    """
    刷新Token
    
    - **refresh_token**: 刷新令牌
    """
    try:
        result = await wechat_service.refresh_token(refresh_token)
        return success(result)
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return error(message="刷新失败")


@router.post("/logout")
async def logout():
    """用户登出"""
    # TODO: 实现登出逻辑（清除token等）
    return success(message="登出成功")


@router.post("/test/login", response_model=WechatLoginResponse)
async def test_login(
    db: AsyncSession = Depends(get_db)
):
    """
    测试登录（开发环境专用）
    直接返回固定测试用户的登录态
    """
    from sqlalchemy import select
    from app.models.user import User
    from app.services.wechat import WechatService
    
    wechat_service = WechatService()
    openid = "test_openid_default"
    
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            openid=openid,
            nickname="测试用户",
            avatar="",
            phone="13800138000",
            status=1,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    tokens = wechat_service._generate_tokens(user.id, openid)
    
    return success({
        **tokens,
        "is_new_user": False,
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "phone": user.phone,
            "gender": user.gender,
            "member_level": user.member_level,
            "member_points": user.member_points,
        }
    })
