"""
用户相关Schema
"""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    """用户基础信息"""
    nickname: Optional[str] = Field(None, max_length=50, description="昵称")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")
    real_name: Optional[str] = Field(None, max_length=50, description="真实姓名")
    id_card: Optional[str] = Field(None, max_length=18, description="身份证号")
    gender: int = Field(default=0, ge=0, le=2, description="0未知 1男 2女")
    birthday: Optional[date] = Field(None, description="生日")
    city: Optional[str] = Field(None, max_length=50, description="城市")


class UserCreate(UserBase):
    """创建用户"""
    openid: str = Field(..., max_length=64, description="微信openid")
    unionid: Optional[str] = Field(None, max_length=64, description="微信unionid")


class UserUpdate(UserBase):
    """更新用户"""
    pass


class UserResponse(UserBase):
    """用户响应"""
    id: int = Field(..., description="用户ID")
    member_level: int = Field(default=0, description="会员等级")
    member_points: int = Field(default=0, description="积分")
    status: int = Field(default=1, description="状态")
    created_at: datetime = Field(..., description="创建时间")
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """用户登录"""
    code: str = Field(..., description="微信登录code")


class WechatLoginResponse(BaseModel):
    """微信登录响应"""
    access_token: str = Field(..., description="访问令牌")
    refresh_token: str = Field(..., description="刷新令牌")
    expires_in: int = Field(..., description="过期时间（秒）")
    is_new_user: bool = Field(default=False, description="是否新用户")
    user: UserResponse = Field(..., description="用户信息")
