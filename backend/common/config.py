"""
配置管理模块
"""
import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class DatabaseConfig(BaseSettings):
    """数据库配置"""
    model_config = {"env_prefix": "DATABASE__"}
    
    host: str = "localhost"
    port: int = 3306
    username: str = "root"
    password: str = "root"
    database: str = "petway"
    charset: str = "utf8mb4"
    
    @property
    def sqlalchemy_url(self) -> str:
        return f"mysql+aiomysql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}?charset={self.charset}"


class RedisConfig(BaseSettings):
    """Redis配置"""
    host: str = "localhost"
    port: int = 6379
    password: Optional[str] = None
    db: int = 0


class JWTConfig(BaseSettings):
    """JWT配置"""
    secret: str = "your-secret-key"
    expire: int = 7200  # 2小时
    algorithm: str = "HS256"


class WechatConfig(BaseSettings):
    """微信配置"""
    appid: str = ""
    appsecret: str = ""
    mchid: Optional[str] = None  # 商户号
    apikey: Optional[str] = None  # API密钥


class OSSConfig(BaseSettings):
    """阿里云OSS配置"""
    endpoint: str = ""
    access_key_id: str = ""
    access_key_secret: str = ""
    bucket: str = ""


class Settings(BaseSettings):
    """全局配置"""
    # 服务配置
    app_name: str = "petway-service"
    app_port: int = 8000
    debug: bool = False
    
    # 子配置
    database: DatabaseConfig = DatabaseConfig()
    redis: RedisConfig = RedisConfig()
    jwt: JWTConfig = JWTConfig()
    wechat: WechatConfig = WechatConfig()
    oss: OSSConfig = OSSConfig()
    
    class Config:
        env_file = str(Path(__file__).parent.parent / ".env")
        env_nested_delimiter = "__"


@lru_cache()
def get_settings() -> Settings:
    """获取配置实例（单例）"""
    return Settings()


settings = get_settings()
