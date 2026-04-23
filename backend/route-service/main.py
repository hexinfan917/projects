"""
路线服务 - Route Service
端口: 8002
职责: 路线管理/库存/排期
"""
import sys
import os
import re
import httpx
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
from sqlalchemy import select, and_, func, text
from sqlalchemy.orm import load_only
from common.response import success

FILE_SERVICE_URL = os.getenv("FILE_SERVICE_URL", "http://localhost:8008")

settings.app_name = "route-service"
settings.app_port = 8033
logger = setup_logger("route-service")

# 导入模型和Schema
from app.models.route import Route, RouteSchedule
from app.models.route_type import RouteType
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

# 类型名称映射（兜底，当数据库不可用时使用）
_DEFAULT_TYPE_NAME_MAP = {
    1: "山野厨房",
    2: "海边度假",
    3: "森林露营",
    4: "主题派对",
    5: "自驾路线"
}

async def _get_route_type_map(db: AsyncSession) -> dict:
    """从数据库获取路线类型映射 {id: name}"""
    try:
        result = await db.execute(select(RouteType).where(RouteType.status == 1))
        types = result.scalars().all()
        if types:
            return {t.id: t.name for t in types}
    except Exception as e:
        logger.warning(f"Failed to get route types from db: {e}")
    return _DEFAULT_TYPE_NAME_MAP.copy()

async def _get_route_name_to_id_map(db: AsyncSession) -> dict:
    """从数据库获取路线名称到ID映射 {name: id}"""
    try:
        result = await db.execute(select(RouteType).where(RouteType.status == 1))
        types = result.scalars().all()
        if types:
            return {t.name: t.id for t in types}
    except Exception as e:
        logger.warning(f"Failed to get route types from db: {e}")
    return {v: k for k, v in _DEFAULT_TYPE_NAME_MAP.items()}

