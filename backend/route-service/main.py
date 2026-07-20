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


def _build_file_url(url: Optional[str]) -> Optional[str]:
    """将相对路径的文件地址补全为 file-service 完整 URL"""
    if not url:
        return url
    if url.startswith('http://') or url.startswith('https://'):
        return url
    # 移除开头的 /，避免双斜杠
    path = url.lstrip('/')
    return f"{FILE_SERVICE_URL}/{path}"


settings.app_name = "route-service"
settings.app_port = 8033
logger = setup_logger("route-service")

# 导入模型和Schema
from app.models.route import Route, RouteSchedule
from app.models.route_type import RouteType
from app.models.addon import RouteAddon
from app.models.addon_category import AddonCategory
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

async def _get_nearest_schedule_prices(db: AsyncSession, route_ids: list) -> dict:
    """批量查询每个路线的最近排期价格 {route_id: {price, self_drive_price, member_price}}
    
    取第一个有价格配置（含免费活动 price=0）的排期
    """
    from datetime import date
    from app.models.route import RouteSchedule
    if not route_ids:
        return {}
    try:
        result = await db.execute(
            select(
                RouteSchedule.route_id, RouteSchedule.price, RouteSchedule.self_drive_price,
                RouteSchedule.member_price, RouteSchedule.member_self_drive_price, RouteSchedule.travel_type
            )
            .where(RouteSchedule.route_id.in_(route_ids))
            .where(RouteSchedule.status == 1)
            .where(RouteSchedule.schedule_date >= date.today())
            .where(RouteSchedule.price.is_not(None))  # 价格已配置（含0元免费活动）
            .order_by(RouteSchedule.route_id, RouteSchedule.schedule_date.asc())
        )
        schedule_map = {}
        for row in result.all():
            rid = row.route_id
            if rid not in schedule_map:
                # 根据出行方式选择展示的会员价
                is_self_drive = row.travel_type == 2
                is_bus = row.travel_type == 1
                member_price = float(row.member_price) if row.member_price is not None else None
                member_sd_price = float(row.member_self_drive_price) if row.member_self_drive_price is not None else None
                display_member_price = member_sd_price if is_self_drive else (member_price if is_bus else (member_price if member_price is not None else member_sd_price))
                schedule_map[rid] = {
                    "price": float(row.price) if row.price is not None else None,
                    "self_drive_price": float(row.self_drive_price) if row.self_drive_price is not None else None,
                    "member_price": display_member_price
                }
        return schedule_map
    except Exception as e:
        logger.warning(f"Failed to get nearest schedule prices: {e}")
        return {}

