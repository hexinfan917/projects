"""
公益服务 - Charity Service
端口: 8009
职责: 公益活动/科普/捐赠入口
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from common.config import settings
from common.database import get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success

settings.app_name = "charity-service"
settings.app_port = 8009
logger = setup_logger("charity-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    yield
    await redis_client.close()


app = FastAPI(title="公益服务", description="公益活动/科普/捐赠", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


ACTIVITY_TYPE_MAP = {
    "volunteer": "义工招募",
    "rescue": "流浪救助",
    "donate": "爱心捐赠",
    "adopt": "宠物领养",
}

STATUS_MAP = {
    0: "草稿",
    1: "报名中",
    2: "进行中",
    3: "已结束",
    4: "已取消",
}


# ==================== 小程序端 API ====================

@app.get("/api/v1/charities/activities")
async def get_activities(
    activity_type: Optional[str] = None,
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """获取公益活动列表"""
    try:
        from app.models.charity import CharityActivity
        
        query = select(CharityActivity)
        
        # 小程序端默认只展示上架状态
        if status is not None:
            query = query.where(CharityActivity.status == status)
        else:
            query = query.where(CharityActivity.status.in_([1, 2]))
        
        if activity_type:
            query = query.where(CharityActivity.activity_type == activity_type)
        
        query = query.order_by(CharityActivity.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        
        activities = []
        for a in items:
            activities.append({
                "id": a.id,
                "title": a.title,
                "subtitle": a.subtitle,
                "cover_image": a.cover_image,
                "activity_type": a.activity_type,
                "type_name": ACTIVITY_TYPE_MAP.get(a.activity_type, "其他"),
                "location": a.location,
                "start_date": a.start_date.isoformat() if a.start_date else None,
                "end_date": a.end_date.isoformat() if a.end_date else None,
                "max_participants": a.max_participants,
                "current_participants": a.current_participants,
                "organizer": a.organizer,
                "content": a.content,
                "status": a.status,
                "status_name": STATUS_MAP.get(a.status, "未知"),
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "activities": activities})
    except Exception as e:
        logger.error(f"Error getting activities: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/charities/activities/{activity_id}")
async def get_activity_detail(activity_id: int, db: AsyncSession = Depends(get_db)):
    """获取公益活动详情"""
    try:
        from app.models.charity import CharityActivity
        
        result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        a = result.scalar_one_or_none()
        
        if not a:
            return {"code": 404, "message": "活动不存在", "data": None}
        
        return success({
            "id": a.id,
            "title": a.title,
            "subtitle": a.subtitle,
            "cover_image": a.cover_image,
            "images": a.images or [],
            "activity_type": a.activity_type,
            "type_name": ACTIVITY_TYPE_MAP.get(a.activity_type, "其他"),
            "content": a.content,
            "location": a.location,
            "start_date": a.start_date.isoformat() if a.start_date else None,
            "end_date": a.end_date.isoformat() if a.end_date else None,
            "max_participants": a.max_participants,
            "current_participants": a.current_participants,
            "contact_name": a.contact_name,
            "contact_phone": a.contact_phone,
            "organizer": a.organizer,
            "status": a.status,
            "status_name": STATUS_MAP.get(a.status, "未知"),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    except Exception as e:
        logger.error(f"Error getting activity: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/charities/activities")
async def admin_get_activities(
    activity_type: Optional[str] = None,
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取公益活动列表"""
    try:
        from app.models.charity import CharityActivity
        
        query = select(CharityActivity)
        
        if activity_type:
            query = query.where(CharityActivity.activity_type == activity_type)
        if status is not None:
            query = query.where(CharityActivity.status == status)
        if keyword:
            query = query.where(CharityActivity.title.contains(keyword))
        
        query = query.order_by(CharityActivity.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        
        activities = []
        for a in items:
            activities.append({
                "id": a.id,
                "title": a.title,
                "subtitle": a.subtitle,
                "cover_image": a.cover_image,
                "images": a.images,
                "activity_type": a.activity_type,
                "type_name": ACTIVITY_TYPE_MAP.get(a.activity_type, "其他"),
                "content": a.content,
                "location": a.location,
                "start_date": a.start_date.isoformat() if a.start_date else None,
                "end_date": a.end_date.isoformat() if a.end_date else None,
                "max_participants": a.max_participants,
                "current_participants": a.current_participants,
                "contact_name": a.contact_name,
                "contact_phone": a.contact_phone,
                "organizer": a.organizer,
                "status": a.status,
                "status_name": STATUS_MAP.get(a.status, "未知"),
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "activities": activities})
    except Exception as e:
        logger.error(f"Error getting admin activities: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/charities/activities")
async def admin_create_activity(data: dict, db: AsyncSession = Depends(get_db)):
    """创建公益活动"""
    try:
        from app.models.charity import CharityActivity
        
        activity = CharityActivity(
            title=data.get("title"),
            subtitle=data.get("subtitle"),
            cover_image=data.get("cover_image"),
            images=data.get("images"),
            activity_type=data.get("activity_type", "volunteer"),
            content=data.get("content"),
            location=data.get("location"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            max_participants=data.get("max_participants", 0),
            contact_name=data.get("contact_name"),
            contact_phone=data.get("contact_phone"),
            organizer=data.get("organizer"),
            status=data.get("status", 0),
        )
        db.add(activity)
        await db.commit()
        await db.refresh(activity)
        
        return success({"id": activity.id}, message="创建成功")
    except Exception as e:
        logger.error(f"Error creating activity: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/charities/activities/{activity_id}")
async def admin_update_activity(activity_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新公益活动"""
    try:
        from app.models.charity import CharityActivity
        
        result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        a = result.scalar_one_or_none()
        
        if not a:
            return {"code": 404, "message": "活动不存在", "data": None}
        
        fields = [
            "title", "subtitle", "cover_image", "images", "activity_type",
            "content", "location", "start_date", "end_date", "max_participants",
            "contact_name", "contact_phone", "organizer", "status"
        ]
        for field in fields:
            if field in data:
                setattr(a, field, data[field])
        
        await db.commit()
        return success({"id": a.id}, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating activity: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/charities/activities/{activity_id}")
async def admin_delete_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    """删除公益活动"""
    try:
        from app.models.charity import CharityActivity
        
        result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        a = result.scalar_one_or_none()
        
        if not a:
            return {"code": 404, "message": "活动不存在", "data": None}
        
        await db.delete(a)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting activity: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
