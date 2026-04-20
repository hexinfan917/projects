"""
路线服务 - Route Service
端口: 8002
职责: 路线管理/库存/排期
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends, Query
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import date
from common.config import settings
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from common.response import success

settings.app_name = "route-service"
settings.app_port = 8033
logger = setup_logger("route-service")

# 导入模型和Schema
from app.models.route import Route, RouteSchedule
from app.schemas.route import RouteResponse, RouteListResponse, RouteDetailResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    yield
    await redis_client.close()

app = FastAPI(title="路线服务", description="路线管理/库存/排期", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}

# 类型名称映射
TYPE_NAME_MAP = {
    1: "山野厨房",
    2: "海边度假", 
    3: "森林露营",
    4: "主题派对",
    5: "自驾路线"
}

@app.get("/api/v1/routes", response_model=RouteListResponse)
async def get_routes(
    route_type: Optional[int] = Query(None, description="路线类型: 1山野 2海边 3森林 4主题 5自驾"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    min_price: Optional[float] = Query(None, description="最低价格"),
    max_price: Optional[float] = Query(None, description="最高价格"),
    sort_by: str = Query("recommend", description="排序: recommend推荐 price价格 rating评分"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取路线列表（从数据库）"""
    try:
        from app.models.route import Route
        from common.config import settings
        logger.info(f"DB URL: {settings.database.sqlalchemy_url}")
        logger.info(f"Getting routes: page={page}, page_size={page_size}, type={route_type}")
        
        # 构建查询
        query = select(Route).where(Route.status == 1)
        
        # 类型筛选
        if route_type:
            query = query.where(Route.route_type == route_type)
        
        # 关键词搜索
        if keyword:
            query = query.where(
                Route.name.contains(keyword) | Route.description.contains(keyword)
            )
        
        # 价格筛选
        if min_price is not None:
            query = query.where(Route.base_price >= min_price)
        if max_price is not None:
            query = query.where(Route.base_price <= max_price)
        
        # 排序
        if sort_by == "price":
            query = query.order_by(Route.base_price)
        elif sort_by == "rating":
            query = query.order_by(Route.id)  # 暂无rating字段
        else:
            query = query.order_by(Route.id)
        
        # 分页
        total_result = await db.execute(select(Route).where(Route.status == 1))
        total = len(total_result.scalars().all())
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        # 转换为响应格式
        routes = []
        for r in routes_db:
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": TYPE_NAME_MAP.get(r.route_type, "其他"),
                "title": r.title if r.title else "",
                "subtitle": r.subtitle if r.subtitle else "",
                "cover_image": r.cover_image,
                "description": r.description[:50] + "..." if r.description and len(r.description) > 50 else (r.description or ""),
                "duration": r.duration or "",
                "difficulty": r.difficulty,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "base_price": float(r.base_price) if r.base_price else 0,
                "rating": 4.8,
                "review_count": 128,
                "distance": 15,
                "tags": r.highlights[:3] if r.highlights else []
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "routes": routes
        })
    except Exception as e:
        logger.error(f"Error getting routes: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"Error: {str(e)}", "data": None}

@app.get("/api/v1/routes/{route_id}", response_model=RouteDetailResponse)
async def get_route_detail(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取路线详情（从数据库）"""
    try:
        from app.models.route import Route
        
        logger.info(f"Getting route detail for id={route_id}")
        
        result = await db.execute(select(Route).where(Route.id == route_id))
        r = result.scalar_one_or_none()
        
        if not r:
            logger.warning(f"Route not found: {route_id}")
            return success({})
        
        difficulty_map = {1: "入门", 2: "简单", 3: "中等", 4: "困难", 5: "挑战"}
        
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": TYPE_NAME_MAP.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": r.cover_image,
            "gallery": r.gallery or [],
            "description": r.description,
            "highlights": r.highlights or [],
            "highlights_detail": r.highlights_detail or '',
            "fee_description": r.fee_description or '',
            "fee_include": r.fee_include or '',
            "fee_exclude": r.fee_exclude or '',
            "notice": r.notice or '',
            "duration": r.duration,
            "difficulty": r.difficulty,
            "difficulty_name": difficulty_map.get(r.difficulty, "简单"),
            "min_participants": r.min_participants,
            "max_participants": r.max_participants,
            "base_price": float(r.base_price) if r.base_price else 0,
            "rating": 4.8,
            "review_count": 128,
            "suitable_breeds": r.suitable_breeds or [],
            "unsuitable_breeds": r.unsuitable_breeds or [],
            "safety_video_url": r.safety_video_url,
            "safety_video_duration": r.safety_video_duration or 180,
            "is_safety_required": bool(r.is_safety_required),
            "status": r.status,
            "schedule": [
                {"time": "09:00", "activity": "集合出发", "detail": "在指定地点集合，签到领取物资"},
                {"time": "10:30", "activity": "到达活动地，自由活动", "detail": "狗狗们尽情玩耍，主人拍照留念"},
                {"time": "12:00", "activity": "午餐时间", "detail": "享用精美午餐（含宠物餐食）"},
                {"time": "14:00", "activity": "宠物互动游戏", "detail": "专业训犬师带领互动游戏"},
                {"time": "16:00", "activity": "返程", "detail": "集合返回市区"}
            ],
            "cost_include": ["往返交通", "午餐", "宠物保险", "专业领队", "摄影跟拍"],
            "cost_exclude": ["个人消费", "额外宠物用品"]
        }
        
        logger.info(f"Route detail returned successfully for id={route_id}")
        return success(route)
    except Exception as e:
        logger.error(f"Error getting route detail: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return success({})

@app.get("/api/v1/routes/{route_id}/schedules")
async def get_route_schedules(
    route_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取路线排期（从数据库）- 小程序端"""
    try:
        from app.models.route import RouteSchedule
        from sqlalchemy import and_
        
        logger.info(f"Getting schedules for route_id={route_id}, start_date={start_date}, end_date={end_date}")
        
        # 只返回正常状态的排期（status=1），过滤已删除/关闭的排期
        query = select(RouteSchedule).where(
            and_(
                RouteSchedule.route_id == route_id,
                RouteSchedule.status == 1
            )
        )
        
        # 日期筛选
        if start_date:
            query = query.where(RouteSchedule.schedule_date >= start_date)
        if end_date:
            query = query.where(RouteSchedule.schedule_date <= end_date)
        
        query = query.order_by(RouteSchedule.schedule_date)
        
        result = await db.execute(query)
        schedules_db = result.scalars().all()
        
        logger.info(f"Found {len(schedules_db)} schedules")
        
        schedules = []
        for s in schedules_db:
            schedules.append({
                "id": s.id,
                "route_id": s.route_id,
                "schedule_date": s.schedule_date.isoformat() if s.schedule_date else "",
                "start_time": s.start_time or "09:00",
                "end_time": s.end_time or "17:00",
                "price": float(s.price) if s.price else 0,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "guide_name": "王领队",
                "trainer_name": "李训犬师"
            })
        
        return success({
            "total": len(schedules),
            "schedules": schedules
        })
    except Exception as e:
        logger.error(f"Error getting schedules: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return success({"total": 0, "schedules": []})

@app.get("/api/v1/routes/types")
async def get_route_types():
    """获取路线类型列表"""
    types = [
        {"id": 1, "name": "山野厨房", "icon": "mountain", "color": "#96C93D"},
        {"id": 2, "name": "海边度假", "icon": "beach", "color": "#4ECDC4"},
        {"id": 3, "name": "森林露营", "icon": "camping", "color": "#667EEA"},
        {"id": 4, "name": "主题派对", "icon": "party", "color": "#FF8C42"},
        {"id": 5, "name": "自驾路线", "icon": "car", "color": "#11998E"}
    ]
    return success(types)

# ==================== 管理后台 API ====================

from pydantic import BaseModel
from typing import List, Optional

class RouteCreateUpdate(BaseModel):
    """路线创建/更新请求"""
    name: str
    route_no: Optional[str] = None
    route_type: int
    title: Optional[str] = None
    subtitle: Optional[str] = None
    cover_image: Optional[str] = None
    gallery: Optional[List[str]] = None
    description: Optional[str] = None
    highlights: Optional[List[str]] = None
    highlights_detail: Optional[str] = None
    fee_description: Optional[str] = None
    fee_include: Optional[str] = None
    fee_exclude: Optional[str] = None
    notice: Optional[str] = None
    suitable_breeds: Optional[List[str]] = None
    unsuitable_breeds: Optional[List[str]] = None
    duration: Optional[str] = None
    difficulty: int = 3
    min_participants: int = 4
    max_participants: int = 12
    base_price: float
    safety_video_url: Optional[str] = None
    safety_video_duration: int = 180
    is_safety_required: int = 1
    status: int = 1

class ScheduleCreateUpdate(BaseModel):
    """排期创建/更新请求"""
    schedule_date: str
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "17:00"
    price: Optional[float] = None
    stock: int = 12
    status: int = 1
    guide_id: Optional[int] = None
    trainer_id: Optional[int] = None


@app.post("/api/v1/admin/routes")
async def admin_create_route(
    data: RouteCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """创建路线（管理后台）"""
    try:
        from app.models.route import Route
        
        # 自动生成路线编号
        if not data.route_no:
            import datetime
            data.route_no = f"R{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        route = Route(
            route_no=data.route_no,
            name=data.name,
            route_type=data.route_type,
            title=data.title,
            subtitle=data.subtitle,
            cover_image=data.cover_image,
            gallery=data.gallery,
            description=data.description,
            highlights=data.highlights,
            highlights_detail=data.highlights_detail,
            fee_description=data.fee_description,
            fee_include=data.fee_include,
            fee_exclude=data.fee_exclude,
            notice=data.notice,
            suitable_breeds=data.suitable_breeds,
            unsuitable_breeds=data.unsuitable_breeds,
            duration=data.duration,
            difficulty=data.difficulty,
            min_participants=data.min_participants,
            max_participants=data.max_participants,
            base_price=data.base_price,
            safety_video_url=data.safety_video_url,
            safety_video_duration=data.safety_video_duration,
            is_safety_required=data.is_safety_required,
            status=data.status
        )
        
        db.add(route)
        await db.commit()
        await db.refresh(route)
        
        logger.info(f"Route created: {route.id}")
        return success({"id": route.id, "message": "路线创建成功"})
    except Exception as e:
        logger.error(f"Error creating route: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/routes/{route_id}")
async def admin_update_route(
    route_id: int,
    data: RouteCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新路线（管理后台）"""
    try:
        from app.models.route import Route
        
        result = await db.execute(select(Route).where(Route.id == route_id))
        route = result.scalar_one_or_none()
        
        if not route:
            return {"code": 404, "message": "路线不存在", "data": None}
        
        # 更新字段 - 不 exclude_unset，允许设置 None 值清空字段
        update_data = data.model_dump(exclude={'route_no'})
        for field, value in update_data.items():
            if value is not None or field in ['subtitle', 'title', 'description']:  # 允许清空这些字段
                setattr(route, field, value)
        
        await db.commit()
        await db.refresh(route)
        
        logger.info(f"Route updated: {route_id}")
        return success({"id": route.id, "message": "路线更新成功"})
    except Exception as e:
        logger.error(f"Error updating route: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/routes/{route_id}")
async def admin_delete_route(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除路线（软删除）"""
    try:
        from app.models.route import Route
        
        logger.info(f"Deleting route: {route_id}")
        
        result = await db.execute(select(Route).where(Route.id == route_id))
        route = result.scalar_one_or_none()
        
        if not route:
            logger.warning(f"Route not found: {route_id}")
            return {"code": 404, "message": "路线不存在", "data": None}
        
        logger.info(f"Found route: id={route.id}, name={route.name}, current status={route.status}")
        
        route.status = 0  # 软删除
        await db.commit()
        await db.refresh(route)
        
        logger.info(f"Route deleted successfully: {route_id}, new status={route.status}")
        return success({"message": "路线删除成功"})
    except Exception as e:
        logger.error(f"Error deleting route: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/routes")
async def admin_get_routes(
    keyword: Optional[str] = None,
    route_type: Optional[int] = None,
    status: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取路线列表（管理后台）"""
    try:
        from app.models.route import Route
        from sqlalchemy import and_
        
        # 默认只查询正常状态的路线（status=1），除非明确指定了status参数
        if status is not None:
            query = select(Route).where(Route.status == status)
        else:
            query = select(Route).where(Route.status == 1)
        
        if keyword:
            query = query.where(
                Route.name.contains(keyword) | Route.route_no.contains(keyword)
            )
        
        if route_type:
            query = query.where(Route.route_type == route_type)
        
        # 总数
        total_result = await db.execute(query)
        total = len(total_result.scalars().all())
        
        # 分页
        query = query.order_by(Route.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        routes = []
        for r in routes_db:
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": TYPE_NAME_MAP.get(r.route_type, "其他"),
                "cover_image": r.cover_image,
                "base_price": float(r.base_price) if r.base_price else 0,
                "duration": r.duration,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "routes": routes
        })
    except Exception as e:
        logger.error(f"Error getting admin routes: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/routes/{route_id}")
async def admin_get_route_detail(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取路线详情（管理后台）"""
    try:
        from app.models.route import Route
        
        result = await db.execute(select(Route).where(Route.id == route_id))
        r = result.scalar_one_or_none()
        
        if not r:
            return {"code": 404, "message": "路线不存在", "data": None}
        
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": TYPE_NAME_MAP.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": r.cover_image,
            "gallery": r.gallery or [],
            "description": r.description,
            "highlights": r.highlights or [],
            "highlights_detail": r.highlights_detail,
            "fee_description": r.fee_description,
            "fee_include": r.fee_include,
            "fee_exclude": r.fee_exclude,
            "notice": r.notice,
            "suitable_breeds": r.suitable_breeds or [],
            "unsuitable_breeds": r.unsuitable_breeds or [],
            "duration": r.duration,
            "difficulty": r.difficulty,
            "min_participants": r.min_participants,
            "max_participants": r.max_participants,
            "base_price": float(r.base_price) if r.base_price else 0,
            "safety_video_url": r.safety_video_url,
            "safety_video_duration": r.safety_video_duration,
            "is_safety_required": r.is_safety_required,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        }
        
        return success(route)
    except Exception as e:
        logger.error(f"Error getting route detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 排期管理 API ====================

@app.get("/api/v1/admin/schedules")
async def admin_get_all_schedules(
    route_id: Optional[int] = None,
    status: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """获取所有排期列表（管理后台）"""
    try:
        from app.models.route import RouteSchedule, Route
        from sqlalchemy import and_
        
        query = select(RouteSchedule, Route.name.label('route_name')).join(
            Route, RouteSchedule.route_id == Route.id
        )
        
        # 筛选条件
        if route_id:
            query = query.where(RouteSchedule.route_id == route_id)
        if status is not None:
            query = query.where(RouteSchedule.status == status)
        if start_date:
            query = query.where(RouteSchedule.schedule_date >= start_date)
        if end_date:
            query = query.where(RouteSchedule.schedule_date <= end_date)
        
        query = query.order_by(RouteSchedule.schedule_date.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        rows = result.all()
        
        schedules = []
        for s, route_name in rows:
            schedules.append({
                "id": s.id,
                "route_id": s.route_id,
                "route_name": route_name,
                "schedule_date": s.schedule_date.isoformat() if s.schedule_date else "",
                "start_time": s.start_time or "09:00",
                "end_time": s.end_time or "17:00",
                "price": float(s.price) if s.price else 0,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "guide_id": s.guide_id,
                "trainer_id": s.trainer_id,
            })
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "schedules": schedules
        })
    except Exception as e:
        logger.error(f"Error getting all schedules: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/routes/{route_id}/schedules")
async def admin_get_schedules(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取路线的排期列表（管理后台）"""
    try:
        from app.models.route import RouteSchedule
        from sqlalchemy import and_
        
        # 只返回正常状态的排期
        result = await db.execute(
            select(RouteSchedule)
            .where(
                and_(
                    RouteSchedule.route_id == route_id,
                    RouteSchedule.status == 1
                )
            )
            .order_by(RouteSchedule.schedule_date.desc())
        )
        schedules_db = result.scalars().all()
        
        schedules = []
        for s in schedules_db:
            schedules.append({
                "id": s.id,
                "route_id": s.route_id,
                "schedule_date": s.schedule_date.isoformat() if s.schedule_date else "",
                "start_time": s.start_time or "09:00",
                "end_time": s.end_time or "17:00",
                "price": float(s.price) if s.price else 0,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "guide_id": s.guide_id,
                "trainer_id": s.trainer_id,
            })
        
        return success({"schedules": schedules})
    except Exception as e:
        logger.error(f"Error getting schedules: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/routes/{route_id}/schedules")
async def admin_create_schedule(
    route_id: int,
    data: ScheduleCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """创建排期"""
    try:
        from app.models.route import RouteSchedule
        from datetime import datetime
        from sqlalchemy import and_
        
        schedule_date = datetime.strptime(data.schedule_date, "%Y-%m-%d").date()
        
        # 检查该日期是否已存在排期
        existing_result = await db.execute(
            select(RouteSchedule).where(
                and_(
                    RouteSchedule.route_id == route_id,
                    RouteSchedule.schedule_date == schedule_date,
                    RouteSchedule.status == 1
                )
            )
        )
        if existing_result.scalar_one_or_none():
            return {"code": 409, "message": "该日期已存在排期，请勿重复添加", "data": None}
        
        schedule = RouteSchedule(
            route_id=route_id,
            schedule_date=schedule_date,
            start_time=data.start_time,
            end_time=data.end_time,
            price=data.price,
            stock=data.stock,
            status=data.status,
            guide_id=data.guide_id,
            trainer_id=data.trainer_id
        )
        
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        
        logger.info(f"Schedule created: {schedule.id} for route {route_id}")
        return success({"id": schedule.id, "message": "排期创建成功"})
    except Exception as e:
        logger.error(f"Error creating schedule: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/schedules/{schedule_id}")
async def admin_update_schedule(
    schedule_id: int,
    data: ScheduleCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新排期"""
    try:
        from app.models.route import RouteSchedule
        from datetime import datetime
        
        result = await db.execute(select(RouteSchedule).where(RouteSchedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        
        if not schedule:
            return {"code": 404, "message": "排期不存在", "data": None}
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        if "schedule_date" in update_data:
            update_data["schedule_date"] = datetime.strptime(update_data["schedule_date"], "%Y-%m-%d").date()
        
        for field, value in update_data.items():
            setattr(schedule, field, value)
        
        await db.commit()
        await db.refresh(schedule)
        
        logger.info(f"Schedule updated: {schedule_id}")
        return success({"id": schedule.id, "message": "排期更新成功"})
    except Exception as e:
        logger.error(f"Error updating schedule: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/schedules/{schedule_id}")
async def admin_delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除排期（检查订单关联）"""
    try:
        from app.models.route import RouteSchedule
        from sqlalchemy import and_
        
        logger.info(f"Deleting schedule: {schedule_id}")
        
        result = await db.execute(select(RouteSchedule).where(RouteSchedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        
        if not schedule:
            logger.warning(f"Schedule not found: {schedule_id}")
            return {"code": 404, "message": "排期不存在", "data": None}
        
        logger.info(f"Found schedule: id={schedule.id}, date={schedule.schedule_date}, status={schedule.status}, sold={schedule.sold}")
        
        # 检查是否有已售出的订单（sold > 0）
        if schedule.sold and schedule.sold > 0:
            logger.info(f"Schedule has orders, cannot delete: {schedule_id}")
            return {"code": 409, "message": f"该排期已有{schedule.sold}个订单，不可删除", "data": None}
        
        # 更新状态为已删除
        schedule.status = 0
        await db.commit()
        await db.refresh(schedule)
        
        logger.info(f"Schedule deleted successfully: {schedule_id}, new status={schedule.status}")
        return success({"message": "排期删除成功"})
    except Exception as e:
        logger.error(f"Error deleting schedule: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/routes/{route_id}/schedules/batch")
async def admin_batch_create_schedules(
    route_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """批量创建排期"""
    try:
        from app.models.route import RouteSchedule
        from datetime import datetime, timedelta
        from sqlalchemy import and_
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        week_days = data.get('week_days', [1, 2, 3, 4, 5, 6, 7])
        start_time = data.get('start_time', '09:00')
        end_time = data.get('end_time', '17:00')
        price = data.get('price')
        stock = data.get('stock', 12)
        
        if not start_date or not end_date:
            return {"code": 400, "message": "开始日期和结束日期不能为空", "data": None}
        
        schedules = []
        current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        created_count = 0
        skipped_count = 0
        
        while current_date <= end:
            # 检查是否为指定的星期几
            if current_date.isoweekday() in week_days:
                # 检查该日期是否已存在排期
                existing_result = await db.execute(
                    select(RouteSchedule).where(
                        and_(
                            RouteSchedule.route_id == route_id,
                            RouteSchedule.schedule_date == current_date,
                            RouteSchedule.status == 1
                        )
                    )
                )
                if existing_result.scalar_one_or_none():
                    skipped_count += 1
                    current_date += timedelta(days=1)
                    continue
                
                schedule = RouteSchedule(
                    route_id=route_id,
                    schedule_date=current_date,
                    start_time=start_time,
                    end_time=end_time,
                    price=price,
                    stock=stock,
                    status=1,
                    guide_id=None,
                    trainer_id=None
                )
                db.add(schedule)
                schedules.append(schedule)
                created_count += 1
            
            current_date += timedelta(days=1)
        
        await db.commit()
        
        # 刷新所有对象
        for s in schedules:
            await db.refresh(s)
        
        logger.info(f"Batch created {created_count} schedules for route {route_id}, skipped {skipped_count}")
        return success({
            "count": created_count,
            "skipped": skipped_count,
            "message": f"成功创建 {created_count} 个排期" + (f"，跳过 {skipped_count} 个已存在" if skipped_count > 0 else "")
        })
    except Exception as e:
        logger.error(f"Error batch creating schedules: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"批量创建失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
