"""
消息服务 - Message Service
端口: 8007
职责: 站内信/通知/推送
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from common.config import settings
from common.database import get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.dependencies import get_current_user
from common.response import success

settings.app_name = "message-service"
settings.app_port = 8007
logger = setup_logger("message-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    yield
    await redis_client.close()


app = FastAPI(title="消息服务", description="站内信/通知/推送", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


# ==================== 小程序端 API ====================

@app.get("/api/v1/notifications")
async def get_notifications(
    notify_type: Optional[str] = None,
    is_read: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户通知列表"""
    try:
        from app.models.notification import Notification
        user_id = current_user.get("user_id", 0)
        
        query = select(Notification).where(
            (Notification.user_id == user_id) | (Notification.user_id == 0)
        )
        
        if notify_type:
            query = query.where(Notification.notify_type == notify_type)
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
        
        query = query.order_by(Notification.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        
        notifications = []
        for n in items:
            notifications.append({
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "notify_type": n.notify_type,
                "biz_id": n.biz_id,
                "biz_type": n.biz_type,
                "is_read": n.is_read,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })
        
        # 统计未读数
        unread_result = await db.execute(
            select(func.count()).where(
                (Notification.user_id == user_id) | (Notification.user_id == 0),
                Notification.is_read == 0
            )
        )
        unread_count = unread_result.scalar()
        
        return success({
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "page_size": page_size,
            "notifications": notifications
        })
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """标记通知为已读"""
    try:
        from app.models.notification import Notification
        
        result = await db.execute(select(Notification).where(Notification.id == notification_id))
        n = result.scalar_one_or_none()
        
        if not n:
            return {"code": 404, "message": "通知不存在", "data": None}
        
        n.is_read = 1
        n.read_at = datetime.now()
        await db.commit()
        
        return success(None, message="标记成功")
    except Exception as e:
        logger.error(f"Error marking notification read: {e}")
        return {"code": 500, "message": f"操作失败: {str(e)}", "data": None}


@app.post("/api/v1/notifications/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """标记所有通知为已读"""
    try:
        from app.models.notification import Notification
        user_id = current_user.get("user_id", 0)
        
        await db.execute(
            update(Notification)
            .where(
                (Notification.user_id == user_id) | (Notification.user_id == 0),
                Notification.is_read == 0
            )
            .values(is_read=1, read_at=datetime.now())
        )
        await db.commit()
        
        return success(None, message="全部标记已读")
    except Exception as e:
        logger.error(f"Error marking all read: {e}")
        return {"code": 500, "message": f"操作失败: {str(e)}", "data": None}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/notifications")
async def admin_get_notifications(
    user_id: Optional[int] = None,
    notify_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取通知列表"""
    try:
        from app.models.notification import Notification
        
        query = select(Notification)
        if user_id is not None:
            query = query.where(Notification.user_id == user_id)
        if notify_type:
            query = query.where(Notification.notify_type == notify_type)
        
        query = query.order_by(Notification.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        
        notifications = []
        for n in items:
            notifications.append({
                "id": n.id,
                "user_id": n.user_id,
                "title": n.title,
                "content": n.content[:100] + "..." if n.content and len(n.content) > 100 else n.content,
                "notify_type": n.notify_type,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "notifications": notifications})
    except Exception as e:
        logger.error(f"Error getting admin notifications: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/notifications")
async def admin_create_notification(data: dict, db: AsyncSession = Depends(get_db)):
    """发送通知（单发或广播）"""
    try:
        from app.models.notification import Notification
        
        user_ids = data.get("user_ids", [])
        if not user_ids:
            user_ids = [0]  # 0 表示广播
        
        notifications = []
        for uid in user_ids:
            n = Notification(
                user_id=uid,
                title=data.get("title", ""),
                content=data.get("content", ""),
                notify_type=data.get("notify_type", "system"),
                biz_id=data.get("biz_id"),
                biz_type=data.get("biz_type"),
            )
            db.add(n)
            notifications.append(n)
        
        await db.commit()
        
        return success({"count": len(notifications)}, message="发送成功")
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return {"code": 500, "message": f"发送失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/notifications/{notification_id}")
async def admin_delete_notification(notification_id: int, db: AsyncSession = Depends(get_db)):
    """删除通知"""
    try:
        from app.models.notification import Notification
        
        result = await db.execute(select(Notification).where(Notification.id == notification_id))
        n = result.scalar_one_or_none()
        
        if not n:
            return {"code": 404, "message": "通知不存在", "data": None}
        
        await db.delete(n)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
