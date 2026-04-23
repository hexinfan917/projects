"""
地图服务 - Map Service
端口: 8004
职责: POI数据/路线规划
"""
import sys
import math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends, Query
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from common.config import settings
from common.database import get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success

settings.app_name = "map-service"
settings.app_port = 8004
logger = setup_logger("map-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    yield
    await redis_client.close()

app = FastAPI(title="地图服务", description="POI数据/路线规划", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


# POI类型映射
POI_TYPE_MAP = {
    1: "酒店",
    2: "餐厅",
    3: "公园",
    4: "景点",
    5: "医院",
    6: "服务区",
}

PET_LEVEL_MAP = {
    1: "允许",
    2: "友好",
    3: "亲宠",
}


def poi_to_dict(poi):
    """POI对象转字典"""
    return {
        "id": poi.id,
        "name": poi.name,
        "poi_type": poi.poi_type,
        "poi_type_name": POI_TYPE_MAP.get(poi.poi_type, "未知"),
        "category": poi.category,
        "province": poi.province,
        "city": poi.city,
        "district": poi.district,
        "address": poi.address,
        "longitude": float(poi.longitude) if poi.longitude else None,
        "latitude": float(poi.latitude) if poi.latitude else None,
        "pet_level": poi.pet_level,
        "pet_level_name": PET_LEVEL_MAP.get(poi.pet_level, "允许"),
        "pet_facilities": poi.pet_facilities or [],
        "pet_policy": poi.pet_policy,
        "pet_fee": poi.pet_fee,
        "images": poi.images or [],
        "phone": poi.phone,
        "business_hours": poi.business_hours,
        "rating": float(poi.rating) if poi.rating else 5.0,
        "review_count": poi.review_count or 0,
        "is_verified": poi.is_verified,
        "status": poi.status,
    }


# ==================== 小程序端 API ====================

@app.get("/api/v1/map/pois")
async def get_pois(
    poi_type: Optional[int] = Query(None, description="POI类型: 1酒店 2餐厅 3公园 4景点 5医院 6服务区"),
    city: Optional[str] = Query(None, description="城市"),
    keyword: Optional[str] = Query(None, description="关键词"),
    pet_level: Optional[int] = Query(None, description="宠物友好度: 1允许 2友好 3亲宠"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取POI列表"""
    try:
        from app.models.poi import POISpot
        
        query = select(POISpot).where(POISpot.status == 1)
        
        if poi_type:
            query = query.where(POISpot.poi_type == poi_type)
        if city:
            query = query.where(POISpot.city.contains(city))
        if keyword:
            query = query.where(POISpot.name.contains(keyword))
        if pet_level:
            query = query.where(POISpot.pet_level >= pet_level)
        
        query = query.order_by(POISpot.is_verified.desc(), POISpot.rating.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        pois_db = result.scalars().all()
        
        pois = [poi_to_dict(p) for p in pois_db]
        
        return success({"total": total, "page": page, "page_size": page_size, "pois": pois})
    except Exception as e:
        logger.error(f"Error getting pois: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/map/pois/nearby")
async def get_nearby_pois(
    longitude: float = Query(..., description="经度"),
    latitude: float = Query(..., description="纬度"),
    radius: float = Query(5.0, description="搜索半径(公里)"),
    poi_type: Optional[int] = Query(None, description="POI类型"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    附近POI搜索
    使用矩形范围查询近似实现
    """
    try:
        from app.models.poi import POISpot
        
        # 计算经纬度范围（1度纬度约111km，1度经度约111km*cos(lat)）
        lat_delta = radius / 111.0
        lng_delta = radius / (111.0 * math.cos(math.radians(latitude)))
        
        min_lat = latitude - lat_delta
        max_lat = latitude + lat_delta
        min_lng = longitude - lng_delta
        max_lng = longitude + lng_delta
        
        query = select(POISpot).where(
            and_(
                POISpot.status == 1,
                POISpot.latitude.between(min_lat, max_lat),
                POISpot.longitude.between(min_lng, max_lng)
            )
        )
        
        if poi_type:
            query = query.where(POISpot.poi_type == poi_type)
        
        result = await db.execute(query)
        pois_db = result.scalars().all()
        
        # 计算实际距离并排序
        pois = []
        for p in pois_db:
            if p.longitude is not None and p.latitude is not None:
                # 简化的平面距离计算（km）
                dx = (float(p.longitude) - longitude) * 111.0 * math.cos(math.radians(latitude))
                dy = (float(p.latitude) - latitude) * 111.0
                distance = math.sqrt(dx * dx + dy * dy)
                
                if distance <= radius:
                    poi_dict = poi_to_dict(p)
                    poi_dict["distance"] = round(distance, 2)
                    pois.append(poi_dict)
        
        pois.sort(key=lambda x: x["distance"])
        total = len(pois)
        pois = pois[(page - 1) * page_size: page * page_size]
        
        return success({"total": total, "page": page, "page_size": page_size, "pois": pois})
    except Exception as e:
        logger.error(f"Error getting nearby pois: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/map/pois/{poi_id}")
async def get_poi_detail(poi_id: int, db: AsyncSession = Depends(get_db)):
    """获取POI详情"""
    try:
        from app.models.poi import POISpot
        
        result = await db.execute(select(POISpot).where(POISpot.id == poi_id, POISpot.status == 1))
        poi = result.scalar_one_or_none()
        
        if not poi:
            return {"code": 404, "message": "POI不存在", "data": None}
        
        return success(poi_to_dict(poi))
    except Exception as e:
        logger.error(f"Error getting poi: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/pois")
async def admin_get_pois(
    poi_type: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    status: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取POI列表"""
    try:
        from app.models.poi import POISpot
        
        query = select(POISpot)
        
        if poi_type:
            query = query.where(POISpot.poi_type == poi_type)
        if city:
            query = query.where(POISpot.city.contains(city))
        if keyword:
            query = query.where(POISpot.name.contains(keyword))
        if status is not None:
            query = query.where(POISpot.status == status)
        
        query = query.order_by(POISpot.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        pois_db = result.scalars().all()
        
        pois = [poi_to_dict(p) for p in pois_db]
        
        return success({"total": total, "page": page, "page_size": page_size, "pois": pois})
    except Exception as e:
        logger.error(f"Error getting admin pois: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/pois")
async def admin_create_poi(data: dict, db: AsyncSession = Depends(get_db)):
    """创建POI"""
    try:
        from app.models.poi import POISpot
        
        poi = POISpot(
            name=data.get("name"),
            poi_type=data.get("poi_type", 1),
            category=data.get("category"),
            province=data.get("province"),
            city=data.get("city"),
            district=data.get("district"),
            address=data.get("address"),
            longitude=data.get("longitude"),
            latitude=data.get("latitude"),
            pet_level=data.get("pet_level", 1),
            pet_facilities=data.get("pet_facilities"),
            pet_policy=data.get("pet_policy"),
            pet_fee=data.get("pet_fee"),
            images=data.get("images"),
            phone=data.get("phone"),
            business_hours=data.get("business_hours"),
            rating=data.get("rating", 5.0),
            status=data.get("status", 1),
        )
        db.add(poi)
        await db.commit()
        await db.refresh(poi)
        
        return success({"id": poi.id}, message="创建成功")
    except Exception as e:
        logger.error(f"Error creating poi: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/pois/{poi_id}")
async def admin_update_poi(poi_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新POI"""
    try:
        from app.models.poi import POISpot
        
        result = await db.execute(select(POISpot).where(POISpot.id == poi_id))
        poi = result.scalar_one_or_none()
        
        if not poi:
            return {"code": 404, "message": "POI不存在", "data": None}
        
        fields = [
            "name", "poi_type", "category", "province", "city", "district",
            "address", "longitude", "latitude", "pet_level", "pet_facilities",
            "pet_policy", "pet_fee", "images", "phone", "business_hours",
            "rating", "status", "is_verified"
        ]
        for field in fields:
            if field in data:
                setattr(poi, field, data[field])
        
        await db.commit()
        return success({"id": poi.id}, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating poi: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/pois/{poi_id}")
async def admin_delete_poi(poi_id: int, db: AsyncSession = Depends(get_db)):
    """删除POI"""
    try:
        from app.models.poi import POISpot
        
        result = await db.execute(select(POISpot).where(POISpot.id == poi_id))
        poi = result.scalar_one_or_none()
        
        if not poi:
            return {"code": 404, "message": "POI不存在", "data": None}
        
        await db.delete(poi)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting poi: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
