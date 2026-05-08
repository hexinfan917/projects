"""
公益活动模型
"""
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, Date, DateTime, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class CharityActivity(Base):
    """公益活动表"""
    __tablename__ = "charity_activities"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="活动标题")
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), comment="副标题")
    cover_image: Mapped[Optional[str]] = mapped_column(String(500), comment="封面图")
    images: Mapped[Optional[list]] = mapped_column(JSON, comment="活动图集")
    
    # 活动信息
    activity_type: Mapped[str] = mapped_column(String(50), default="volunteer", comment="类型: volunteer义工 rescue救助 donate捐赠 adopt领养")
    content: Mapped[str] = mapped_column(LONGTEXT, nullable=False, comment="活动内容")
    location: Mapped[Optional[str]] = mapped_column(String(200), comment="活动地点")
    start_date: Mapped[Optional[date]] = mapped_column(Date, comment="开始日期")
    end_date: Mapped[Optional[date]] = mapped_column(Date, comment="结束日期")
    
    # 参与信息
    max_participants: Mapped[int] = mapped_column(Integer, default=0, comment="0不限")
    require_city: Mapped[int] = mapped_column(Integer, default=0, comment="是否必填城市: 0否 1是")
    require_emergency: Mapped[int] = mapped_column(Integer, default=0, comment="是否必填紧急联系人: 0否 1是")
    disclaimer: Mapped[Optional[str]] = mapped_column(Text, comment="免责条款内容")
    current_participants: Mapped[int] = mapped_column(Integer, default=0)
    contact_name: Mapped[Optional[str]] = mapped_column(String(50))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    
    # 机构信息
    organizer: Mapped[Optional[str]] = mapped_column(String(100), comment="主办机构")
    
    # 状态: 0草稿 1报名中 2进行中 3已结束 4已取消
    status: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class CharityRegistration(Base):
    """公益活动报名表"""
    __tablename__ = "charity_registrations"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    activity_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="活动ID")
    openid: Mapped[str] = mapped_column(String(100), nullable=False, comment="小程序用户openid")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, comment="联系电话")
    participant_count: Mapped[int] = mapped_column(Integer, default=1, comment="参与人数")
    agree_disclaimer: Mapped[int] = mapped_column(Integer, default=0, comment="是否同意免责条款: 0否 1是")
    city: Mapped[Optional[str]] = mapped_column(String(100), comment="所在城市/区域")
    remark: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    emergency_name: Mapped[Optional[str]] = mapped_column(String(50), comment="紧急联系人姓名")
    emergency_phone: Mapped[Optional[str]] = mapped_column(String(20), comment="紧急联系人电话")
    # 状态: 0待审核 1已通过 2已拒绝 3已签到
    status: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
