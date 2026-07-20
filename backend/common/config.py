"""
配置管理模块
"""
import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class DatabaseConfig(BaseSettings):
    """数据库配置"""
    model_config = {"env_prefix": "DATABASE__"}
    
    host: str = os.getenv("DB_HOST", "localhost")
    port: int = int(os.getenv("DB_PORT", "3306"))
    username: str = os.getenv("DB_USER", "root")
    password: str = os.getenv("DB_PASSWORD", "root")
    database: str = "petway"
    charset: str = "utf8mb4"
    
    @property
    def sqlalchemy_url(self) -> str:
        return f"mysql+aiomysql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}?charset={self.charset}"


class RedisConfig(BaseSettings):
    """Redis配置"""
    host: str = os.getenv("REDIS_HOST", "localhost")
    port: int = int(os.getenv("REDIS_PORT", "6379"))
    password: Optional[str] = os.getenv("REDIS_PASSWORD", None)
    db: int = 0


class JWTConfig(BaseSettings):
    """JWT配置"""
    secret: str = os.getenv("JWT_SECRET") or "petway-jwt-secret-2024"
    expire: int = 7200  # 2小时
    algorithm: str = "HS256"


class WechatConfig(BaseSettings):
    """微信配置"""
    model_config = SettingsConfigDict(env_prefix="WECHAT_", env_file=".env", extra="ignore")
    appid: str = ""
    appsecret: str = ""
    mchid: Optional[str] = None  # 商户号
    apikey: Optional[str] = None  # API密钥


class OSSConfig(BaseSettings):
    """阿里云OSS配置"""
    model_config = {"env_prefix": "OSS_", "extra": "ignore"}
    endpoint: str = ""
    access_key_id: str = ""
    access_key_secret: str = ""
    bucket: str = ""


class COSConfig(BaseSettings):
    """腾讯云COS配置"""
    model_config = {"env_prefix": "COS_", "extra": "ignore"}
    secret_id: str = ""
    secret_key: str = ""
    bucket: str = ""
    region: str = ""
    domain: str = ""  # 自定义域名（可选）


class Settings(BaseSettings):
    """全局配置"""
    # 服务配置
    app_name: str = "petway-service"
    app_port: int = 8000
    debug: bool = False
    app_env: str = os.getenv("APP_ENV", "development")  # development / production
    
    # 子配置
    database: DatabaseConfig = DatabaseConfig()
    redis: RedisConfig = RedisConfig()
    jwt: JWTConfig = JWTConfig()
    wechat: WechatConfig = WechatConfig()
    oss: OSSConfig = OSSConfig()
    cos: COSConfig = COSConfig()
    
    class Config:
        env_file = str(Path(__file__).parent.parent / ".env")
        env_nested_delimiter = "__"


@lru_cache()
def get_settings() -> Settings:
    """获取配置实例（单例）"""
    return Settings()


settings = get_settings()
