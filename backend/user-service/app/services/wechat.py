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
    
    async def login(self, code: str, db: AsyncSession, phone_code: str = None) -> dict:
        """
        微信登录
        
        1. 用code换取openid和session_key
        2. 如有phone_code，获取用户手机号
        3. 查找或创建用户
        4. 生成JWT token
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # 调用微信接口获取openid
        openid, session_key = await self._get_openid_by_code(code)
        
        # 获取手机号
        phone = None
        logger.info(f"[Login] phone_code present: {bool(phone_code)}")
        if phone_code:
            try:
                phone = await self._get_phone_by_code(phone_code)
                logger.info(f"[Login] Got phone: {phone}")
            except Exception as e:
                logger.error(f"[Login] Failed to get phone: {e}", exc_info=True)
        
        # 查找或创建用户
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.openid == openid))
        user = result.scalar_one_or_none()
        
        is_new_user = False
        if not user:
            # 创建新用户
            is_new_user = True
            # 生成随机默认昵称，避免所有新用户都一样
            import random, string
            suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
            user = User(
                openid=openid,
                nickname=f"尾巴人_{suffix}",
                avatar="",
                status=1,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        # 更新手机号（如果获取到了且用户当前没有手机号）
        if phone and not user.phone:
            user.phone = phone
            await db.commit()
            await db.refresh(user)
            logger.info(f"[Login] Updated user phone: {phone}")
        
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
        用code换取openid和session_key
        
        配置了微信appid/appsecret时真实调用微信接口，
        未配置时回退到mock模式（仅开发测试使用）
        """
        # 未配置微信参数时使用mock模式（包含占位符值）
        if not self.appid or not self.appsecret or self.appid == 'your-app-id':
            import logging
            logging.getLogger(__name__).warning(
                "WeChat appid/appsecret not configured, using mock openid. "
                "Set WECHAT__APPID and WECHAT__APPSECRET env vars for production."
            )
            return f"mock_openid_{code}", "mock_session_key"
        
        # 真实调用微信 jscode2session 接口
        url = "https://api.weixin.qq.com/sns/jscode2session"
        params = {
            "appid": self.appid,
            "secret": self.appsecret,
            "js_code": code,
            "grant_type": "authorization_code"
        }
        
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                result = response.json()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to call WeChat API: {e}")
            raise BadRequestException("微信登录服务暂时不可用，请稍后重试")
        
        # 处理微信返回错误
        errcode = result.get("errcode")
        if errcode is not None and errcode != 0:
            errmsg = result.get("errmsg", "未知错误")
            import logging
            logging.getLogger(__name__).error(f"WeChat API error: {errcode} - {errmsg}")
            
            # 常见错误码处理
            error_map = {
                -1: "微信系统繁忙，请稍后重试",
                40029: "登录凭证(code)已失效，请重新授权",
                40163: "登录凭证(code)已被使用，请重新授权",
                45009: "微信接口调用频次限制",
            }
            raise BadRequestException(error_map.get(errcode, f"微信登录失败: {errmsg}"))
        
        openid = result.get("openid")
        session_key = result.get("session_key")
        
        if not openid:
            raise BadRequestException("微信登录失败，未获取到用户openid")
        
        return openid, session_key
    
    def _generate_tokens(self, user_id: int, openid: str) -> dict:
        """生成访问令牌和刷新令牌"""
        import time
        now_ts = int(time.time())
        
        # 访问令牌
        access_payload = {
            "user_id": user_id,
            "openid": openid,
            "type": "access",
            "iat": now_ts,
            "exp": now_ts + self.jwt_expire,
        }
        access_token = jwt.encode(access_payload, self.jwt_secret, algorithm="HS256")
        
        # 刷新令牌
        refresh_payload = {
            "user_id": user_id,
            "openid": openid,
            "type": "refresh",
            "iat": now_ts,
            "exp": now_ts + 7 * 24 * 3600,
        }
        refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm="HS256")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": self.jwt_expire,
        }
    
    async def _get_access_token(self) -> str:
        """获取微信access_token（带缓存）"""
        import logging
        logger = logging.getLogger(__name__)
        
        cache_key = f"wechat_access_token:{self.appid}"
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                logger.info("[Wechat] Using cached access_token")
                return cached
        except Exception as e:
            logger.warning(f"[Wechat] Redis get failed: {e}")
        
        url = "https://api.weixin.qq.com/cgi-bin/token"
        params = {
            "grant_type": "client_credential",
            "appid": self.appid,
            "secret": self.appsecret,
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            result = response.json()
        
        access_token = result.get("access_token")
        expires_in = result.get("expires_in", 7200)
        
        if not access_token:
            errcode = result.get("errcode")
            errmsg = result.get("errmsg", "未知错误")
            raise BadRequestException(f"获取微信access_token失败: {errmsg}")
        
        logger.info(f"[Wechat] Got new access_token, expires_in={expires_in}")
        
        # 缓存，提前5分钟过期
        try:
            await redis_client.set(cache_key, access_token, expire=int(expires_in) - 300)
        except Exception as e:
            logger.warning(f"[Wechat] Redis set failed: {e}")
        
        return access_token
    
    async def _get_phone_by_code(self, phone_code: str) -> str:
        """用code换取用户手机号"""
        if not self.appid or not self.appsecret or self.appid == 'your-app-id':
            import logging
            logging.getLogger(__name__).warning("WeChat not configured, skip phone get")
            return None
        
        access_token = await self._get_access_token()
        url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json={"code": phone_code})
            result = response.json()
        
        errcode = result.get("errcode")
        if errcode is not None and errcode != 0:
            errmsg = result.get("errmsg", "未知错误")
            raise BadRequestException(f"获取手机号失败: {errmsg}")
        
        phone_info = result.get("phone_info", {})
        phone = phone_info.get("purePhoneNumber") or phone_info.get("phoneNumber")
        return phone
    
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
