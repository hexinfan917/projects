"""
优惠券模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, DECIMAL, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class CouponTemplate(Base):
    """优惠券模板表"""
    __tablename__ = "coupon_templates"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="优惠券名称")
    type: Mapped[int] = mapped_column(Integer, nullable=False, comment="1满减券 2折扣券 3立减券")
    value: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, comment="优惠值")
    min_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="最低订单金额门槛")
    max_discount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0, comment="折扣券最高优惠金额")
    total_count: Mapped[int] = mapped_column(Integer, default=0, comment="发放总量，0为不限量")
    per_user_limit: Mapped[int] = mapped_column(Integer, default=1, comment="每人限领张数")
    valid_type: Mapped[int] = mapped_column(Integer, default=1, comment="1领取后X天有效 2固定时间段有效")
    valid_days: Mapped[int] = mapped_column(Integer, default=7, comment="领取后有效天数")
    valid_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="固定有效期开始")
    valid_end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="固定有效期结束")
    applicable_type: Mapped[int] = mapped_column(Integer, default=1, comment="1全部路线 2指定路线 3指定路线类型")
    applicable_ids: Mapped[Optional[list]] = mapped_column(JSON, comment="适用对象ID列表")
    is_exclusive: Mapped[int] = mapped_column(Integer, default=0, comment="1不可与其他优惠券叠加")
    source_type: Mapped[int] = mapped_column(Integer, default=1, comment="1通用 2会员购买赠送 3会员每月发放")
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="使用说明")
    color: Mapped[str] = mapped_column(String(20), default="#FF6B35", comment="券面主题色")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0停用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserCoupon(Base):
    """用户优惠券表"""
    __tablename__ = "user_coupons"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="用户ID")
    template_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="模板ID")
    coupon_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, comment="券编号")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="券名称")
    type: Mapped[int] = mapped_column(Integer, nullable=False, comment="1满减券 2折扣券 3立减券")
    value: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    min_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    max_discount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    applicable_type: Mapped[int] = mapped_column(Integer, default=1)
    applicable_ids: Mapped[Optional[list]] = mapped_column(JSON)
    valid_start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    valid_end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[int] = mapped_column(Integer, default=1, comment="1未使用 2已使用 3已过期 4已作废")
    used_order_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="使用订单ID")
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="使用时间")
    source_type: Mapped[int] = mapped_column(Integer, default=1, comment="来源类型")
    source_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="来源业务ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
