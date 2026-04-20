"""
Redis客户端模块
"""
import json
from typing import Any, Optional, Union
import redis.asyncio as redis
from common.config import settings


class RedisClient:
    """Redis客户端"""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
    
    async def connect(self):
        """连接Redis"""
        self._client = redis.Redis(
            host=settings.redis.host,
            port=settings.redis.port,
            password=settings.redis.password,
            db=settings.redis.db,
            decode_responses=True,
        )
    
    async def close(self):
        """关闭连接"""
        if self._client:
            await self._client.close()
    
    async def get(self, key: str) -> Optional[str]:
        """获取字符串值"""
        return await self._client.get(key)
    
    async def get_json(self, key: str) -> Optional[Any]:
        """获取JSON值"""
        value = await self._client.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def set(
        self,
        key: str,
        value: Union[str, Any],
        expire: Optional[int] = None
    ):
        """设置值"""
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        await self._client.set(key, value, ex=expire)
    
    async def delete(self, key: str):
        """删除键"""
        await self._client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        return await self._client.exists(key) > 0
    
    async def expire(self, key: str, seconds: int):
        """设置过期时间"""
        await self._client.expire(key, seconds)
    
    async def incr(self, key: str) -> int:
        """自增"""
        return await self._client.incr(key)
    
    async def decr(self, key: str) -> int:
        """自减"""
        return await self._client.decr(key)
    
    # 集合操作
    async def sadd(self, key: str, *members):
        """添加集合成员"""
        await self._client.sadd(key, *members)
    
    async def sismember(self, key: str, member) -> bool:
        """检查是否是集合成员"""
        return await self._client.sismember(key, member)
    
    # 列表操作
    async def lpush(self, key: str, *values):
        """列表左侧添加"""
        await self._client.lpush(key, *values)
    
    async def rpop(self, key: str):
        """列表右侧弹出"""
        return await self._client.rpop(key)
    
    async def lrange(self, key: str, start: int, end: int):
        """获取列表范围"""
        return await self._client.lrange(key, start, end)


# 全局Redis客户端实例
redis_client = RedisClient()
