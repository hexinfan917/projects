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


# 内存缓存（Redis 不可用时降级）
_memory_cache = {}

import asyncio
import logging
import random
import string
import time

logger = logging.getLogger(__name__)


class WechatService:
    """微信服务"""
    
    def __init__(self):
        self.appid = settings.wechat.appid
        self.appsecret = settings.wechat.appsecret
        self.jwt_secret = settings.jwt.secret
        self.jwt_expire = settings.jwt.expire
        # 复用 HTTP client，减少 TLS 握手开销
        self._client = httpx.AsyncClient(timeout=10.0)
    
    async def login(self, code: str, db: AsyncSession, phone_code: str = None) -> dict:
        """
        微信登录
        
        1. 用code换取openid和session_key
        2. 如有phone_code，获取用户手机号
        3. 查找或创建用户
        4. 生成JWT token
        """
        start_time = time.time()
        
        # 并行获取 openid 和手机号（互不依赖）
        if phone_code:
            openid_task = self._get_openid_by_code(code)
            phone_task = self._get_phone_by_code(phone_code)
            (openid, session_key), phone = await asyncio.gather(openid_task, phone_task)
        else:
            openid, session_key = await self._get_openid_by_code(code)
            phone = None
        
        logger.info(f"[Login] WeChat APIs done in {(time.time() - start_time)*1000:.0f}ms")
        
        # 查找或创建用户
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.openid == openid))
        user = result.scalar_one_or_none()
        
        # 开发环境：如果根据 openid 找不到用户，尝试根据手机号查找（避免重复创建用户）
        if not user and phone and openid == "mock_openid_dev":
            result = await db.execute(select(User).where(User.phone == phone))
            user = result.scalar_one_or_none()
            if user:
                logger.info(f"[Login] Found existing user by phone in dev mode: user_id={user.id}")
        
        is_new_user = False
        if not user:
            # 创建新用户
            is_new_user = True
            suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
            user = User(
                openid=openid,
                nickname=f"尾巴人_{suffix}",
                avatar="",
                status=1,
            )
            db.add(user)
        
        # 更新手机号（如果获取到了且用户当前没有手机号）
        if phone and not user.phone:
            user.phone = phone
            logger.info(f"[Login] Updated user phone: {phone}")
        
        # 保存/更新 session_key（虚拟支付签名需要）
        if session_key and session_key != "mock_session_key":
            user.session_key = session_key
        
        # 只 commit 一次
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"[Login] DB operations done in {(time.time() - start_time)*1000:.0f}ms")
        
        # 生成token
        tokens = self._generate_tokens(user.id, openid)
        
        total_time = (time.time() - start_time) * 1000
        logger.info(f"[Login] Total time: {total_time:.0f}ms")
        
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
            return "mock_openid_dev", "mock_session_key"
        
        # 真实调用微信 jscode2session 接口
        url = "https://api.weixin.qq.com/sns/jscode2session"
        params = {
            "appid": self.appid,
            "secret": self.appsecret,
            "js_code": code,
            "grant_type": "authorization_code"
        }
        
        try:
            response = await self._client.get(url, params=params)
            result = response.json()
        except Exception as e:
            logger.error(f"Failed to call WeChat API: {e}")
            raise BadRequestException("微信登录服务暂时不可用，请稍后重试")
        
        # 处理微信返回错误
        errcode = result.get("errcode")
        if errcode is not None and errcode != 0:
            errmsg = result.get("errmsg", "未知错误")
            logger.error(f"WeChat API error: {errcode} - {errmsg}")
            
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
        
        cache_key = f"wechat_access_token:{self.appid}"
        
        # 尝试从 Redis 获取
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                logger.info("[Wechat] Using cached access_token from Redis")
                return cached
        except Exception as e:
            logger.warning(f"[Wechat] Redis get failed: {e}")
        
        # 尝试从内存缓存获取（Redis 不可用时降级）
        memory_cached = _memory_cache.get(cache_key)
        if memory_cached and memory_cached['expire_at'] > time.time():
            logger.info("[Wechat] Using cached access_token from memory")
            return memory_cached['token']
        
        # 从微信服务器获取
        url = "https://api.weixin.qq.com/cgi-bin/token"
        params = {
            "grant_type": "client_credential",
            "appid": self.appid,
            "secret": self.appsecret,
        }
        
        response = await self._client.get(url, params=params)
        result = response.json()
        
        access_token = result.get("access_token")
        expires_in = result.get("expires_in", 7200)
        
        if not access_token:
            errcode = result.get("errcode")
            errmsg = result.get("errmsg", "未知错误")
            raise BadRequestException(f"获取微信access_token失败: {errmsg}")
        
        logger.info(f"[Wechat] Got new access_token, expires_in={expires_in}")
        
        # 缓存到 Redis
        try:
            await redis_client.set(cache_key, access_token, expire=int(expires_in) - 300)
        except Exception as e:
            logger.warning(f"[Wechat] Redis set failed: {e}")
        
        # 同时缓存到内存（作为 Redis 降级）
        _memory_cache[cache_key] = {
            'token': access_token,
            'expire_at': time.time() + int(expires_in) - 300
        }
        
        return access_token
    
    async def _get_phone_by_code(self, phone_code: str) -> str:
        """用code换取用户手机号"""
        
        logger.info(f"[_get_phone_by_code] appid={self.appid}, appsecret={'set' if self.appsecret else 'empty'}")
        
        if not self.appid or not self.appsecret or self.appid == 'your-app-id':
            logger.warning("WeChat not configured, skip phone get")
            return None
        
        # 开发环境可跳过手机号获取，避免浪费 API 次数
        # 同时支持 APP_ENV / ENV 环境变量，以及 ENABLE_WECHAT_PHONE 强制开启
        import os
        env = (
            os.environ.get('APP_ENV') or
            os.environ.get('ENV') or
            os.environ.get('env') or
            'development'
        ).lower()
        force_phone = os.environ.get('ENABLE_WECHAT_PHONE', '').lower() in ('1', 'true', 'yes', 'on')
        is_dev = env in ('development', 'dev', 'local', 'test')

        if is_dev and not force_phone:
            logger.info("[_get_phone_by_code] Development mode, skipping phone number fetch to save API quota. Set ENABLE_WECHAT_PHONE=true to enable.")
            return None
        
        # 尝试获取手机号，如果失败则清除缓存重试一次
        for attempt in range(2):
            try:
                access_token = await self._get_access_token()
                logger.info(f"[_get_phone_by_code] access_token={'ok' if access_token else 'failed'}")
                
                url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}"
                
                response = await self._client.post(url, json={"code": phone_code})
                result = response.json()
                
                logger.info(f"[_get_phone_by_code] wx response: {result}")
                
                errcode = result.get("errcode")
                if errcode is not None and errcode != 0:
                    errmsg = result.get("errmsg", "未知错误")
                    # 如果是 access_token 过期，清除缓存重试
                    if errcode == 40001 and attempt == 0:
                        logger.warning(f"[_get_phone_by_code] access_token expired, clearing cache and retrying")
                        cache_key = f"wechat_access_token:{self.appid}"
                        _memory_cache.pop(cache_key, None)
                        try:
                            await redis_client.delete(cache_key)
                        except:
                            pass
                        continue
                    raise BadRequestException(f"获取手机号失败: {errmsg}")
                
                phone_info = result.get("phone_info", {})
                phone = phone_info.get("purePhoneNumber") or phone_info.get("phoneNumber")
                return phone
            except BadRequestException:
                if attempt == 0:
                    continue
                raise
        
        return None
    
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
