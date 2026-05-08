"""
订单模型
"""
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Integer, Text, JSON, DECIMAL, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


class Order(Base):
    """订单表"""
    __tablename__ = "orders"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, comment="订单编号")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="用户ID")
    schedule_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="排期ID")
    route_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="路线ID")
    route_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="路线名称")
    route_cover: Mapped[Optional[str]] = mapped_column(String(500), comment="路线封面图")
    travel_date: Mapped[date] = mapped_column(Date, nullable=False, comment="出行日期")
    
    # 人数统计
    participant_count: Mapped[int] = mapped_column(Integer, default=1, comment="出行人数")
    pet_count: Mapped[int] = mapped_column(Integer, default=0, comment="宠物数量")
    participants: Mapped[Optional[list]] = mapped_column(JSON, comment="出行人信息")
    pets: Mapped[Optional[list]] = mapped_column(JSON, comment="宠物信息")
    contact: Mapped[Optional[dict]] = mapped_column(JSON, comment="联系人信息")
    
    # 费用明细
    route_price: Mapped[float] = mapped_column(DECIMAL(10, 2), comment="路线单价")
    insurance_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="保险费用")
    equipment_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="装备租赁费")
    discount_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="优惠金额")
    total_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), comment="订单总金额")
    pay_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), comment="实付金额")
    
    # 支付信息
    status: Mapped[int] = mapped_column(Integer, default=10, comment="10待支付 20待出行 30已取消 40退款中 50已退款 60已完成 70已评价")
    pay_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="支付时间")
    pay_channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="支付渠道")
    pay_trade_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="第三方支付流水号")
    
    # 退款信息
    refund_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="退款金额")
    refund_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="退款原因")
    refund_reject_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="退款拒绝原因")
    refund_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="退款时间")
    
    # 行程选配
    addons: Mapped[Optional[list]] = mapped_column(JSON, comment="行程选配列表")
    addon_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="行程选配合计金额")
    
    # 其他
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="用户备注")
    qrcode: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="核销二维码")
    guide_info: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="领队信息")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联评价
    evaluation: Mapped[Optional["OrderEvaluation"]] = relationship(back_populates="order", uselist=False)


class OrderEvaluation(Base):
    """订单评价表"""
    __tablename__ = "order_evaluations"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    route_id: Mapped[int] = mapped_column(Integer, nullable=False)
    
    rating: Mapped[int] = mapped_column(Integer, nullable=False, comment="评分1-5")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="评价内容")
    tags: Mapped[Optional[list]] = mapped_column(JSON, comment="评价标签")
    images: Mapped[Optional[list]] = mapped_column(JSON, comment="图片URL数组")
    is_anonymous: Mapped[int] = mapped_column(Integer, default=0, comment="0实名 1匿名")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    
    order: Mapped["Order"] = relationship(back_populates="evaluation")
