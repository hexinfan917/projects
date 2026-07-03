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
from common.database import get_db, close_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success
from common.dependencies import get_current_user, get_optional_user
from app.models.adoption import AdoptionDog, AdoptionApplication

settings.app_name = "charity-service"
settings.app_port = 8009
logger = setup_logger("charity-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    yield
    await redis_client.close()
    await close_db()


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


# ==================== 领养模块状态映射 ====================

ADOPTION_DOG_STATUS_MAP = {
    0: "未开放",
    1: "可申请",
    2: "已领养",
    3: "已下架",
}

ADOPTION_APPLICATION_STATUS_MAP = {
    0: "待审核",
    1: "已通过",
    2: "已拒绝",
    3: "已完成领养",
}


def dog_to_dict(dog, application_status: Optional[int] = None) -> dict:
    return {
        "id": dog.id,
        "name": dog.name,
        "breed": dog.breed,
        "gender": dog.gender,
        "age": dog.age,
        "weight": dog.weight,
        "location": dog.location,
        "cover_image": dog.cover_image,
        "images": dog.images or [],
        "story": dog.story,
        "adoption_requirements": dog.adoption_requirements,
        "health_tags": dog.health_tags or [],
        "status": dog.status,
        "status_name": ADOPTION_DOG_STATUS_MAP.get(dog.status, "未知"),
        "application_status": application_status,
        "created_at": dog.created_at.isoformat() if dog.created_at else None,
        "updated_at": dog.updated_at.isoformat() if dog.updated_at else None,
    }


def application_to_dict(app, dog=None) -> dict:
    data = {
        "id": app.id,
        "dog_id": app.dog_id,
        "openid": app.openid,
        "user_id": app.user_id,
        "name": app.name,
        "gender": app.gender,
        "age": app.age,
        "phone": app.phone,
        "wechat": app.wechat,
        "city": app.city,
        "address": app.address,
        "housing": app.housing,
        "experience": app.experience,
        "reason": app.reason,
        "status": app.status,
        "status_name": ADOPTION_APPLICATION_STATUS_MAP.get(app.status, "未知"),
        "admin_remark": app.admin_remark,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }
    if dog:
        data["dog"] = {
            "id": dog.id,
            "name": dog.name,
            "breed": dog.breed,
            "cover_image": dog.cover_image,
        }
    return data


# ==================== 小程序端领养 API ====================

@app.get("/api/v1/adoption/dogs")
async def get_adoption_dogs(
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """获取可领养狗狗列表"""
    try:
        query = select(AdoptionDog)

        if status is not None:
            query = query.where(AdoptionDog.status == status)
        else:
            query = query.where(AdoptionDog.status == 1)

        if keyword:
            query = query.where(
                AdoptionDog.name.contains(keyword) |
                AdoptionDog.breed.contains(keyword) |
                AdoptionDog.location.contains(keyword)
            )

        query = query.order_by(AdoptionDog.created_at.desc())

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()

        dogs = [dog_to_dict(d) for d in items]

        return success({"total": total, "page": page, "page_size": page_size, "dogs": dogs})
    except Exception as e:
        logger.error(f"Error getting adoption dogs: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/adoption/dogs/{dog_id}")
async def get_adoption_dog_detail(
    dog_id: int,
    user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """获取狗狗详情"""
    try:
        result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == dog_id))
        dog = result.scalar_one_or_none()

        if not dog:
            return {"code": 404, "message": "狗狗不存在", "data": None}

        application_status = None
        if user and user.get("openid"):
            app_result = await db.execute(
                select(AdoptionApplication).where(
                    AdoptionApplication.dog_id == dog_id,
                    AdoptionApplication.user_id == user["user_id"]
                ).order_by(AdoptionApplication.created_at.desc())
            )
            latest_app = app_result.scalar_one_or_none()
            if latest_app:
                application_status = {
                    "status": latest_app.status,
                    "status_name": ADOPTION_APPLICATION_STATUS_MAP.get(latest_app.status, "未知"),
                }

        return success(dog_to_dict(dog, application_status))
    except Exception as e:
        logger.error(f"Error getting adoption dog detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/adoption/dogs/{dog_id}/apply")
async def apply_adoption_dog(
    dog_id: int,
    data: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """提交领养申请"""
    try:
        result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == dog_id))
        dog = result.scalar_one_or_none()

        if not dog:
            return {"code": 404, "message": "狗狗不存在", "data": None}

        if dog.status != 1:
            return {"code": 400, "message": "该狗狗当前不可申请领养", "data": None}

        name = data.get("name", "").strip()
        phone = data.get("phone", "").strip()
        if not name or not phone:
            return {"code": 400, "message": "请填写姓名和联系电话", "data": None}

        # 检查是否已申请过
        existing_result = await db.execute(
            select(AdoptionApplication).where(
                AdoptionApplication.dog_id == dog_id,
                AdoptionApplication.user_id == user["user_id"]
            )
        )
        existing_app = existing_result.scalar_one_or_none()
        
        if existing_app:
            # 已拒绝的可以重新申请，更新原有记录
            if existing_app.status == 2:
                existing_app.name = name
                existing_app.gender = data.get("gender") or None
                existing_app.age = data.get("age") or None
                existing_app.phone = phone
                existing_app.wechat = data.get("wechat") or None
                existing_app.city = data.get("city") or None
                existing_app.address = data.get("address") or None
                existing_app.housing = data.get("housing") or None
                existing_app.experience = data.get("experience") or None
                existing_app.reason = data.get("reason") or None
                existing_app.status = 0  # 重置为待审核
                existing_app.user_id = user.get("user_id")  # 更新用户ID
                await db.commit()
                await db.refresh(existing_app)
                return success({"id": existing_app.id}, message="重新申请提交成功")
            else:
                return {"code": 400, "message": "您已申请过该狗狗，请勿重复申请", "data": None}

        application = AdoptionApplication(
            dog_id=dog_id,
            openid=user["openid"],
            user_id=user.get("user_id"),
            name=name,
            gender=data.get("gender") or None,
            age=data.get("age") or None,
            phone=phone,
            wechat=data.get("wechat") or None,
            city=data.get("city") or None,
            address=data.get("address") or None,
            housing=data.get("housing") or None,
            experience=data.get("experience") or None,
            reason=data.get("reason") or None,
            status=0,
        )
        db.add(application)
        await db.commit()
        await db.refresh(application)

        return success({"id": application.id}, message="申请提交成功")
    except Exception as e:
        logger.error(f"Error applying adoption dog: {e}")
        return {"code": 500, "message": f"申请失败: {str(e)}", "data": None}