@app.get("/api/v1/routes", response_model=RouteListResponse)
async def get_routes(
    route_type: Optional[int] = Query(None, description="路线类型: 1山野 2海边 3森林 4主题 5自驾"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    min_price: Optional[float] = Query(None, description="最低价格"),
    max_price: Optional[float] = Query(None, description="最高价格"),
    is_hot: Optional[int] = Query(None, description="是否热门: 0否 1是"),
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
        logger.info(f"Getting routes: page={page}, page_size={page_size}, type={route_type}, is_hot={is_hot}")
        
        # 获取类型映射
        type_name_to_id = await _get_route_name_to_id_map(db)
        
        # 构建查询，列表只加载必要字段避免 sort memory 溢出
        query = select(Route).where(Route.status == 1).options(
            load_only(
                Route.id, Route.route_no, Route.name, Route.route_type,
                Route.title, Route.subtitle, Route.cover_image, Route.description,
                Route.duration, Route.difficulty, Route.min_participants,
                Route.max_participants, Route.base_price, Route.highlights,
                Route.created_at
            )
        )
        
        # 类型筛选
        if route_type:
            query = query.where(Route.route_type == route_type)
        
        # 热门筛选
        if is_hot is not None:
            query = query.where(Route.is_hot == is_hot)
        
        # 关键词搜索
        if keyword:
            from sqlalchemy import or_
            conditions = [
                Route.name.contains(keyword),
                Route.description.contains(keyword),
                Route.subtitle.contains(keyword),
                Route.title.contains(keyword),
            ]
            matched_type = type_name_to_id.get(keyword)
            if matched_type:
                conditions.append(Route.route_type == matched_type)
            query = query.where(or_(*conditions))
        
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
            query = query.order_by(Route.created_at.desc())
        
        # 先查询筛选后的总数
        count_query = select(func.count(Route.id)).where(Route.status == 1)
        if route_type:
            count_query = count_query.where(Route.route_type == route_type)
        if is_hot is not None:
            count_query = count_query.where(Route.is_hot == is_hot)
        if keyword:
            from sqlalchemy import or_
            conditions = [
                Route.name.contains(keyword),
                Route.description.contains(keyword),
                Route.subtitle.contains(keyword),
                Route.title.contains(keyword),
            ]
            matched_type = type_name_to_id.get(keyword)
            if matched_type:
                conditions.append(Route.route_type == matched_type)
            count_query = count_query.where(or_(*conditions))
        if min_price is not None:
            count_query = count_query.where(Route.base_price >= min_price)
        if max_price is not None:
            count_query = count_query.where(Route.base_price <= max_price)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        # 兜底逻辑：如果查询热门路线但结果为空，则自动将最新一条上架路线标记为热门并返回
        if is_hot == 1 and not routes_db:
            fallback_result = await db.execute(
                select(Route)
                .where(Route.status == 1)
                .order_by(Route.created_at.desc())
                .limit(1)
                .options(
                    load_only(
                        Route.id, Route.route_no, Route.name, Route.route_type,
                        Route.title, Route.subtitle, Route.cover_image, Route.description,
                        Route.duration, Route.difficulty, Route.min_participants,
                        Route.max_participants, Route.base_price, Route.highlights,
                        Route.created_at
                    )
                )
            )
            fallback_route = fallback_result.scalar_one_or_none()
            if fallback_route:
                fallback_route.is_hot = 1
                await db.commit()
                await db.refresh(fallback_route)
                routes_db = [fallback_route]
                total = 1
        
        # 转换为响应格式
        routes = []
        type_map = await _get_route_type_map(db)
        for r in routes_db:
            # 查询该路线的评价统计
            avg_rating = 5.0
            review_count = 0
            try:
                rating_res = await db.execute(
                    text("SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM order_evaluations WHERE route_id = :route_id"),
                    {"route_id": r.id}
                )
                rating_row = rating_res.mappings().first()
                if rating_row:
                    avg_rating = round(float(rating_row["avg_rating"] or 5.0), 1)
                    review_count = int(rating_row["review_count"] or 0)
            except Exception as e:
                logger.warning(f"Failed to get rating for route {r.id}: {e}")
            
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": type_map.get(r.route_type, "其他"),
                "title": r.title if r.title else "",
                "subtitle": r.subtitle if r.subtitle else "",
                "cover_image": r.cover_image,
                "description": r.description[:50] + "..." if r.description and len(r.description) > 50 else (r.description or ""),
                "duration": r.duration or "",
                "difficulty": r.difficulty,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "base_price": float(r.base_price) if r.base_price else 0,
                "rating": avg_rating,
                "review_count": review_count,
                "distance": None,  # 暂无距离字段
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

@app.get("/api/v1/routes/types")
async def get_route_types(db: AsyncSession = Depends(get_db)):
    """获取路线类型列表"""
    try:
        result = await db.execute(
            select(RouteType).where(RouteType.status == 1).order_by(RouteType.sort_order)
        )
        types = result.scalars().all()
        if types:
            return success([{"id": t.id, "name": t.name, "icon": t.icon, "color": t.color} for t in types])
    except Exception as e:
        logger.warning(f"Failed to get route types from db: {e}")
    # 兜底返回默认值
    return success([
        {"id": 1, "name": "山野厨房", "icon": "mountain", "color": "#96C93D"},
        {"id": 2, "name": "海边度假", "icon": "beach", "color": "#4ECDC4"},
        {"id": 3, "name": "森林露营", "icon": "camping", "color": "#667EEA"},
        {"id": 4, "name": "主题派对", "icon": "party", "color": "#FF8C42"},
        {"id": 5, "name": "自驾路线", "icon": "car", "color": "#11998E"}
    ])

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
        
        # 查询该路线的评价统计
        avg_rating = 5.0
        review_count = 0
        try:
            rating_res = await db.execute(
                text("SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM order_evaluations WHERE route_id = :route_id"),
                {"route_id": route_id}
            )
            rating_row = rating_res.mappings().first()
            if rating_row:
                avg_rating = round(float(rating_row["avg_rating"] or 5.0), 1)
                review_count = int(rating_row["review_count"] or 0)
        except Exception as e:
            logger.warning(f"Failed to get rating for route {route_id}: {e}")
        
        # 解析费用包含/不包含（从富文本中提取列表）
        def parse_fee_list(fee_text: str) -> list:
            if not fee_text:
                return []
            # 简单按行分割，过滤空行和HTML标签
            import re
            lines = re.sub(r'<[^>]+>', '', fee_text).split('\n')
            return [line.strip().lstrip('•').lstrip('-').strip() for line in lines if line.strip()][:10]
        
        type_map = await _get_route_type_map(db)
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": type_map.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": r.cover_image,
            "gallery": r.gallery or [],
            "description": r.description,
            "highlights": r.highlights or [],
            "highlights_detail": r.highlights_detail or '',
            "content_modules": r.content_modules or [],
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
            "rating": avg_rating,
            "review_count": review_count,
            "suitable_breeds": r.suitable_breeds or [],
            "unsuitable_breeds": r.unsuitable_breeds or [],
            "safety_video_url": r.safety_video_url,
            "safety_video_duration": r.safety_video_duration or 180,
            "is_safety_required": bool(r.is_safety_required),
            "status": r.status,
            # TODO: 行程安排应存入数据库，当前使用默认模板
            "schedule": [
                {"time": "09:00", "activity": "集合出发", "detail": "在指定地点集合，签到领取物资"},
                {"time": "10:30", "activity": "到达活动地，自由活动", "detail": "狗狗们尽情玩耍，主人拍照留念"},
                {"time": "12:00", "activity": "午餐时间", "detail": "享用精美午餐（含宠物餐食）"},
                {"time": "14:00", "activity": "宠物互动游戏", "detail": "专业训犬师带领互动游戏"},
                {"time": "16:00", "activity": "返程", "detail": "集合返回市区"}
            ],
            "cost_include": parse_fee_list(r.fee_include) or ["往返交通", "午餐", "宠物保险", "专业领队", "摄影跟拍"],
            "cost_exclude": parse_fee_list(r.fee_exclude) or ["个人消费", "额外宠物用品"]
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
        
        # 批量查询领队/训犬师姓名（如有 guide_id/trainer_id）
        guide_ids = [s.guide_id for s in schedules_db if s.guide_id]
        trainer_ids = [s.trainer_id for s in schedules_db if s.trainer_id]
        user_names = {}
        if guide_ids or trainer_ids:
            try:
                user_result = await db.execute(
                    text("SELECT id, nickname FROM users WHERE id IN :ids"),
                    {"ids": tuple(set(guide_ids + trainer_ids))}
                )
                for row in user_result.mappings().all():
                    user_names[row["id"]] = row["nickname"]
            except Exception as e:
                logger.warning(f"Failed to get user names: {e}")
        
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
                "guide_name": user_names.get(s.guide_id, "") if s.guide_id else "",
                "trainer_name": user_names.get(s.trainer_id, "") if s.trainer_id else ""
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


@app.get("/api/v1/routes/{route_id}/evaluations")
async def get_route_evaluations(
    route_id: int,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    获取路线评价列表（小程序端公开接口）
    """
    try:
        # 直接查询共享数据库的 order_evaluations 表
        result = await db.execute(
            text("""
                SELECT id, order_id, user_id, route_id, rating, content, tags, images, is_anonymous, created_at
                FROM order_evaluations
                WHERE route_id = :route_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"route_id": route_id, "limit": page_size, "offset": (page - 1) * page_size}
        )
        rows = result.mappings().all()
        
        evaluations = []
        user_ids = []
        for row in rows:
            evaluations.append({
                "id": row["id"],
                "order_id": row["order_id"],
                "user_id": row["user_id"],
                "rating": row["rating"],
                "content": row["content"],
                "tags": row["tags"] if row["tags"] else [],
                "images": row["images"] if row["images"] else [],
                "is_anonymous": row["is_anonymous"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "author_name": "匿名用户" if row["is_anonymous"] else None,
            })
            if not row["is_anonymous"]:
                user_ids.append(row["user_id"])
        
        # 批量查询用户名
        if user_ids:
            try:
                user_result = await db.execute(
                    text("SELECT id, nickname FROM users WHERE id IN :ids"),
                    {"ids": tuple(set(user_ids))}
                )
                user_map = {row["id"]: row["nickname"] for row in user_result.mappings().all()}
                for ev in evaluations:
                    if ev["author_name"] is None and ev["user_id"] in user_map:
                        ev["author_name"] = user_map[ev["user_id"]]
            except Exception as e:
                logger.warning(f"Failed to get user names for evaluations: {e}")
        
        # 查询总数
        total_result = await db.execute(
            text("SELECT COUNT(*) FROM order_evaluations WHERE route_id = :route_id"),
            {"route_id": route_id}
        )
        total = total_result.scalar()
        
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "evaluations": evaluations
        })
    except Exception as e:
        logger.error(f"Error getting route evaluations: {e}")
        return success({"total": 0, "evaluations": []})


