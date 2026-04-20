"""
微信服务
"""
import httpx
import jwt
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from common.config import settings
from common.exceptions import BadRequestException
from common.redis_client import redis_client

from app.models.user import User


class WechatService:
    """微信服务"""
    
    def __init__(self):
        self.appid = settings.wechat.appid
        self.appsecret = settings.wechat.appsecret
        self.jwt_secret = settings.jwt.secret
        self.jwt_expire = settings.jwt.expire
    
    async def login(self, code: str, db: AsyncSession) -> dict:
        """
        微信登录
        
        1. 用code换取openid和session_key
        2. 查找或创建用户
        3. 生成JWT token
        """
        # 调用微信接口获取openid
        openid, session_key = await self._get_openid_by_code(code)
        
        # 查找或创建用户
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.openid == openid))
        user = result.scalar_one_or_none()
        
        is_new_user = False
        if not user:
            # 创建新用户
            is_new_user = True
            user = User(
                openid=openid,
                nickname=f"微信用户",
                avatar="",
                status=1,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        # 生成token
        tokens = self._generate_tokens(user.id, openid)
        
        return {
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
        }
    
    async def _get_openid_by_code(self, code: str) -> tuple:
        """
        用code换取openid
        
        实际项目中调用微信 auth.code2Session 接口
        https://api.weixin.qq.com/sns/jscode2session
        """
        # TODO: 实际调用微信接口
        # 这里返回模拟数据
        return f"mock_openid_{code}", "mock_session_key"
    
    def _generate_tokens(self, user_id: int, openid: str) -> dict:
        """生成访问令牌和刷新令牌"""
        now = datetime.utcnow()
        
        # 访问令牌
        access_payload = {
            "user_id": user_id,
            "openid": openid,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(seconds=self.jwt_expire),
        }
        access_token = jwt.encode(access_payload, self.jwt_secret, algorithm="HS256")
        
        # 刷新令牌
        refresh_payload = {
            "user_id": user_id,
            "openid": openid,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=7),
        }
        refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm="HS256")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": self.jwt_expire,
        }
    
    async def refresh_token(self, refresh_token: str) -> dict:
        """刷新访问令牌"""
        try:
            payload = jwt.decode(refresh_token, self.jwt_secret, algorithms=["HS256"])
            
            if payload.get("type") != "refresh":
                raise BadRequestException("无效的刷新令牌")
            
            user_id = payload.get("user_id")
            openid = payload.get("openid")
            
            return self._generate_tokens(user_id, openid)
        except jwt.ExpiredSignatureError:
            raise BadRequestException("刷新令牌已过期")
        except jwt.InvalidTokenError:
            raise BadRequestException("无效的刷新令牌")
