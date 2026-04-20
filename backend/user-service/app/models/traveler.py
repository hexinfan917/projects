"""
出行人模型
对应用户的常用出行人档案
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class Traveler(Base):
    """出行人表"""
    __tablename__ = "travelers"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="出行人ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="所属用户ID")
    
    # 基本信息
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="手机号")
    id_card: Mapped[Optional[str]] = mapped_column(String(18), nullable=True, comment="身份证号")
    gender: Mapped[int] = mapped_column(Integer, default=0, comment="0未知 1男 2女")
    birthday: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="生日")
    
    # 紧急联系人
    emergency_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="紧急联系人姓名")
    emergency_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="紧急联系人电话")
    
    # 其他信息
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="备注")
    is_default: Mapped[int] = mapped_column(Integer, default=0, comment="0否 1是默认出行人")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0删除 1正常")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