@app.get("/api/v1/routes")
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
        
        # 构建查询
        query = select(Route).where(Route.status == 1)
        
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
        
        # 价格筛选已废弃（价格下放到排期管理）
        # 排序
        if sort_by == "rating":
            query = query.order_by(Route.id)  # 暂无rating字段
        else:
            query = query.order_by(Route.sort_order.asc(), Route.created_at.desc())
        
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

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        # 查询最近排期价格（同时用于过滤和价格展示）
        route_ids = [r.id for r in routes_db]
        schedule_prices = await _get_nearest_schedule_prices(db, route_ids)
        
        # 过滤掉没有有效排期的路线（方案B：只显示有可预订排期的路线）
        routes_db = [r for r in routes_db if r.id in schedule_prices]
        
        # 兜底逻辑：如果查询热门路线但结果为空，则自动将最新一条上架路线标记为热门并返回
        if is_hot == 1 and not routes_db:
            fallback_result = await db.execute(
                select(Route)
                .where(Route.status == 1)
                .order_by(Route.created_at.desc())
                .limit(1)

            )
            fallback_route = fallback_result.scalar_one_or_none()
            if fallback_route:
                fallback_route.is_hot = 1
                await db.commit()
                await db.refresh(fallback_route)
                routes_db = [fallback_route]
                total = 1
                # 重新查询排期价格
                schedule_prices = await _get_nearest_schedule_prices(db, [fallback_route.id])
        
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
            
            sp = schedule_prices.get(r.id, {})
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": type_map.get(r.route_type, "其他"),
                "title": r.title if r.title else "",
                "subtitle": r.subtitle if r.subtitle else "",
                "cover_image": _build_file_url(r.cover_image),
                "description": r.description[:50] + "..." if r.description and len(r.description) > 50 else (r.description or ""),
                "duration": r.duration or "",
                "difficulty": r.difficulty,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "schedule_price": sp.get("price") if sp.get("price") is not None else 0,
                "schedule_self_drive_price": sp.get("self_drive_price") if sp.get("self_drive_price") is not None else None,
                "schedule_member_price": sp.get("member_price") if sp.get("member_price") is not None else None,
                "rating": avg_rating,
                "review_count": review_count,
                "distance": None,
                "tags": r.highlights[:3] if r.highlights else [],
                "is_free": r.is_free,
                "is_member_only": r.is_member_only,
                "is_insurance_required": r.is_insurance_required,
                "pet_insurance_price": float(r.pet_insurance_price) if r.pet_insurance_price else 0,
                "person_insurance_price": float(r.person_insurance_price) if r.person_insurance_price else 0,
                "pet_insurance_title": r.pet_insurance_title or "宠物意外险",
                "pet_insurance_unit": r.pet_insurance_unit or "狗",
                "pet_insurance_desc": r.pet_insurance_desc or "保障宠物活动中突发意外医疗费用，最高保额¥5000",
                "person_insurance_title": r.person_insurance_title or "人身意外险",
                "person_insurance_unit": r.person_insurance_unit or "人",
                "person_insurance_desc": r.person_insurance_desc or "保障出行人意外伤害及医疗，最高保额¥200,000",
                "non_member_price": float(r.non_member_price) if r.non_member_price else 0
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
    """获取路线类型列表（返回所有启用的类型）"""
    try:
        result = await db.execute(
            select(RouteType)
            .where(RouteType.status == 1)
            .order_by(RouteType.sort_order)
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
        
        # 查询最近排期价格
        sp = await _get_nearest_schedule_prices(db, [r.id])
        sp_val = sp.get(r.id, {})
        
        type_map = await _get_route_type_map(db)
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": type_map.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": _build_file_url(r.cover_image),
            "gallery": [_build_file_url(u) for u in (r.gallery or [])],
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
            "schedule_price": sp_val.get("price") if sp_val.get("price") is not None else 0,
            "schedule_self_drive_price": sp_val.get("self_drive_price") if sp_val.get("self_drive_price") is not None else None,
            "schedule_member_price": sp_val.get("member_price") if sp_val.get("member_price") is not None else None,
            "display_price": r.display_price,
            "rating": avg_rating,
            "review_count": review_count,
            "suitable_breeds": r.suitable_breeds or [],
            "unsuitable_breeds": r.unsuitable_breeds or [],
            "safety_video_url": r.safety_video_url,
            "safety_video_duration": r.safety_video_duration or 180,
            "is_safety_required": bool(r.is_safety_required),
            "status": r.status,
            "is_free": r.is_free,
            "is_member_only": r.is_member_only,
            "is_insurance_required": r.is_insurance_required,
            "pet_insurance_price": float(r.pet_insurance_price) if r.pet_insurance_price else 0,
            "person_insurance_price": float(r.person_insurance_price) if r.person_insurance_price else 0,
            "pet_insurance_title": r.pet_insurance_title or "宠物意外险",
            "pet_insurance_unit": r.pet_insurance_unit or "狗",
            "pet_insurance_desc": r.pet_insurance_desc or "保障宠物活动中突发意外医疗费用，最高保额¥5000",
            "person_insurance_title": r.person_insurance_title or "人身意外险",
            "person_insurance_unit": r.person_insurance_unit or "人",
            "person_insurance_desc": r.person_insurance_desc or "保障出行人意外伤害及医疗，最高保额¥200,000",
            "non_member_price": float(r.non_member_price) if r.non_member_price else 0,
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
        
        # 返回正常状态（status=1）和已满状态（status=2）的排期，过滤已删除/关闭的排期
        query = select(RouteSchedule).where(
            and_(
                RouteSchedule.route_id == route_id,
                RouteSchedule.status.in_([1, 2])
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
        all_user_ids = list(set(guide_ids + trainer_ids))
        if all_user_ids:
            try:
                user_result = await db.execute(
                    text("SELECT id, nickname FROM users WHERE id IN :ids"),
                    {"ids": tuple(all_user_ids)}
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
                "start_time": _format_time(s.start_time) or "09:00",
                "end_time": _format_time(s.end_time) or "17:00",
                "price": float(s.price) if s.price is not None else 0,
                "self_drive_price": float(s.self_drive_price) if s.self_drive_price is not None else None,
                "single_person_price": float(s.single_person_price) if s.single_person_price is not None else None,
                "single_pet_price": float(s.single_pet_price) if s.single_pet_price is not None else None,
                "extra_person_price": float(s.extra_person_price) if s.extra_person_price is not None else None,
                "extra_pet_price": float(s.extra_pet_price) if s.extra_pet_price is not None else None,
                "self_drive_single_person_price": float(s.self_drive_single_person_price) if s.self_drive_single_person_price is not None else None,
                "self_drive_single_pet_price": float(s.self_drive_single_pet_price) if s.self_drive_single_pet_price is not None else None,
                "self_drive_extra_person_price": float(s.self_drive_extra_person_price) if s.self_drive_extra_person_price is not None else None,
                "self_drive_extra_pet_price": float(s.self_drive_extra_pet_price) if s.self_drive_extra_pet_price is not None else None,
                "non_member_price": float(s.non_member_price) if s.non_member_price is not None else None,
                # 会员专属价
                "member_price": float(s.member_price) if s.member_price is not None else None,
                "member_single_person_price": float(s.member_single_person_price) if s.member_single_person_price is not None else None,
                "member_single_pet_price": float(s.member_single_pet_price) if s.member_single_pet_price is not None else None,
                "member_extra_person_price": float(s.member_extra_person_price) if s.member_extra_person_price is not None else None,
                "member_extra_pet_price": float(s.member_extra_pet_price) if s.member_extra_pet_price is not None else None,
                "member_self_drive_price": float(s.member_self_drive_price) if s.member_self_drive_price is not None else None,
                "member_self_drive_single_person_price": float(s.member_self_drive_single_person_price) if s.member_self_drive_single_person_price is not None else None,
                "member_self_drive_single_pet_price": float(s.member_self_drive_single_pet_price) if s.member_self_drive_single_pet_price is not None else None,
                "member_self_drive_extra_person_price": float(s.member_self_drive_extra_person_price) if s.member_self_drive_extra_person_price is not None else None,
                "member_self_drive_extra_pet_price": float(s.member_self_drive_extra_pet_price) if s.member_self_drive_extra_pet_price is not None else None,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "travel_type": s.travel_type or 0,
                "guide_name": user_names.get(s.guide_id, "") if s.guide_id else "",
                "trainer_name": user_names.get(s.trainer_id, "") if s.trainer_id else "",
                "addon_prices": s.addon_prices or {},
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
    """路线更新请求（支持部分更新）"""
    name: Optional[str] = None
    route_no: Optional[str] = None
    route_type: Optional[int] = None
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
    difficulty: Optional[int] = None
    min_participants: Optional[int] = None
    max_participants: Optional[int] = None
    base_price: Optional[float] = None
    self_drive_discount: Optional[float] = None
    single_person_price: Optional[float] = None
    two_person_one_pet_price: Optional[float] = None
    one_person_two_pet_price: Optional[float] = None
    single_pet_price: Optional[float] = None
    extra_person_price: Optional[float] = None
    extra_pet_price: Optional[float] = None
    # 自驾套餐价格
    self_drive_base_price: Optional[float] = None
    self_drive_single_person_price: Optional[float] = None
    self_drive_two_person_one_pet_price: Optional[float] = None
    self_drive_one_person_two_pet_price: Optional[float] = None
    self_drive_single_pet_price: Optional[float] = None
    self_drive_extra_person_price: Optional[float] = None
    self_drive_extra_pet_price: Optional[float] = None
    display_price: Optional[str] = None
    safety_video_url: Optional[str] = None
    safety_video_duration: Optional[int] = None
    is_safety_required: Optional[int] = None
    is_hot: Optional[int] = None
    status: Optional[int] = None
    is_free: Optional[int] = None
    is_member_only: Optional[int] = None
    is_insurance_required: Optional[int] = None
    pet_insurance_price: Optional[float] = None
    person_insurance_price: Optional[float] = None
    pet_insurance_title: Optional[str] = None
    pet_insurance_unit: Optional[str] = None
    pet_insurance_desc: Optional[str] = None
    person_insurance_title: Optional[str] = None
    person_insurance_unit: Optional[str] = None
    person_insurance_desc: Optional[str] = None
    non_member_price: Optional[float] = None
    sort_order: Optional[int] = None


class RouteCreate(BaseModel):
    """路线创建请求（必填字段）"""
    name: str
    route_type: int
    route_no: Optional[str] = None
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
    base_price: Optional[float] = None
    self_drive_discount: Optional[float] = 0
    single_person_price: Optional[float] = None
    two_person_one_pet_price: Optional[float] = None
    one_person_two_pet_price: Optional[float] = None
    single_pet_price: Optional[float] = None
    extra_person_price: Optional[float] = 0
    extra_pet_price: Optional[float] = 0
    # 自驾套餐价格
    self_drive_base_price: Optional[float] = None
    self_drive_single_person_price: Optional[float] = None
    self_drive_two_person_one_pet_price: Optional[float] = None
    self_drive_one_person_two_pet_price: Optional[float] = None
    self_drive_single_pet_price: Optional[float] = None
    self_drive_extra_person_price: Optional[float] = None
    self_drive_extra_pet_price: Optional[float] = None
    display_price: Optional[str] = None
    safety_video_url: Optional[str] = None
    safety_video_duration: int = 180
    is_safety_required: int = 1
    is_hot: int = 0
    status: int = 1
    is_free: Optional[int] = 0
    is_member_only: Optional[int] = 0
    is_insurance_required: Optional[int] = 1
    pet_insurance_price: Optional[float] = 15.00
    person_insurance_price: Optional[float] = 10.00
    pet_insurance_title: Optional[str] = "宠物意外险"
    pet_insurance_unit: Optional[str] = "狗"
    pet_insurance_desc: Optional[str] = "保障宠物活动中突发意外医疗费用，最高保额¥5000"
    person_insurance_title: Optional[str] = "人身意外险"
    person_insurance_unit: Optional[str] = "人"
    person_insurance_desc: Optional[str] = "保障出行人意外伤害及医疗，最高保额¥200,000"
    non_member_price: Optional[float] = 0
    sort_order: Optional[int] = None

class ScheduleCreateUpdate(BaseModel):
    """排期创建/更新请求"""
    schedule_date: Optional[str] = None
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "17:00"
    price: Optional[float] = None
    self_drive_price: Optional[float] = None
    # 大巴套餐价格
    single_person_price: Optional[float] = None
    single_pet_price: Optional[float] = None
    extra_person_price: Optional[float] = None
    extra_pet_price: Optional[float] = None
    # 自驾套餐价格
    self_drive_single_person_price: Optional[float] = None
    self_drive_single_pet_price: Optional[float] = None
    self_drive_extra_person_price: Optional[float] = None
    self_drive_extra_pet_price: Optional[float] = None
    non_member_price: Optional[float] = None
    # 会员专属价
    member_price: Optional[float] = None
    member_single_person_price: Optional[float] = None
    member_single_pet_price: Optional[float] = None
    member_extra_person_price: Optional[float] = None
    member_extra_pet_price: Optional[float] = None
    member_self_drive_price: Optional[float] = None
    member_self_drive_single_person_price: Optional[float] = None
    member_self_drive_single_pet_price: Optional[float] = None
    member_self_drive_extra_person_price: Optional[float] = None
    member_self_drive_extra_pet_price: Optional[float] = None
    stock: Optional[int] = None
    status: Optional[int] = None
    guide_id: Optional[int] = None
    trainer_id: Optional[int] = None
    addon_prices: Optional[dict] = None
    travel_type: Optional[int] = 0


def _format_time(time_val) -> str:
    """将 TIME/timedelta 转换为 HH:MM 字符串"""
    if time_val is None:
        return ""
    if isinstance(time_val, str):
        return time_val
    if hasattr(time_val, "total_seconds"):  # timedelta
        seconds = int(time_val.total_seconds())
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours:02d}:{minutes:02d}"
    return str(time_val)


async def _process_rich_text(content: str) -> str:
    """提取富文本中的 base64 图片，上传到 file-service，替换为 URL"""
    if not content or not isinstance(content, str):
        return content
    
    img_regex = re.compile(r'<img[^>]+src=["\'](data:image/(jpeg|jpg|png|gif|webp);base64,([^"\']+))["\'][^>]*>')
    matches = list(img_regex.finditer(content))
    if not matches:
        return content
    
    new_content = content
    async with httpx.AsyncClient() as client:
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
    
    return new_content


async def process_content_modules(content_modules: list) -> list:
    """提取 content 中的 base64 图片，上传到 file-service，替换为 URL"""
    if not content_modules:
        return content_modules
    
    processed = []
    for mod in content_modules:
        content = mod.get("content", "")
        new_content = await _process_rich_text(content)
        processed.append({**mod, "content": new_content})
    
    return processed


@app.post("/api/v1/admin/routes")
async def admin_create_route(
    data: RouteCreate,
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
        
        # 处理富文本中的 base64 图片
        highlights_detail = await _process_rich_text(data.highlights_detail) if data.highlights_detail else data.highlights_detail
        fee_description = await _process_rich_text(data.fee_description) if data.fee_description else data.fee_description
        fee_include = await _process_rich_text(data.fee_include) if data.fee_include else data.fee_include
        fee_exclude = await _process_rich_text(data.fee_exclude) if data.fee_exclude else data.fee_exclude
        notice = await _process_rich_text(data.notice) if data.notice else data.notice
        
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
            highlights_detail=highlights_detail,
            fee_description=fee_description,
            fee_include=fee_include,
            fee_exclude=fee_exclude,
            notice=notice,
            content_modules=content_modules,
            suitable_breeds=data.suitable_breeds,
            unsuitable_breeds=data.unsuitable_breeds,
            duration=data.duration,
            difficulty=data.difficulty,
            min_participants=data.min_participants,
            max_participants=data.max_participants,
            safety_video_url=data.safety_video_url,
            safety_video_duration=data.safety_video_duration,
            is_safety_required=data.is_safety_required,
            is_hot=data.is_hot,
            status=data.status,
            is_free=data.is_free if data.is_free is not None else 0,
            is_member_only=data.is_member_only if data.is_member_only is not None else 0,
            is_insurance_required=data.is_insurance_required if data.is_insurance_required is not None else 1,
            pet_insurance_price=data.pet_insurance_price if data.pet_insurance_price is not None else 15.00,
            person_insurance_price=data.person_insurance_price if data.person_insurance_price is not None else 10.00,
            pet_insurance_title=data.pet_insurance_title if data.pet_insurance_title is not None else "宠物意外险",
            pet_insurance_unit=data.pet_insurance_unit if data.pet_insurance_unit is not None else "狗",
            pet_insurance_desc=data.pet_insurance_desc if data.pet_insurance_desc is not None else "保障宠物活动中突发意外医疗费用，最高保额¥5000",
            person_insurance_title=data.person_insurance_title if data.person_insurance_title is not None else "人身意外险",
            person_insurance_unit=data.person_insurance_unit if data.person_insurance_unit is not None else "人",
            person_insurance_desc=data.person_insurance_desc if data.person_insurance_desc is not None else "保障出行人意外伤害及医疗，最高保额¥200,000",
            non_member_price=data.non_member_price if data.non_member_price is not None else 0,
            sort_order=data.sort_order if data.sort_order is not None else 0
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
        
        # 更新字段 - 只更新传入的非None字段（支持部分更新）
        update_data = data.model_dump(exclude={'route_no'}, exclude_unset=True)
        if update_data.get('content_modules'):
            update_data['content_modules'] = await process_content_modules(update_data['content_modules'])
        # 处理富文本中的 base64 图片
        for rich_field in ['highlights_detail', 'fee_description', 'fee_include', 'fee_exclude', 'notice']:
            if update_data.get(rich_field):
                update_data[rich_field] = await _process_rich_text(update_data[rich_field])
        # 价格字段已下放到排期管理，不再通过路线基本信息更新
        price_fields = ['base_price', 'self_drive_discount', 'single_person_price', 'two_person_one_pet_price',
                        'one_person_two_pet_price', 'single_pet_price', 'extra_person_price', 'extra_pet_price',
                        'self_drive_base_price', 'self_drive_single_person_price', 'self_drive_two_person_one_pet_price',
                        'self_drive_one_person_two_pet_price', 'self_drive_single_pet_price',
                        'self_drive_extra_person_price', 'self_drive_extra_pet_price']
        for field in price_fields:
            update_data.pop(field, None)
        for field, value in update_data.items():
            if value is not None:
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
        
        route.status = -1  # 软删除（-1=已删除，与下架0区分开）
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
    route_no: Optional[str] = None,
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
            Route.cover_image, Route.base_price, Route.self_drive_discount, Route.single_person_price,
            Route.two_person_one_pet_price, Route.one_person_two_pet_price,
            Route.single_pet_price, Route.extra_person_price,
            Route.extra_pet_price,
            Route.self_drive_base_price, Route.self_drive_single_person_price,
            Route.self_drive_two_person_one_pet_price, Route.self_drive_one_person_two_pet_price,
            Route.self_drive_single_pet_price, Route.self_drive_extra_person_price,
            Route.self_drive_extra_pet_price,
            Route.duration,
            Route.min_participants, Route.max_participants,
            Route.is_hot, Route.status, Route.is_free, Route.is_member_only,
            Route.is_insurance_required, Route.pet_insurance_price, Route.person_insurance_price,
            Route.pet_insurance_title, Route.pet_insurance_unit, Route.pet_insurance_desc,
            Route.person_insurance_title, Route.person_insurance_unit, Route.person_insurance_desc,
            Route.non_member_price, Route.sort_order, Route.created_at, Route.updated_at
        )
        if status is not None:
            query = select(Route).where(Route.status == status).options(load_only_cols)
        else:
            query = select(Route).where(Route.status.in_([0, 1])).options(load_only_cols)
        
        # 热门筛选
        if is_hot is not None:
            query = query.where(Route.is_hot == is_hot)
        
        if keyword:
            query = query.where(
                Route.name.contains(keyword) | Route.route_no.contains(keyword)
            )
        
        if route_no:
            query = query.where(Route.route_no == route_no)
        
        if route_type:
            query = query.where(Route.route_type == route_type)
        
        # 总数（使用 func.count 避免加载全表数据）
        from sqlalchemy import func as sa_func
        count_query = select(sa_func.count(Route.id))
        if status is not None:
            count_query = count_query.where(Route.status == status)
        else:
            count_query = count_query.where(Route.status.in_([0, 1]))
        if is_hot is not None:
            count_query = count_query.where(Route.is_hot == is_hot)
        if keyword:
            count_query = count_query.where(
                Route.name.contains(keyword) | Route.route_no.contains(keyword)
            )
        if route_no:
            count_query = count_query.where(Route.route_no == route_no)
        if route_type:
            count_query = count_query.where(Route.route_type == route_type)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
        query = query.order_by(Route.sort_order.asc(), Route.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        routes_db = result.scalars().all()
        
        # 查询最近排期价格
        route_ids = [r.id for r in routes_db]
        schedule_prices = await _get_nearest_schedule_prices(db, route_ids)
        
        routes = []
        type_map = await _get_route_type_map(db)
        for r in routes_db:
            sp = schedule_prices.get(r.id, {})
            routes.append({
                "id": r.id,
                "route_no": r.route_no,
                "name": r.name,
                "route_type": r.route_type,
                "type_name": type_map.get(r.route_type, "其他"),
                "cover_image": _build_file_url(r.cover_image),
                "schedule_price": sp.get("price") if sp.get("price") else 0,
                "schedule_self_drive_price": sp.get("self_drive_price") if sp.get("self_drive_price") else None,
                "duration": r.duration,
                "min_participants": r.min_participants,
                "max_participants": r.max_participants,
                "is_hot": r.is_hot,
                "status": r.status,
                "is_free": r.is_free,
                "is_member_only": r.is_member_only,
                "is_insurance_required": r.is_insurance_required,
                "pet_insurance_price": float(r.pet_insurance_price) if r.pet_insurance_price else 0,
                "person_insurance_price": float(r.person_insurance_price) if r.person_insurance_price else 0,
                "pet_insurance_title": r.pet_insurance_title or "宠物意外险",
                "pet_insurance_unit": r.pet_insurance_unit or "狗",
                "pet_insurance_desc": r.pet_insurance_desc or "保障宠物活动中突发意外医疗费用，最高保额¥5000",
                "person_insurance_title": r.person_insurance_title or "人身意外险",
                "person_insurance_unit": r.person_insurance_unit or "人",
                "person_insurance_desc": r.person_insurance_desc or "保障出行人意外伤害及医疗，最高保额¥200,000",
                "non_member_price": float(r.non_member_price) if r.non_member_price else 0,
                "sort_order": r.sort_order,
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
        
        # 查询最近排期价格
        sp = await _get_nearest_schedule_prices(db, [r.id])
        sp_val = sp.get(r.id, {})
        
        type_map = await _get_route_type_map(db)
        route = {
            "id": r.id,
            "route_no": r.route_no,
            "name": r.name,
            "route_type": r.route_type,
            "type_name": type_map.get(r.route_type, "其他"),
            "title": r.title,
            "subtitle": r.subtitle,
            "cover_image": _build_file_url(r.cover_image),
            "gallery": [_build_file_url(u) for u in (r.gallery or [])],
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
            "schedule_price": sp_val.get("price") if sp_val.get("price") else 0,
            "schedule_self_drive_price": sp_val.get("self_drive_price") if sp_val.get("self_drive_price") else None,
            "display_price": r.display_price,
            "safety_video_url": r.safety_video_url,
            "safety_video_duration": r.safety_video_duration,
            "is_safety_required": r.is_safety_required,
            "is_hot": r.is_hot,
            "status": r.status,
            "is_free": r.is_free,
            "is_member_only": r.is_member_only,
            "is_insurance_required": r.is_insurance_required,
            "pet_insurance_price": float(r.pet_insurance_price) if r.pet_insurance_price else 0,
            "person_insurance_price": float(r.person_insurance_price) if r.person_insurance_price else 0,
            "pet_insurance_title": r.pet_insurance_title or "宠物意外险",
            "pet_insurance_unit": r.pet_insurance_unit or "狗",
            "pet_insurance_desc": r.pet_insurance_desc or "保障宠物活动中突发意外医疗费用，最高保额¥5000",
            "person_insurance_title": r.person_insurance_title or "人身意外险",
            "person_insurance_unit": r.person_insurance_unit or "人",
            "person_insurance_desc": r.person_insurance_desc or "保障出行人意外伤害及医疗，最高保额¥200,000",
            "non_member_price": float(r.non_member_price) if r.non_member_price else 0,
            "sort_order": r.sort_order,
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
                "start_time": _format_time(s.start_time) or "09:00",
                "end_time": _format_time(s.end_time) or "17:00",
                "price": float(s.price) if s.price else 0,
                "self_drive_price": float(s.self_drive_price) if s.self_drive_price else None,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "guide_id": s.guide_id,
                "trainer_id": s.trainer_id,
                "addon_prices": s.addon_prices or {},
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
        
        # 返回该路线所有排期（不限制状态，管理后台需要查看全部）
        result = await db.execute(
            select(RouteSchedule)
            .where(RouteSchedule.route_id == route_id)
            .order_by(RouteSchedule.schedule_date.asc())
        )
        schedules_db = result.scalars().all()
        
        schedules = []
        for s in schedules_db:
            schedules.append({
                "id": s.id,
                "route_id": s.route_id,
                "schedule_date": s.schedule_date.isoformat() if s.schedule_date else "",
                "start_time": _format_time(s.start_time) or "09:00",
                "end_time": _format_time(s.end_time) or "17:00",
                "price": float(s.price) if s.price is not None else 0,
                "self_drive_price": float(s.self_drive_price) if s.self_drive_price is not None else None,
                # 大巴套餐价格
                "single_person_price": float(s.single_person_price) if s.single_person_price is not None else None,
                "single_pet_price": float(s.single_pet_price) if s.single_pet_price is not None else None,
                "extra_person_price": float(s.extra_person_price) if s.extra_person_price is not None else None,
                "extra_pet_price": float(s.extra_pet_price) if s.extra_pet_price is not None else None,
                # 自驾套餐价格
                "self_drive_single_person_price": float(s.self_drive_single_person_price) if s.self_drive_single_person_price is not None else None,
                "self_drive_single_pet_price": float(s.self_drive_single_pet_price) if s.self_drive_single_pet_price is not None else None,
                "self_drive_extra_person_price": float(s.self_drive_extra_person_price) if s.self_drive_extra_person_price is not None else None,
                "self_drive_extra_pet_price": float(s.self_drive_extra_pet_price) if s.self_drive_extra_pet_price is not None else None,
                # 会员专属价
                "member_price": float(s.member_price) if s.member_price is not None else None,
                "member_single_person_price": float(s.member_single_person_price) if s.member_single_person_price is not None else None,
                "member_single_pet_price": float(s.member_single_pet_price) if s.member_single_pet_price is not None else None,
                "member_extra_person_price": float(s.member_extra_person_price) if s.member_extra_person_price is not None else None,
                "member_extra_pet_price": float(s.member_extra_pet_price) if s.member_extra_pet_price is not None else None,
                "member_self_drive_price": float(s.member_self_drive_price) if s.member_self_drive_price is not None else None,
                "member_self_drive_single_person_price": float(s.member_self_drive_single_person_price) if s.member_self_drive_single_person_price is not None else None,
                "member_self_drive_single_pet_price": float(s.member_self_drive_single_pet_price) if s.member_self_drive_single_pet_price is not None else None,
                "member_self_drive_extra_person_price": float(s.member_self_drive_extra_person_price) if s.member_self_drive_extra_person_price is not None else None,
                "member_self_drive_extra_pet_price": float(s.member_self_drive_extra_pet_price) if s.member_self_drive_extra_pet_price is not None else None,
                "stock": s.stock or 0,
                "sold": s.sold or 0,
                "status": s.status or 1,
                "travel_type": s.travel_type or 0,
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
        from app.models.route import RouteSchedule, Route
        from datetime import datetime
        from sqlalchemy import and_
        
        schedule_date = datetime.strptime(data.schedule_date, "%Y-%m-%d").date()
        
        # 查询路线信息，免费路线自动设置 price=0
        route_result = await db.execute(select(Route).where(Route.id == route_id))
        route = route_result.scalar_one_or_none()
        is_free = route.is_free if route else 0
        
        # 免费路线排期价格自动为0
        schedule_price = 0 if is_free else data.price
        
        # 检查该日期是否已存在排期（不区分状态，数据库唯一键限制）
        existing_result = await db.execute(
            select(RouteSchedule).where(
                and_(
                    RouteSchedule.route_id == route_id,
                    RouteSchedule.schedule_date == schedule_date
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
            price=schedule_price,
            self_drive_price=None if is_free else data.self_drive_price,
            single_person_price=data.single_person_price,
            single_pet_price=data.single_pet_price,
            extra_person_price=data.extra_person_price,
            extra_pet_price=data.extra_pet_price,
            self_drive_single_person_price=data.self_drive_single_person_price,
            self_drive_single_pet_price=data.self_drive_single_pet_price,
            self_drive_extra_person_price=data.self_drive_extra_person_price,
            self_drive_extra_pet_price=data.self_drive_extra_pet_price,
            non_member_price=data.non_member_price,
            # 会员专属价
            member_price=data.member_price,
            member_single_person_price=data.member_single_person_price,
            member_single_pet_price=data.member_single_pet_price,
            member_extra_person_price=data.member_extra_person_price,
            member_extra_pet_price=data.member_extra_pet_price,
            member_self_drive_price=data.member_self_drive_price,
            member_self_drive_single_person_price=data.member_self_drive_single_person_price,
            member_self_drive_single_pet_price=data.member_self_drive_single_pet_price,
            member_self_drive_extra_person_price=data.member_self_drive_extra_person_price,
            member_self_drive_extra_pet_price=data.member_self_drive_extra_pet_price,
            addon_prices=data.addon_prices,
            stock=data.stock,
            status=data.status,
            guide_id=data.guide_id,
            trainer_id=data.trainer_id,
            travel_type=data.travel_type
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
        
        # 物理删除排期（无订单关联时）
        await db.delete(schedule)
        await db.commit()
        
        logger.info(f"Schedule deleted successfully: {schedule_id}")
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
        from app.models.route import RouteSchedule, Route
        from datetime import datetime, timedelta
        from sqlalchemy import and_
        
        # 查询路线信息，免费路线自动设置 price=0
        route_result = await db.execute(select(Route).where(Route.id == route_id))
        route = route_result.scalar_one_or_none()
        is_free = route.is_free if route else 0
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        week_days = data.get('week_days', [1, 2, 3, 4, 5, 6, 7])
        start_time = data.get('start_time', '09:00')
        end_time = data.get('end_time', '17:00')
        price = 0 if is_free else data.get('price')
        self_drive_price = None if is_free else data.get('self_drive_price')
        # 大巴套餐价格
        single_person_price = data.get('single_person_price')
        single_pet_price = data.get('single_pet_price')
        extra_person_price = data.get('extra_person_price')
        extra_pet_price = data.get('extra_pet_price')
        # 自驾套餐价格
        self_drive_single_person_price = data.get('self_drive_single_person_price')
        self_drive_single_pet_price = data.get('self_drive_single_pet_price')
        self_drive_extra_person_price = data.get('self_drive_extra_person_price')
        self_drive_extra_pet_price = data.get('self_drive_extra_pet_price')
        non_member_price = data.get('non_member_price')
        # 会员专属价
        member_price = data.get('member_price')
        member_single_person_price = data.get('member_single_person_price')
        member_single_pet_price = data.get('member_single_pet_price')
        member_extra_person_price = data.get('member_extra_person_price')
        member_extra_pet_price = data.get('member_extra_pet_price')
        member_self_drive_price = data.get('member_self_drive_price')
        member_self_drive_single_person_price = data.get('member_self_drive_single_person_price')
        member_self_drive_single_pet_price = data.get('member_self_drive_single_pet_price')
        member_self_drive_extra_person_price = data.get('member_self_drive_extra_person_price')
        member_self_drive_extra_pet_price = data.get('member_self_drive_extra_pet_price')
        travel_type = data.get('travel_type', 0)
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
                # 检查该日期是否已存在排期（不区分状态，数据库唯一键限制）
                existing_result = await db.execute(
                    select(RouteSchedule).where(
                        and_(
                            RouteSchedule.route_id == route_id,
                            RouteSchedule.schedule_date == current_date
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
                    self_drive_price=self_drive_price,
                    single_person_price=single_person_price,
                    single_pet_price=single_pet_price,
                    extra_person_price=extra_person_price,
                    extra_pet_price=extra_pet_price,
                    self_drive_single_person_price=self_drive_single_person_price,
                    self_drive_single_pet_price=self_drive_single_pet_price,
                    self_drive_extra_person_price=self_drive_extra_person_price,
                    self_drive_extra_pet_price=self_drive_extra_pet_price,
                    non_member_price=non_member_price,
                    # 会员专属价
                    member_price=member_price,
                    member_single_person_price=member_single_person_price,
                    member_single_pet_price=member_single_pet_price,
                    member_extra_person_price=member_extra_person_price,
                    member_extra_pet_price=member_extra_pet_price,
                    member_self_drive_price=member_self_drive_price,
                    member_self_drive_single_person_price=member_self_drive_single_person_price,
                    member_self_drive_single_pet_price=member_self_drive_single_pet_price,
                    member_self_drive_extra_person_price=member_self_drive_extra_person_price,
                    member_self_drive_extra_pet_price=member_self_drive_extra_pet_price,
                    stock=stock,
                    travel_type=travel_type,
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


# ==================== 行程选配 API ====================

@app.get("/api/v1/routes/{route_id}/addons")
async def get_route_addons(
    route_id: int,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取线路的行程选配列表（小程序端）"""
    query = select(RouteAddon).where(
        RouteAddon.route_id == route_id,
        RouteAddon.status == 1
    )
    if category:
        query = query.where(RouteAddon.category == category)
    query = query.order_by(RouteAddon.sort_order.asc(), RouteAddon.id.asc())
    result = await db.execute(query)
    addons = result.scalars().all()
    return success({
        "addons": [
            {
                "id": a.id,
                "category": a.category,
                "name": a.name,
                "price": float(a.price),
                "unit": a.unit,
                "description": a.description,
                "stock": a.stock,
                "limit_per_order": a.limit_per_order,
                "is_required": a.is_required,
                "need_info": a.need_info,
                "extra_config": a.extra_config or {}
            }
            for a in addons
        ]
    })


# 管理后台 - 行程选配管理

@app.get("/api/v1/admin/addons")
async def admin_list_addons(
    route_id: Optional[int] = None,
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    status: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """管理后台：行程选配列表"""
    from app.models.route import Route
    query = select(RouteAddon, Route.name.label("route_name")).join(
        Route, RouteAddon.route_id == Route.id, isouter=True
    )
    if route_id:
        query = query.where(RouteAddon.route_id == route_id)
    if category:
        query = query.where(RouteAddon.category == category)
    if keyword:
        query = query.where(RouteAddon.name.contains(keyword))
    if status is not None:
        query = query.where(RouteAddon.status == status)
    query = query.order_by(RouteAddon.sort_order.asc(), RouteAddon.id.desc())

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    return success({
        "total": total,
        "page": page,
        "page_size": page_size,
        "addons": [
            {
                "id": a.id,
                "route_id": a.route_id,
                "route_name": route_name,
                "category": a.category,
                "name": a.name,
                "price": float(a.price),
                "unit": a.unit,
                "description": a.description,
                "stock": a.stock,
                "sold": a.sold,
                "limit_per_order": a.limit_per_order,
                "is_required": a.is_required,
                "need_info": a.need_info,
                "status": a.status,
                "sort_order": a.sort_order,
                "extra_config": a.extra_config or {},
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a, route_name in rows
        ]
    })


@app.get("/api/v1/admin/addons/{addon_id}")
async def admin_get_addon(
    addon_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：行程选配详情"""
    result = await db.execute(select(RouteAddon).where(RouteAddon.id == addon_id))
    a = result.scalar_one_or_none()
    if not a:
        return success(None)
    return success({
        "id": a.id,
        "route_id": a.route_id,
        "category": a.category,
        "name": a.name,
        "price": float(a.price),
        "unit": a.unit,
        "description": a.description,
        "stock": a.stock,
        "sold": a.sold,
        "limit_per_order": a.limit_per_order,
        "is_required": a.is_required,
        "need_info": a.need_info,
        "status": a.status,
        "sort_order": a.sort_order,
        "extra_config": a.extra_config or {}
    })


@app.post("/api/v1/admin/addons")
async def admin_create_addon(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：创建行程选配"""
    addon = RouteAddon(
        route_id=data.get("route_id"),
        category=data.get("category"),
        name=data.get("name"),
        price=data.get("price", 0),
        unit=data.get("unit", "份"),
        description=data.get("description"),
        stock=data.get("stock", 999),
        limit_per_order=data.get("limit_per_order", 0),
        is_required=data.get("is_required", 0),
        need_info=data.get("need_info", 0),
        sort_order=data.get("sort_order", 0),
        status=data.get("status", 1),
        extra_config=data.get("extra_config", {})
    )
    db.add(addon)
    await db.commit()
    await db.refresh(addon)
    return success({"id": addon.id})


@app.put("/api/v1/admin/addons/{addon_id}")
async def admin_update_addon(
    addon_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：更新行程选配"""
    result = await db.execute(select(RouteAddon).where(RouteAddon.id == addon_id))
    addon = result.scalar_one_or_none()
    if not addon:
        return {"code": 404, "message": "选配不存在", "data": None}

    for field in ["route_id", "category", "name", "price", "unit", "description",
                  "stock", "limit_per_order", "is_required", "need_info",
                  "sort_order", "status", "extra_config"]:
        if field in data:
            setattr(addon, field, data[field])

    await db.commit()
    await db.refresh(addon)
    return success({"id": addon.id})


@app.delete("/api/v1/admin/addons/{addon_id}")
async def admin_delete_addon(
    addon_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：删除行程选配"""
    result = await db.execute(select(RouteAddon).where(RouteAddon.id == addon_id))
    addon = result.scalar_one_or_none()
    if not addon:
        return {"code": 404, "message": "选配不存在", "data": None}
    await db.delete(addon)
    await db.commit()
    return success(None)


# ==================== 行程选配分类 API ====================

@app.get("/api/v1/addon-categories")
async def get_addon_categories(
    db: AsyncSession = Depends(get_db)
):
    """获取启用的行程选配分类列表（公开接口，小程序端）"""
    query = select(AddonCategory).where(AddonCategory.status == 1)
    query = query.order_by(AddonCategory.sort_order.asc(), AddonCategory.id.asc())
    result = await db.execute(query)
    categories = result.scalars().all()
    return success({
        "categories": [
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "sort_order": c.sort_order,
            }
            for c in categories
        ]
    })

@app.get("/api/v1/admin/addon-categories")
async def admin_list_addon_categories(
    status: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：行程选配分类列表"""
    query = select(AddonCategory)
    if status is not None:
        query = query.where(AddonCategory.status == status)
    query = query.order_by(AddonCategory.sort_order.asc(), AddonCategory.id.asc())
    result = await db.execute(query)
    categories = result.scalars().all()
    return success({
        "categories": [
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "sort_order": c.sort_order,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in categories
        ]
    })


@app.post("/api/v1/admin/addon-categories")
async def admin_create_addon_category(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：创建行程选配分类"""
    # 检查 code 是否已存在
    code = data.get("code", "").strip()
    if not code:
        return {"code": 400, "message": "标识码不能为空", "data": None}
    result = await db.execute(select(AddonCategory).where(AddonCategory.code == code))
    if result.scalar_one_or_none():
        return {"code": 400, "message": "标识码已存在", "data": None}

    category = AddonCategory(
        code=code,
        name=data.get("name", ""),
        sort_order=data.get("sort_order", 0),
        status=data.get("status", 1),
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return success({"id": category.id})


@app.put("/api/v1/admin/addon-categories/{category_id}")
async def admin_update_addon_category(
    category_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：更新行程选配分类"""
    result = await db.execute(select(AddonCategory).where(AddonCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        return {"code": 404, "message": "分类不存在", "data": None}

    # 如果修改了 code，检查是否冲突
    new_code = data.get("code", "").strip()
    if new_code and new_code != category.code:
        check = await db.execute(select(AddonCategory).where(AddonCategory.code == new_code))
        if check.scalar_one_or_none():
            return {"code": 400, "message": "标识码已存在", "data": None}
        category.code = new_code

    for field in ["name", "sort_order", "status"]:
        if field in data:
            setattr(category, field, data[field])

    await db.commit()
    await db.refresh(category)
    return success({"id": category.id})


@app.delete("/api/v1/admin/addon-categories/{category_id}")
async def admin_delete_addon_category(
    category_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：删除行程选配分类"""
    result = await db.execute(select(AddonCategory).where(AddonCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        return {"code": 404, "message": "分类不存在", "data": None}

    # 检查是否有关联的选配
    check = await db.execute(select(func.count()).select_from(
        select(RouteAddon).where(RouteAddon.category == category.code).subquery()
    ))
    count = check.scalar() or 0
    if count > 0:
        return {"code": 400, "message": f"该分类下还有 {count} 个选配，无法删除", "data": None}

    await db.delete(category)
    await db.commit()
    return success(None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
