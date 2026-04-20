"""
出行人相关 Schema
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TravelerBase(BaseModel):
    """出行人基础信息"""
    name: str = Field(..., max_length=50, description="姓名")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")
    id_card: Optional[str] = Field(None, max_length=18, description="身份证号")
    gender: int = Field(default=0, ge=0, le=2, description="0未知 1男 2女")
    birthday: Optional[str] = Field(None, description="生日(YYYY-MM-DD)")
    emergency_name: Optional[str] = Field(None, max_length=50, description="紧急联系人姓名")
    emergency_phone: Optional[str] = Field(None, max_length=20, description="紧急联系人电话")
    remark: Optional[str] = Field(None, description="备注")
    is_default: int = Field(default=0, ge=0, le=1, description="0否 1是默认出行人")


class TravelerCreate(TravelerBase):
    """创建出行人"""
    pass


class TravelerUpdate(TravelerBase):
    """更新出行人"""
    pass


class TravelerResponse(TravelerBase):
    """出行人响应"""
    id: int = Field(..., description="出行人ID")
    user_id: int = Field(..., description="所属用户ID")
    status: int = Field(default=1, description="状态")
    created_at: Optional[str] = Field(None, description="创建时间")
    updated_at: Optional[str] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
