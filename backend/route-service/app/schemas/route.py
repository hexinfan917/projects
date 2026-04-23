"""
路线相关Schema
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class RouteResponse(BaseModel):
    """路线响应"""
    id: int
    route_no: str
    name: str
    route_type: int
    type_name: str
    title: Optional[str]
    subtitle: Optional[str]
    cover_image: Optional[str]
    description: Optional[str]
    duration: Optional[str]
    difficulty: int
    min_participants: int
    max_participants: int
    base_price: float
    rating: float
    review_count: int
    distance: Optional[int]
    tags: Optional[List[str]]
    
    class Config:
        from_attributes = True


class RouteListResponse(BaseModel):
    """路线列表响应"""
    total: int
    page: int
    page_size: int
    routes: List[RouteResponse]


class ScheduleItem(BaseModel):
    """行程项"""
    time: str
    activity: str
    detail: str


class ContentModule(BaseModel):
    """动态内容模块"""
    label: str
    icon: Optional[str] = None
    content: str
    sort_order: int = 0


class RouteDetailResponse(BaseModel):
    """路线详情响应"""
    id: int
    route_no: str
    name: str
    route_type: int
    type_name: str
    title: Optional[str]
    subtitle: Optional[str]
    cover_image: Optional[str]
    gallery: Optional[List[str]]
    description: Optional[str]
    highlights: Optional[List[str]]
    content_modules: Optional[List[ContentModule]]
    duration: Optional[str]
    difficulty: int
    difficulty_name: str
    min_participants: int
    max_participants: int
    base_price: float
    rating: float
    review_count: int
    suitable_breeds: Optional[List[str]]
    unsuitable_breeds: Optional[List[str]]
    safety_video_url: Optional[str]
    safety_video_duration: int
    is_safety_required: bool
    status: int
    schedule: List[ScheduleItem]
    cost_include: List[str]
    cost_exclude: List[str]
