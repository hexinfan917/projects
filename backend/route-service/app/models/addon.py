"""行程选配模型"""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DECIMAL, Text, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from common.database import Base


class RouteAddon(Base):
    """行程选配表"""
    __tablename__ = "route_addons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="关联线路ID")
    category: Mapped[str] = mapped_column(String(20), nullable=False, comment="分类：dog_ticket/hotel/amusement")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="名称")
    price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False, default=0, comment="售价")
    unit: Mapped[Optional[str]] = mapped_column(String(20), default="份", comment="计价单位")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="详细介绍/说明")
    stock: Mapped[int] = mapped_column(Integer, default=999, comment="库存")
    sold: Mapped[int] = mapped_column(Integer, default=0, comment="已售")
    limit_per_order: Mapped[int] = mapped_column(Integer, default=0, comment="单订单限购数量，0不限")
    is_required: Mapped[int] = mapped_column(Integer, default=0, comment="是否必选 0否 1是")
    need_info: Mapped[int] = mapped_column(Integer, default=0, comment="是否需要填写资料 0否 1是")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0下架 1上架")
    extra_config: Mapped[Optional[dict]] = mapped_column(JSON, comment="扩展配置")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
