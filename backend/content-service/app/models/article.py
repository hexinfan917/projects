"""
文章/攻略模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class Article(Base):
    """文章表"""
    __tablename__ = "articles"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="文章标题")
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="副标题")
    cover_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="封面图")
    images: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="图集，JSON 数组存储图片 URL 列表")
    summary: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True, comment="摘要")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="文章内容")
    
    # 分类和标签
    category: Mapped[str] = mapped_column(String(50), default="travel", comment="分类: travel旅行 guide攻略 story故事 review回顾")
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="标签,逗号分隔")
    
    # 作者信息
    author_id: Mapped[int] = mapped_column(Integer, default=0, comment="作者ID")
    author_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="作者名")
    
    # 回顾/活动专属字段
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="活动地点")
    event_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="活动日期")
    participants: Mapped[int] = mapped_column(Integer, default=0, comment="参与数量")
    
    # 统计
    view_count: Mapped[int] = mapped_column(Integer, default=0, comment="浏览量")
    like_count: Mapped[int] = mapped_column(Integer, default=0, comment="点赞数")
    collect_count: Mapped[int] = mapped_column(Integer, default=0, comment="收藏数")
    
    # 状态
    status: Mapped[int] = mapped_column(Integer, default=0, comment="0草稿 1已发布 2下架")
    is_top: Mapped[int] = mapped_column(Integer, default=0, comment="0普通 1置顶")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    
    # 时间
    publish_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="发布时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
