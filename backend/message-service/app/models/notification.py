"""
通知/消息模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class Notification(Base):
    """通知表"""
    __tablename__ = "notifications"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="接收用户ID，0为全局广播")
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="通知标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="通知内容")
    notify_type: Mapped[str] = mapped_column(String(50), default="system", comment="类型: system系统 order订单 route路线")
    biz_id: Mapped[Optional[int]] = mapped_column(Integer, comment="业务ID（如订单ID）")
    biz_type: Mapped[Optional[str]] = mapped_column(String(50), comment="业务类型")
    
    # 状态
    is_read: Mapped[int] = mapped_column(Integer, default=0, comment="0未读 1已读")
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # 推送状态
    push_status: Mapped[int] = mapped_column(Integer, default=0, comment="0未推送 1已推送 2推送失败")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
