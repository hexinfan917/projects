"""
公益服务 - Charity Service
端口: 8009
职责: 公益活动/科普/捐赠入口
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends, Header
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from io import BytesIO

from common.config import settings
from common.database import get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success
from common.dependencies import get_current_user

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

REGISTRATION_STATUS_MAP = {
    0: "待审核",
    1: "已通过",
    2: "已拒绝",
    3: "已签到",
}


def activity_to_dict(a) -> dict:
    return {
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
        "require_city": a.require_city,
        "require_emergency": a.require_emergency,
        "disclaimer": a.disclaimer,
        "current_participants": a.current_participants,
        "contact_name": a.contact_name,
        "contact_phone": a.contact_phone,
        "organizer": a.organizer,
        "status": a.status,
        "status_name": STATUS_MAP.get(a.status, "未知"),
        "created_at": a.created_at.isoformat() if a.created_at else None,
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
        
        activities = [activity_to_dict(a) for a in items]
        
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
        
        return success(activity_to_dict(a))
    except Exception as e:
        logger.error(f"Error getting activity: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/charities/activities/{activity_id}/register")
async def register_activity(
    activity_id: int,
    data: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """报名公益活动"""
    try:
        from app.models.charity import CharityActivity, CharityRegistration
        
        result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        activity = result.scalar_one_or_none()
        
        if not activity:
            return {"code": 404, "message": "活动不存在", "data": None}
        
        if activity.status != 1:
            return {"code": 400, "message": "该活动不在报名中", "data": None}
        
        # 检查是否已报名
        existing = await db.execute(
            select(CharityRegistration).where(
                CharityRegistration.activity_id == activity_id,
                CharityRegistration.openid == user["openid"]
            )
        )
        if existing.scalar_one_or_none():
            return {"code": 400, "message": "您已报名该活动", "data": None}
        
        # 检查人数限制
        if activity.max_participants > 0:
            count_result = await db.execute(
                select(func.count()).select_from(CharityRegistration).where(
                    CharityRegistration.activity_id == activity_id,
                    CharityRegistration.status.in_([0, 1, 3])
                )
            )
            approved_count = count_result.scalar() or 0
            # 加上本次报名人数
            participant_count = int(data.get("participant_count", 1))
            if approved_count + participant_count > activity.max_participants:
                return {"code": 400, "message": "报名人数已满", "data": None}
        
        registration = CharityRegistration(
            activity_id=activity_id,
            openid=user["openid"],
            name=data.get("name", ""),
            phone=data.get("phone", ""),
            participant_count=int(data.get("participant_count", 1)),
            agree_disclaimer=1 if data.get("agree_disclaimer") else 0,
            city=data.get("city") or None,
            remark=data.get("remark") or None,
            emergency_name=data.get("emergency_name") or None,
            emergency_phone=data.get("emergency_phone") or None,
            status=0,
        )
        db.add(registration)
        
        # 更新当前报名人数
        activity.current_participants += registration.participant_count
        
        await db.commit()
        await db.refresh(registration)
        
        return success({"id": registration.id}, message="报名成功")
    except Exception as e:
        logger.error(f"Error registering activity: {e}")
        return {"code": 500, "message": f"报名失败: {str(e)}", "data": None}


@app.get("/api/v1/charities/activities/{activity_id}/register/status")
async def get_register_status(
    activity_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的报名状态"""
    try:
        from app.models.charity import CharityRegistration
        
        result = await db.execute(
            select(CharityRegistration).where(
                CharityRegistration.activity_id == activity_id,
                CharityRegistration.openid == user["openid"]
            )
        )
        reg = result.scalar_one_or_none()
        
        if not reg:
            return success({"registered": False})
        
        return success({
            "registered": True,
            "status": reg.status,
            "status_name": REGISTRATION_STATUS_MAP.get(reg.status, "未知"),
        })
    except Exception as e:
        logger.error(f"Error getting register status: {e}")
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
        
        activities = [activity_to_dict(a) for a in items]
        
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
            require_city=data.get("require_city", 0),
            require_emergency=data.get("require_emergency", 0),
            disclaimer=data.get("disclaimer"),
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
            "require_city", "require_emergency", "disclaimer",
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


