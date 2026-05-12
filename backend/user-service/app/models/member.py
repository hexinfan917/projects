"""
会员中心模型
"""
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, DECIMAL, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class MemberPlan(Base):
    """会员套餐表"""
    __tablename__ = "member_plans"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="套餐名称")
    subtitle: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="副标题")
    original_price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, comment="原价")
    sale_price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, comment="售价")
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, comment="有效期天数")
    benefit_config: Mapped[dict] = mapped_column(JSON, nullable=False, comment="权益配置JSON")
    coupon_package: Mapped[dict] = mapped_column(JSON, nullable=False, comment="券包配置JSON")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    tag: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="角标")
    color: Mapped[str] = mapped_column(String(20), default="#FF6B35", comment="主题色")
    is_recommend: Mapped[int] = mapped_column(Integer, default=0, comment="1推荐套餐")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0下架 1上架")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserMembership(Base):
    """用户会员订阅表"""
    __tablename__ = "user_memberships"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="用户ID")
    plan_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="套餐ID")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="1生效中 2已过期 3已退款")
    start_date: Mapped[date] = mapped_column(Date, nullable=False, comment="生效开始日期")
    end_date: Mapped[date] = mapped_column(Date, nullable=False, comment="生效结束日期")
    order_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="关联购买订单ID")
    pay_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, comment="实际支付金额")
    is_auto_renew: Mapped[int] = mapped_column(Integer, default=0, comment="1自动续费")
    benefit_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, comment="权益快照")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class MemberOrder(Base):
    """会员购买订单表"""
    __tablename__ = "member_orders"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, comment="订单编号")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    plan_id: Mapped[int] = mapped_column(Integer, nullable=False)
    original_price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    pay_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    status: Mapped[int] = mapped_column(Integer, default=10, comment="10待支付 20已支付 30已取消 40已退款")
    pay_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    pay_channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pay_trade_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    refund_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    refund_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
