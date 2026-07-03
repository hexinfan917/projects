"""
退款记录模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DECIMAL, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class RefundRecord(Base):
    """退款记录表"""
    __tablename__ = "refund_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="关联订单ID")
    refund_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, comment="退款单号")
    amount: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, comment="退款金额")
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="退款原因")
    type: Mapped[str] = mapped_column(String(20), default="partial", comment="full-全额 partial-部分")
    status: Mapped[int] = mapped_column(Integer, default=10, comment="10-处理中 20-成功 30-失败")
    transaction_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="微信退款单号")
    fail_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="失败原因")
    operator_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="操作人ID(管理员)")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
