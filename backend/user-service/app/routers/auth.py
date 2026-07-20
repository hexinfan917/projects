"""
认证路由
"""
from fastapi import APIRouter, Depends, HTTPException, Body
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
    - **phone_code**: 微信手机号凭证（可选）
    """
    try:
        result = await wechat_service.login(login_data.code, db, phone_code=login_data.phone_code)
        return success(result)
    except Exception as e:
        logger.error(f"Wechat login failed: {e}")
        return error(message="登录失败")


@router.post("/admin/login")
async def admin_login(login_data: dict, db: AsyncSession = Depends(get_db)):
    """
    管理后台登录
    
    - **username**: 管理员账号
    - **password**: 管理员密码
    """
    try:
        username = login_data.get("username")
        password = login_data.get("password")
        
        import bcrypt
        from sqlalchemy import select
        from app.models.admin_user import AdminUser
        
        result = await db.execute(select(AdminUser).where(AdminUser.username == username))
        admin = result.scalar_one_or_none()
        
        if not admin:
            return error(message="账号或密码错误")
        
        if not bcrypt.checkpw(password.encode("utf-8"), admin.password.encode("utf-8")):
            return error(message="账号或密码错误")
        
        if admin.status != 1:
            return error(message="账号已被禁用")
        
        import jwt
        from datetime import datetime, timedelta
        from common.config import settings
        
        now = datetime.utcnow()
        payload = {
            "id": admin.id,
            "user_id": admin.id,
            "username": admin.username,
            "openid": admin.username,
            "role": admin.role.code if admin.role else "admin",
            "type": "access",
            "iat": now,
            "exp": now + timedelta(hours=8),
        }
        token = jwt.encode(payload, settings.jwt.secret, algorithm=settings.jwt.algorithm)
        
        # 更新最后登录时间
        admin.last_login_at = now
        await db.commit()
        
        return success({
            "token": token,
            "role": admin.role.code if admin.role else "admin",
            "username": admin.username
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
    data: dict = Body(default={}),
    db: AsyncSession = Depends(get_db)
):
    """
    测试登录（开发环境专用）
    支持传入 test_id 切换不同测试用户
    """
    from common.config import settings
    if settings.app_env == "production":
        return error(message="测试登录仅在开发环境可用")
    
    from sqlalchemy import select
    from app.models.user import User
    from app.services.wechat import WechatService
    
    wechat_service = WechatService()
    test_id = (data or {}).get("test_id", "")
    openid = f"test_openid_{test_id}" if test_id else "test_openid_default"
    
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()
    
    is_new_user = False
    if not user:
        is_new_user = True
        user = User(
            openid=openid,
            nickname=f"测试用户{test_id}" if test_id else "测试用户",
            avatar="",
            phone=f"138001380{test_id}"[-4:] if test_id else "13800138000",
            status=1,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    tokens = wechat_service._generate_tokens(user.id, openid)
    
    return success({
        **tokens,
        "is_new_user": is_new_user,
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
