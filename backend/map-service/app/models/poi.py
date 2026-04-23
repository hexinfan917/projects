"""
POI地点模型
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Text, JSON, DECIMAL, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class POISpot(Base):
    """POI地点表"""
    __tablename__ = "poi_spots"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="场所名称")
    poi_type: Mapped[int] = mapped_column(Integer, nullable=False, comment="1酒店 2餐厅 3公园 4景点 5医院 6服务区")
    category: Mapped[Optional[str]] = mapped_column(String(50), comment="细分标签")
    province: Mapped[Optional[str]] = mapped_column(String(50))
    city: Mapped[Optional[str]] = mapped_column(String(50))
    district: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(String(200))
    longitude: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 7), comment="经度")
    latitude: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 7), comment="纬度")
    geohash: Mapped[Optional[str]] = mapped_column(String(12), comment="地理哈希")
    pet_level: Mapped[int] = mapped_column(Integer, default=1, comment="1允许 2友好 3亲宠")
    pet_facilities: Mapped[Optional[list]] = mapped_column(JSON, comment="设施列表")
    pet_policy: Mapped[Optional[str]] = mapped_column(Text, comment="宠物政策说明")
    pet_fee: Mapped[Optional[str]] = mapped_column(String(100), comment="宠物费用说明")
    images: Mapped[Optional[list]] = mapped_column(JSON, comment="环境照片")
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    business_hours: Mapped[Optional[str]] = mapped_column(String(100))
    rating: Mapped[float] = mapped_column(DECIMAL(2, 1), default=5.0, comment="评分")
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    is_verified: Mapped[int] = mapped_column(Integer, default=0, comment="是否平台认证")
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0下架 1上架")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