@app.get("/api/v1/admin/charities/activities/{activity_id}/registrations")
async def admin_get_registrations(
    activity_id: int,
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取某活动的报名列表"""
    try:
        from app.models.charity import CharityRegistration
        
        query = select(CharityRegistration).where(CharityRegistration.activity_id == activity_id)
        
        if status is not None:
            query = query.where(CharityRegistration.status == status)
        if keyword:
            query = query.where(
                CharityRegistration.name.contains(keyword) |
                CharityRegistration.phone.contains(keyword)
            )
        
        query = query.order_by(CharityRegistration.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        
        registrations = []
        for r in items:
            registrations.append({
                "id": r.id,
                "activity_id": r.activity_id,
                "openid": r.openid,
                "name": r.name,
                "phone": r.phone,
                "participant_count": r.participant_count,
                "agree_disclaimer": r.agree_disclaimer,
                "city": r.city,
                "remark": r.remark,
                "emergency_name": r.emergency_name,
                "emergency_phone": r.emergency_phone,
                "status": r.status,
                "status_name": REGISTRATION_STATUS_MAP.get(r.status, "未知"),
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "registrations": registrations})
    except Exception as e:
        logger.error(f"Error getting registrations: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/charities/activities/{activity_id}/registrations/{registration_id}/status")
async def admin_update_registration_status(
    activity_id: int,
    registration_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新报名状态"""
    try:
        from app.models.charity import CharityRegistration, CharityActivity
        
        result = await db.execute(
            select(CharityRegistration).where(
                CharityRegistration.id == registration_id,
                CharityRegistration.activity_id == activity_id
            )
        )
        reg = result.scalar_one_or_none()
        
        if not reg:
            return {"code": 404, "message": "报名记录不存在", "data": None}
        
        new_status = data.get("status")
        if new_status not in [0, 1, 2, 3]:
            return {"code": 400, "message": "无效的状态值", "data": None}
        
        old_status = reg.status
        reg.status = new_status
        
        # 如果状态从已通过/已签到变为已拒绝，需要减少当前报名人数
        activity_result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        activity = activity_result.scalar_one_or_none()
        
        if activity:
            if old_status in [0, 1, 3] and new_status == 2:
                activity.current_participants = max(0, activity.current_participants - reg.participant_count)
            elif old_status == 2 and new_status in [0, 1, 3]:
                activity.current_participants += reg.participant_count
        
        await db.commit()
        return success(None, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating registration status: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/charities/activities/{activity_id}/registrations/export")
async def admin_export_registrations(
    activity_id: int,
    status: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """管理后台导出报名列表为Excel"""
    try:
        from app.models.charity import CharityRegistration, CharityActivity
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side
        from starlette.responses import StreamingResponse
        
        # 获取活动名称
        act_result = await db.execute(select(CharityActivity).where(CharityActivity.id == activity_id))
        activity = act_result.scalar_one_or_none()
        activity_title = activity.title if activity else "未知活动"
        
        query = select(CharityRegistration).where(CharityRegistration.activity_id == activity_id)
        if status is not None:
            query = query.where(CharityRegistration.status == status)
        query = query.order_by(CharityRegistration.created_at.desc())
        
        result = await db.execute(query)
        items = result.scalars().all()
        
        wb = Workbook()
        ws = wb.active
        ws.title = "报名名单"
        
        # 表头
        headers = ["活动名称", "报名时间", "姓名", "电话", "参与人数", "所在城市", "备注", "紧急联系人", "紧急联系电话", "状态"]
        ws.append(headers)
        
        # 样式
        header_font = Font(bold=True)
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        for cell in ws[1]:
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border
        
        for r in items:
            ws.append([
                activity_title,
                r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
                r.name or "",
                r.phone or "",
                r.participant_count or 1,
                r.city or "",
                r.remark or "",
                r.emergency_name or "",
                r.emergency_phone or "",
                REGISTRATION_STATUS_MAP.get(r.status, "未知"),
            ])
        
        # 设置列宽
        column_widths = [30, 20, 15, 15, 10, 15, 30, 15, 15, 10]
        for i, width in enumerate(column_widths, 1):
            ws.column_dimensions[chr(64 + i) if i <= 26 else 'A' + chr(64 + i - 26)].width = width
        
        # 保存到内存
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"{activity_title}_报名名单.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error exporting registrations: {e}")
        return {"code": 500, "message": f"导出失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