@app.get("/api/v1/adoption/my-applications")
async def get_my_adoption_applications(
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取我的领养申请"""
    try:
        query = select(AdoptionApplication).where(AdoptionApplication.user_id == user["user_id"])

        if status is not None:
            query = query.where(AdoptionApplication.status == status)

        query = query.order_by(AdoptionApplication.created_at.desc())

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()

        applications = []
        for app in items:
            dog_result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == app.dog_id))
            dog = dog_result.scalar_one_or_none()
            applications.append(application_to_dict(app, dog))

        return success({"total": total, "page": page, "page_size": page_size, "applications": applications})
    except Exception as e:
        logger.error(f"Error getting my adoption applications: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 管理后台领养 API ====================

@app.get("/api/v1/admin/adoption/dogs")
async def admin_get_adoption_dogs(
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取狗狗档案列表"""
    try:
        query = select(AdoptionDog)

        if status is not None:
            query = query.where(AdoptionDog.status == status)
        if keyword:
            query = query.where(
                AdoptionDog.name.contains(keyword) |
                AdoptionDog.breed.contains(keyword) |
                AdoptionDog.location.contains(keyword)
            )

        query = query.order_by(AdoptionDog.created_at.desc())

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()

        dogs = [dog_to_dict(d) for d in items]

        return success({"total": total, "page": page, "page_size": page_size, "dogs": dogs})
    except Exception as e:
        logger.error(f"Error getting admin adoption dogs: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/adoption/dogs")
async def admin_create_adoption_dog(data: dict, db: AsyncSession = Depends(get_db)):
    """管理后台新增狗狗档案"""
    try:
        dog = AdoptionDog(
            name=data.get("name", "").strip(),
            breed=data.get("breed") or None,
            gender=data.get("gender") or None,
            age=data.get("age") or None,
            weight=data.get("weight") or None,
            location=data.get("location") or None,
            cover_image=data.get("cover_image") or None,
            images=data.get("images") or [],
            story=data.get("story") or None,
            adoption_requirements=data.get("adoption_requirements") or None,
            health_tags=data.get("health_tags") or [],
            status=data.get("status", 1),
        )
        db.add(dog)
        await db.commit()
        await db.refresh(dog)

        return success({"id": dog.id}, message="创建成功")
    except Exception as e:
        logger.error(f"Error creating adoption dog: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/adoption/dogs/{dog_id}")
async def admin_get_adoption_dog_detail(dog_id: int, db: AsyncSession = Depends(get_db)):
    """管理后台获取狗狗详情"""
    try:
        result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == dog_id))
        dog = result.scalar_one_or_none()

        if not dog:
            return {"code": 404, "message": "狗狗不存在", "data": None}

        return success(dog_to_dict(dog))
    except Exception as e:
        logger.error(f"Error getting admin adoption dog detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/adoption/dogs/{dog_id}")