# ==================== 管理后台 API ====================

from pydantic import BaseModel
from typing import List, Optional

class RouteTypeCreateUpdate(BaseModel):
    """路线类型创建/更新请求"""
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0
    status: int = 1

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
    content_modules: Optional[List[dict]] = None
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
    is_hot: int = 0
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


async def process_content_modules(content_modules: list) -> list:
    """提取 content 中的 base64 图片，上传到 file-service，替换为 URL"""
    if not content_modules:
        return content_modules
    
    img_regex = re.compile(r'<img[^>]+src=["\'](data:image/(jpeg|jpg|png|gif|webp);base64,([^"\']+))["\'][^>]*>')
    processed = []
    
    async with httpx.AsyncClient() as client:
        for mod in content_modules:
            content = mod.get("content", "")
            if not content or not isinstance(content, str):
                processed.append(mod)
                continue
            
            matches = list(img_regex.finditer(content))
            if not matches:
                processed.append(mod)
                continue
            
            new_content = content
            for match in matches:
                full_data_uri = match.group(1)
                try:
                    resp = await client.post(
                        f"{FILE_SERVICE_URL}/api/v1/files/upload/base64",
                        json={"base64": full_data_uri},
                        timeout=30.0
                    )
                    if resp.status_code == 200:
                        result = resp.json()
                        if result.get("code") == 200:
                            file_url = result["data"]["url"]
                            new_content = new_content.replace(full_data_uri, file_url)
                except Exception as e:
                    logger.error(f"Failed to upload base64 image: {e}")
            
            processed.append({**mod, "content": new_content})
    
    return processed


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
        
        content_modules = data.content_modules
        if content_modules:
            content_modules = await process_content_modules(content_modules)
        
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
            content_modules=content_modules,
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
            is_hot=data.is_hot,
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
        if update_data.get('content_modules'):
            update_data['content_modules'] = await process_content_modules(update_data['content_modules'])
        for field, value in update_data.items():
            if value is not None or field in ['subtitle', 'title', 'description', 'is_hot', 'status', 'content_modules']:  # 允许清空这些字段
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
    is_hot: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取路线列表（管理后台）"""
    try:
        from app.models.route import Route
        from sqlalchemy import and_
        
        # 默认只查询正常状态的路线（status=1），除非明确指定了status参数
        # 列表只加载必要字段避免 sort memory 溢出
        load_only_cols = load_only(
            Route.id, Route.route_no, Route.name, Route.route_type,
            Route.cover_image, Route.base_price, Route.duration,
            Route.min_participants, Route.max_participants,
            Route.is_hot, Route.status, Route.created_at, Route.updated_at
        )
        if status is not None:
            query = select(Route).where(Route.status == status).options(load_only_cols)
        else:
            query = select(Route).where(Route.status == 1).options(load_only_cols)
        
        # 热门筛选
        if is_hot is not None:
            query = query.where(Route.is_hot == is_hot)
        
        if keyword:
            query = query.where(
                Route.name.contains(keyword) | Route.route_no.contains(keyword)
            )
        
        if route_type:
            query = query.where(Route.route_type == route_type)
        
        # 总数（使用 func.count 避免加载全表数据）
        from sqlalchemy import func as sa_func
        count_query = select(sa_func.count(Route.id))
        if status is not None:
            count_query = count_query.where(Route.status == status)
        else:
            count_query = count_query.where(Route.status == 1)
        if is_hot is not None:
            count_query = count_query.where(Route.is_hot == is_hot)
        if keyword:
            count_query = count_query.where(
                Route.name.contains(keyword) | Route.route_no.contains(keyword)
            )
        if route_type:
            count_query = count_query.where(Route.route_type == route_type)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        query = query.order_by(Route.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        routes = []
        type_map = await _get_route_type_map(db)
        for r in routes_db:
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": type_map.get(r.route_type, "其他"),
                "cover_image": r.cover_image,
                "base_price": float(r.base_price) if r.base_price else 0,
                "duration": r.duration,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "is_hot": r.is_hot,
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
        
        type_map = await _get_route_type_map(db)
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": type_map.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": r.cover_image,
            "gallery": r.gallery or [],
            "description": r.description,
            "highlights": r.highlights or [],
            "highlights_detail": r.highlights_detail,
            "content_modules": r.content_modules or [],
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
            "is_hot": r.is_hot,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        }
        
        return success(route)
    except Exception as e:
        logger.error(f"Error getting route detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 路线类型管理 API ====================

@app.get("/api/v1/admin/route-types")
async def admin_get_route_types(
    status: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取路线类型列表（管理后台）"""
    try:
        query = select(RouteType)
        if status is not None:
            query = query.where(RouteType.status == status)
        query = query.order_by(RouteType.sort_order)
        result = await db.execute(query)
        types = result.scalars().all()
        return success([
            {
                "id": t.id,
                "name": t.name,
                "icon": t.icon,
                "color": t.color,
                "sort_order": t.sort_order,
                "status": t.status,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in types
        ])
    except Exception as e:
        logger.error(f"Error getting route types: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/route-types")
async def admin_create_route_type(
    data: RouteTypeCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """创建路线类型"""
    try:
        existing = await db.execute(select(RouteType).where(RouteType.name == data.name))
        if existing.scalar_one_or_none():
            return {"code": 409, "message": "类型名称已存在", "data": None}
        
        route_type = RouteType(
            name=data.name,
            icon=data.icon,
            color=data.color,
            sort_order=data.sort_order,
            status=data.status
        )
        db.add(route_type)
        await db.commit()
        await db.refresh(route_type)
        return success({"id": route_type.id, "message": "创建成功"})
    except Exception as e:
        logger.error(f"Error creating route type: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/route-types/{type_id}")
async def admin_update_route_type(
    type_id: int,
    data: RouteTypeCreateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新路线类型"""
    try:
        result = await db.execute(select(RouteType).where(RouteType.id == type_id))
        route_type = result.scalar_one_or_none()
        if not route_type:
            return {"code": 404, "message": "类型不存在", "data": None}
        
        if data.name != route_type.name:
            existing = await db.execute(
                select(RouteType).where(RouteType.name == data.name, RouteType.id != type_id)
            )
            if existing.scalar_one_or_none():
                return {"code": 409, "message": "类型名称已存在", "data": None}
        
        route_type.name = data.name
        route_type.icon = data.icon
        route_type.color = data.color
        route_type.sort_order = data.sort_order
        route_type.status = data.status
        
        await db.commit()
        await db.refresh(route_type)
        return success({"id": route_type.id, "message": "更新成功"})
    except Exception as e:
        logger.error(f"Error updating route type: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/route-types/{type_id}")
async def admin_delete_route_type(
    type_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除路线类型（检查是否被路线引用）"""
    try:
        result = await db.execute(select(RouteType).where(RouteType.id == type_id))
        route_type = result.scalar_one_or_none()
        if not route_type:
            return {"code": 404, "message": "类型不存在", "data": None}
        
        from app.models.route import Route
        route_result = await db.execute(
            select(Route).where(Route.route_type == type_id, Route.status == 1)
        )
        if route_result.scalar_one_or_none():
            return {"code": 409, "message": "该类型下有上架路线，不可删除", "data": None}
        
        await db.delete(route_type)
        await db.commit()
        return success({"message": "删除成功"})
    except Exception as e:
        logger.error(f"Error deleting route type: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


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
