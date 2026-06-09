"""
路线模型
"""
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Integer, Text, JSON, DECIMAL, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


class Route(Base):
    """路线表"""
    __tablename__ = "routes"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    route_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, comment="路线编号")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="路线名称")
    route_type: Mapped[int] = mapped_column(Integer, nullable=False, comment="1山野厨房 2海边度假 3森林露营 4主题派对 5自驾路线")
    title: Mapped[Optional[str]] = mapped_column(String(200), comment="副标题")
    subtitle: Mapped[Optional[str]] = mapped_column(String(200), comment="副标题")
    cover_image: Mapped[Optional[str]] = mapped_column(String(500), comment="封面图")
    gallery: Mapped[Optional[list]] = mapped_column(JSON, comment="图集URL数组")
    description: Mapped[Optional[str]] = mapped_column(Text, comment="详细介绍")
    highlights: Mapped[Optional[list]] = mapped_column(JSON, comment="亮点标签")
    highlights_detail: Mapped[Optional[str]] = mapped_column(Text, comment="行程亮点详情(富文本)")
    fee_description: Mapped[Optional[str]] = mapped_column(Text, comment="费用说明(富文本)")
    fee_include: Mapped[Optional[str]] = mapped_column(Text, comment="费用包含(富文本)")
    fee_exclude: Mapped[Optional[str]] = mapped_column(Text, comment="费用不包含(富文本)")
    notice: Mapped[Optional[str]] = mapped_column(Text, comment="注意事项(富文本)")
    content_modules: Mapped[Optional[list]] = mapped_column(JSON, comment="动态内容模块 [{label, icon, content, sort_order}]")
    suitable_breeds: Mapped[Optional[list]] = mapped_column(JSON, comment="适合品种")
    unsuitable_breeds: Mapped[Optional[list]] = mapped_column(JSON, comment="不适合品种")
    duration: Mapped[Optional[str]] = mapped_column(String(20), comment="时长: 半日/1日/2日")
    difficulty: Mapped[int] = mapped_column(Integer, default=3, comment="难度 1-5")
    min_participants: Mapped[int] = mapped_column(Integer, default=4, comment="最小成团人数")
    max_participants: Mapped[int] = mapped_column(Integer, default=12, comment="最大人数")
    display_price: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="详情页显示价格文案")
    base_price: Mapped[float] = mapped_column(DECIMAL(10, 2), comment="基础价格(1人1宠)")
    self_drive_discount: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=0, comment="自驾优惠金额（从基础价中减去）")
    single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="单独人出行价格(1人0宠)")
    two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="2人1宠价格")
    one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="1人2宠价格")
    single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="单独宠物价格(0人1宠)")
    extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=0, comment="增加一人价格")
    extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=0, comment="增加一宠价格")
    # 自驾套餐价格
    self_drive_base_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾基础价格(1人1宠)")
    self_drive_single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾单独人出行价格(1人0宠)")
    self_drive_two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾2人1宠价格")
    self_drive_one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾1人2宠价格")
    self_drive_single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾单独宠物价格(0人1宠)")
    # 自驾额外人宠价格
    self_drive_extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾增加一人价格")
    self_drive_extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="自驾增加一宠价格")
    safety_video_url: Mapped[Optional[str]] = mapped_column(String(500), comment="安全视频URL")
    safety_video_duration: Mapped[int] = mapped_column(Integer, default=180, comment="视频时长秒")
    is_safety_required: Mapped[int] = mapped_column(Integer, default=1, comment="是否强制观看")
    is_hot: Mapped[int] = mapped_column(Integer, default=0, comment="0非热门 1热门")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0下架 1上架")
    is_free: Mapped[int] = mapped_column(Integer, default=0, comment="0付费路线 1免费路线")
    is_member_only: Mapped[int] = mapped_column(Integer, default=0, comment="0所有人可免费 1仅限会员免费")
    is_insurance_required: Mapped[int] = mapped_column(Integer, default=1, comment="0不需要保险 1需要保险")
    pet_insurance_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=15.00, comment="宠物保险单价")
    person_insurance_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=10.00, comment="人身保险单价")
    non_member_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=0, comment="非会员价格（会员专享免费活动时使用）")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序值，越小越靠前")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联排期
    schedules: Mapped[List["RouteSchedule"]] = relationship(back_populates="route")


class RouteSchedule(Base):
    """路线排期表"""
    __tablename__ = "route_schedules"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), nullable=False)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, comment="活动日期")
    start_time: Mapped[Optional[str]] = mapped_column(String(10), comment="开始时间")
    end_time: Mapped[Optional[str]] = mapped_column(String(10), comment="结束时间")
    price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), comment="当日价格(1人1宠)")
    self_drive_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾价格(1人1宠)")
    # 大巴套餐价格
    single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日单独人出行价格(1人0宠)")
    two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日2人1宠价格")
    one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日1人2宠价格")
    single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日单独宠物价格(0人1宠)")
    extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日增加一人价格")
    extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日增加一宠价格")
    # 自驾套餐价格
    self_drive_single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾单独人出行价格(1人0宠)")
    self_drive_two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾2人1宠价格")
    self_drive_one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾1人2宠价格")
    self_drive_single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾单独宠物价格(0人1宠)")
    self_drive_extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾增加一人价格")
    self_drive_extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日自驾增加一宠价格")
    non_member_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="当日非会员价格（覆盖路线级别）")
    # 会员专属价
    member_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员1人1宠大巴价")
    member_single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员单人轻旅大巴价")
    member_two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员二人一宠大巴价")
    member_one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员一人两宠大巴价")
    member_single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员单独宠物大巴价")
    member_extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员增加一人大巴价")
    member_extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员增加一宠大巴价")
    member_self_drive_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员1人1宠自驾价")
    member_self_drive_single_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员单人自驾价")
    member_self_drive_two_person_one_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员二人一宠自驾价")
    member_self_drive_one_person_two_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员一人两宠自驾价")
    member_self_drive_single_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员单独宠物自驾价")
    member_self_drive_extra_person_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员增加一人自驾价")
    member_self_drive_extra_pet_price: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 2), default=None, comment="会员增加一宠自驾价")
    addon_prices: Mapped[Optional[dict]] = mapped_column(JSON, comment="行程选配排期级价格 {addon_code: price}")
    stock: Mapped[int] = mapped_column(Integer, default=12, comment="剩余库存")
    sold: Mapped[int] = mapped_column(Integer, default=0, comment="已售")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0关闭 1可售 2已满 3已结束")
    travel_type: Mapped[Optional[int]] = mapped_column(Integer, default=0, comment="出行方式限制 0两者都支持 1仅大巴 2仅自驾")
    guide_id: Mapped[Optional[int]] = mapped_column(Integer, comment="领队ID")
    trainer_id: Mapped[Optional[int]] = mapped_column(Integer, comment="训犬师ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联路线
    route: Mapped["Route"] = relationship(back_populates="schedules")