async def admin_update_adoption_dog(dog_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """管理后台更新狗狗档案"""
    try:
        result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == dog_id))
        dog = result.scalar_one_or_none()

        if not dog:
            return {"code": 404, "message": "狗狗不存在", "data": None}

        fields = [
            "name", "breed", "gender", "age", "weight", "location",
            "cover_image", "images", "story", "adoption_requirements", "health_tags", "status"
        ]
        for field in fields:
            if field in data:
                setattr(dog, field, data[field])

        await db.commit()
        return success({"id": dog.id}, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating adoption dog: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/adoption/dogs/{dog_id}")
async def admin_delete_adoption_dog(dog_id: int, db: AsyncSession = Depends(get_db)):
    """管理后台删除狗狗档案"""
    try:
        result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == dog_id))
        dog = result.scalar_one_or_none()

        if not dog:
            return {"code": 404, "message": "狗狗不存在", "data": None}

        await db.delete(dog)
        await db.commit()

        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting adoption dog: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/adoption/applications")
async def admin_get_adoption_applications(
    dog_id: Optional[int] = None,
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取领养申请列表"""
    try:
        query = select(AdoptionApplication)

        if dog_id is not None:
            query = query.where(AdoptionApplication.dog_id == dog_id)
        if status is not None:
            query = query.where(AdoptionApplication.status == status)
        if keyword:
            query = query.where(
                AdoptionApplication.name.contains(keyword) |
                AdoptionApplication.phone.contains(keyword)
            )

        query = query.order_by(AdoptionApplication.created_at.desc())

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()

        applications = []
        for app in items:
            dog_result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == app.dog_id))
            dog = dog_result.scalar_one_or_none()
            applications.append(application_to_dict(app, dog))

        return success({"total": total, "page": page, "page_size": page_size, "applications": applications})
    except Exception as e:
        logger.error(f"Error getting admin adoption applications: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/adoption/applications/{application_id}")
async def admin_get_adoption_application_detail(application_id: int, db: AsyncSession = Depends(get_db)):
    """管理后台获取领养申请详情"""
    try:
        result = await db.execute(select(AdoptionApplication).where(AdoptionApplication.id == application_id))
        app = result.scalar_one_or_none()

        if not app:
            return {"code": 404, "message": "申请记录不存在", "data": None}

        dog_result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == app.dog_id))
        dog = dog_result.scalar_one_or_none()

        return success(application_to_dict(app, dog))
    except Exception as e:
        logger.error(f"Error getting admin adoption application detail: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/adoption/applications/{application_id}/status")
async def admin_update_adoption_application_status(
    application_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新领养申请状态"""
    try:
        result = await db.execute(select(AdoptionApplication).where(AdoptionApplication.id == application_id))
        app = result.scalar_one_or_none()

        if not app:
            return {"code": 404, "message": "申请记录不存在", "data": None}

        new_status = data.get("status")
        if new_status not in [0, 1, 2, 3]:
            return {"code": 400, "message": "无效的状态值", "data": None}

        # 状态流转校验
        current_status = app.status
        valid_transitions = {
            0: [1, 2, 3],      # 待审核 → 通过/拒绝/完成领养
            1: [2, 3],          # 已通过 → 拒绝/完成领养
            2: [],              # 已拒绝 → 不可操作
            3: [],              # 已完成 → 不可操作
        }
        if new_status not in valid_transitions.get(current_status, []):
            return {"code": 400, "message": "非法的状态流转", "data": None}

        app.status = new_status
        if "admin_remark" in data:
            app.admin_remark = data["admin_remark"]

        # 状态联动处理
        if new_status in [1, 3]:
            # 通过或完成领养：狗狗状态改为已领养
            dog_result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == app.dog_id))
            dog = dog_result.scalar_one_or_none()
            if dog:
                dog.status = 2
        elif new_status == 2:
            # 拒绝：检查该狗是否还有已通过/已完成领养的申请，没有则恢复为可申请
            # 待审核的申请不影响狗狗状态
            from sqlalchemy import and_
            other_result = await db.execute(
                select(AdoptionApplication).where(
                    and_(
                        AdoptionApplication.dog_id == app.dog_id,
                        AdoptionApplication.id != application_id,
                        AdoptionApplication.status.in_([1, 3])
                    )
                )
            )
            other_app = other_result.scalar_one_or_none()
            if not other_app:
                dog_result = await db.execute(select(AdoptionDog).where(AdoptionDog.id == app.dog_id))
                dog = dog_result.scalar_one_or_none()
                if dog:
                    dog.status = 1

        await db.commit()
        return success(None, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating adoption application status: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}
