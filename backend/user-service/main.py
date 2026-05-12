"""
用户服务 - User Service
端口: 8001
职责: 用户注册/登录/档案/会员
"""
import sys
from pathlib import Path

# 添加common模块到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from common.config import settings
from common.database import init_db, close_db, get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware, ExceptionMiddleware
from common.exceptions import APIException, api_exception_handler, general_exception_handler
from common.logger import setup_logger
from common.dependencies import get_current_user, get_optional_user
from common.response import success

from app.routers import user, pet, auth, traveler

# 设置服务特定配置
settings.app_name = "user-service"
settings.app_port = 8001

logger = setup_logger("user-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info(f"Starting {settings.app_name}...")
    await redis_client.connect()
    logger.info("Redis connected")
    
    yield
    
    # 关闭时
    logger.info(f"Shutting down {settings.app_name}...")
    await redis_client.close()
    await close_db()
    logger.info("Cleanup completed")


# 创建FastAPI应用
app = FastAPI(
    title="用户服务",
    description="犬兜行 - 用户注册/登录/档案/会员服务",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置CORS
setup_cors(app)

# 添加中间件
app.add_middleware(RequestLogMiddleware)
app.add_middleware(ExceptionMiddleware)

# 注册异常处理器
app.add_exception_handler(APIException, api_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(user.router, prefix="/api/v1/user", tags=["用户"])
app.include_router(pet.router, prefix="/api/v1/pets", tags=["宠物档案"])
app.include_router(traveler.router, prefix="/api/v1/travelers", tags=["出行人管理"])


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "service": settings.app_name}


# ==================== 管理后台 API ====================

@app.get("/api/v1/admin/users")
async def admin_get_users(
    keyword: Optional[str] = None,
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取用户列表"""
    try:
        from app.models.user import User
        from sqlalchemy import or_
        
        query = select(User)
        
        # 搜索条件
        if keyword:
            query = query.where(
                or_(
                    User.nickname.contains(keyword),
                    User.phone.contains(keyword),
                    User.openid.contains(keyword)
                )
            )
        
        # 状态筛选
        if status is not None:
            query = query.where(User.status == status)
        
        # 按创建时间倒序
        query = query.order_by(User.created_at.desc())
        
        # 总数
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        # 分页
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        users_db = result.scalars().all()
        
        # 批量查询宠物数量
        user_ids = [u.id for u in users_db]
        from app.models.pet import PetProfile
        pet_count_result = await db.execute(
            select(PetProfile.user_id, func.count(PetProfile.id))
            .where(PetProfile.user_id.in_(user_ids), PetProfile.status == 1)
            .group_by(PetProfile.user_id)
        )
        pet_count_map = {uid: c for uid, c in pet_count_result.all()}
        
        users = []
        for u in users_db:
            users.append({
                "id": u.id,
                "openid": u.openid,
                "nickname": u.nickname or '未设置昵称',
                "avatar": u.avatar,
                "phone": u.phone or '-',
                "real_name": u.real_name or '-',
                "id_card": u.id_card or '-',
                "gender": u.gender,
                "birthday": u.birthday.isoformat() if u.birthday else None,
                "member_level": u.member_level,
                "member_points": u.member_points,
                "status": u.status,
                "pet_count": pet_count_map.get(u.id, 0),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            })
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "users": users
            }
        }
    except Exception as e:
        logger.error(f"Error getting admin users: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/users/{user_id}")
async def admin_get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取用户详情"""
    try:
        from app.models.user import User
        
        result = await db.execute(select(User).where(User.id == user_id))
        u = result.scalar_one_or_none()
        
        if not u:
            return {"code": 404, "message": "用户不存在", "data": None}
        
        user = {
            "id": u.id,
            "openid": u.openid,
            "nickname": u.nickname,
            "avatar": u.avatar,
            "phone": u.phone,
            "real_name": u.real_name,
            "id_card": u.id_card,
            "gender": u.gender,
            "birthday": u.birthday.isoformat() if u.birthday else None,
            "city": u.city,
            "member_level": u.member_level,
            "member_points": u.member_points,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        }
        
        return {"code": 200, "message": "success", "data": user}
    except Exception as e:
        logger.error(f"Error getting user detail: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    user_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新用户信息"""
    try:
        from app.models.user import User
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return {"code": 404, "message": "用户不存在", "data": None}
        
        # 可更新的字段
        allowed_fields = ['nickname', 'phone', 'real_name', 'id_card', 'gender', 'birthday', 'city', 
                          'member_level', 'member_points', 'status', 'avatar']
        
        for field in allowed_fields:
            if field in user_data:
                setattr(user, field, user_data[field])
        
        await db.commit()
        await db.refresh(user)
        
        return {
            "code": 200,
            "message": "更新成功",
            "data": {
                "id": user.id,
                "nickname": user.nickname,
                "phone": user.phone,
                "member_level": user.member_level,
                "status": user.status,
            }
        }
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除用户（软删除）"""
    try:
        from app.models.user import User
        from app.models.pet import PetProfile
        
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return {"code": 404, "message": "用户不存在", "data": None}
        
        # 校验名下是否有活跃宠物
        pet_count_result = await db.execute(
            select(func.count()).select_from(
                select(PetProfile).where(PetProfile.user_id == user_id, PetProfile.status == 1).subquery()
            )
        )
        pet_count = pet_count_result.scalar()
        if pet_count > 0:
            return {"code": 400, "message": f"该用户名下还有 {pet_count} 只宠物，请先处理宠物后再删除用户", "data": None}
        
        # 软删除：将状态设为 0
        user.status = 0
        await db.commit()
        
        return {"code": 200, "message": "删除成功", "data": None}
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/pets")
async def admin_get_pets(
    user_id: Optional[int] = None,
    keyword: Optional[str] = None,
    user_keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取宠物列表"""
    try:
        from app.models.pet import PetProfile
        from app.models.user import User
        from sqlalchemy import or_
        
        query = select(PetProfile, User).join(User, PetProfile.user_id == User.id).where(PetProfile.status == 1)
        
        if user_id:
            query = query.where(PetProfile.user_id == user_id)
        if keyword:
            query = query.where(or_(
                PetProfile.name.contains(keyword),
                PetProfile.breed.contains(keyword)
            ))
        if user_keyword:
            query = query.where(or_(
                User.nickname.contains(user_keyword),
                User.phone.contains(user_keyword)
            ))
        
        query = query.order_by(PetProfile.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        rows = result.all()
        
        pets = []
        for p, u in rows:
            pets.append({
                "id": p.id,
                "user_id": p.user_id,
                "user_nickname": u.nickname or '-',
                "user_phone": u.phone or '-',
                "user_avatar": u.avatar,
                "name": p.name,
                "breed": p.breed,
                "breed_type": p.breed_type,
                "birth_date": p.birth_date.isoformat() if p.birth_date else None,
                "gender": p.gender,
                "weight": float(p.weight) if p.weight else None,
                "avatar": p.avatar,
                "tags": p.tags or [],
                "health_notes": p.health_notes,
                "vaccine_date": p.vaccine_date.isoformat() if p.vaccine_date else None,
                "is_default": p.is_default,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "pets": pets
            }
        }
    except Exception as e:
        logger.error(f"Error getting pets: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/pets/{pet_id}")
async def admin_get_pet_detail(
    pet_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取宠物详情"""
    try:
        from app.models.pet import PetProfile
        from app.models.user import User
        
        result = await db.execute(
            select(PetProfile, User).join(User, PetProfile.user_id == User.id).where(PetProfile.id == pet_id)
        )
        row = result.one_or_none()
        
        if not row:
            return {"code": 404, "message": "宠物不存在", "data": None}
        
        p, u = row
        return {
            "code": 200,
            "message": "success",
            "data": {
                "id": p.id,
                "user_id": p.user_id,
                "user_nickname": u.nickname or '-',
                "user_phone": u.phone or '-',
                "user_avatar": u.avatar,
                "name": p.name,
                "breed": p.breed,
                "breed_type": p.breed_type,
                "birth_date": p.birth_date.isoformat() if p.birth_date else None,
                "gender": p.gender,
                "weight": float(p.weight) if p.weight else None,
                "avatar": p.avatar,
                "tags": p.tags or [],
                "health_notes": p.health_notes,
                "vaccine_date": p.vaccine_date.isoformat() if p.vaccine_date else None,
                "is_default": p.is_default,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        }
    except Exception as e:
        logger.error(f"Error getting pet detail: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/pets/{pet_id}")
async def admin_update_pet(
    pet_id: int,
    pet_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新宠物信息"""
    try:
        from app.models.pet import PetProfile
        
        result = await db.execute(select(PetProfile).where(PetProfile.id == pet_id))
        pet = result.scalar_one_or_none()
        
        if not pet:
            return {"code": 404, "message": "宠物不存在", "data": None}
        
        allowed_fields = ['name', 'breed', 'breed_type', 'birth_date', 'gender', 'weight', 'avatar', 'tags', 'health_notes', 'vaccine_date', 'is_default']
        
        for field in allowed_fields:
            if field in pet_data:
                value = pet_data[field]
                # 日期字段转换
                if field in ['birth_date', 'vaccine_date'] and value and isinstance(value, str):
                    from datetime import datetime
                    try:
                        value = datetime.strptime(value, '%Y-%m-%d').date()
                    except ValueError:
                        value = None
                setattr(pet, field, value)
        
        await db.commit()
        await db.refresh(pet)
        
        return {"code": 200, "message": "更新成功", "data": {"id": pet.id}}
    except Exception as e:
        logger.error(f"Error updating pet: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/pets/{pet_id}")
async def admin_delete_pet(
    pet_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除宠物（软删除）"""
    try:
        from app.models.pet import PetProfile
        
        result = await db.execute(select(PetProfile).where(PetProfile.id == pet_id))
        pet = result.scalar_one_or_none()
        
        if not pet:
            return {"code": 404, "message": "宠物不存在", "data": None}
        
        pet.status = 0
        await db.commit()
        
        return {"code": 200, "message": "删除成功", "data": None}
    except Exception as e:
        logger.error(f"Error deleting pet: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/travelers")
async def admin_get_travelers(
    user_id: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取出行人列表"""
    try:
        from app.models.traveler import Traveler
        from sqlalchemy import or_
        
        query = select(Traveler).where(Traveler.status == 1)
        
        if user_id:
            query = query.where(Traveler.user_id == user_id)
        if keyword:
            query = query.where(or_(
                Traveler.name.contains(keyword),
                Traveler.phone.contains(keyword)
            ))
        
        query = query.order_by(Traveler.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        travelers_db = result.scalars().all()
        
        travelers = []
        for t in travelers_db:
            travelers.append({
                "id": t.id,
                "user_id": t.user_id,
                "name": t.name,
                "phone": t.phone,
                "id_card": t.id_card,
                "gender": t.gender,
                "birthday": t.birthday.isoformat() if t.birthday else None,
                "emergency_name": t.emergency_name,
                "emergency_phone": t.emergency_phone,
                "remark": t.remark,
                "is_default": t.is_default,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            })
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "travelers": travelers
            }
        }
    except Exception as e:
        logger.error(f"Error getting travelers: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


# ==================== 系统设置 API ====================

@app.get("/api/v1/admin/settings")
async def admin_get_settings(
    group: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取系统设置"""
    try:
        from app.models.setting import SystemSetting
        
        query = select(SystemSetting)
        if group:
            query = query.where(SystemSetting.group == group)
        
        result = await db.execute(query.order_by(SystemSetting.key))
        settings_db = result.scalars().all()
        
        settings = {}
        for s in settings_db:
            settings[s.key] = {
                "value": s.value,
                "description": s.description,
                "group": s.group,
            }
        
        return {"code": 200, "message": "success", "data": settings}
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/settings")
async def admin_update_settings(
    settings_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """更新系统设置"""
    try:
        from app.models.setting import SystemSetting
        
        for key, value in settings_data.items():
            result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = result.scalar_one_or_none()
            
            if setting:
                setting.value = str(value)
            else:
                setting = SystemSetting(key=key, value=str(value))
                db.add(setting)
        
        await db.commit()
        return {"code": 200, "message": "设置已保存", "data": None}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return {"code": 500, "message": f"保存失败: {str(e)}", "data": None}


# ==================== 操作日志 API ====================

@app.get("/api/v1/admin/operation-logs")
async def admin_get_operation_logs(
    user_id: Optional[int] = None,
    module: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """获取操作日志"""
    try:
        from app.models.operation_log import OperationLog
        from sqlalchemy import and_
        
        query = select(OperationLog)
        
        if user_id:
            query = query.where(OperationLog.user_id == user_id)
        if module:
            query = query.where(OperationLog.module == module)
        if action:
            query = query.where(OperationLog.action == action)
        if start_date:
            query = query.where(OperationLog.created_at >= start_date)
        if end_date:
            query = query.where(OperationLog.created_at <= end_date)
        
        query = query.order_by(OperationLog.created_at.desc())
        
        # 分页
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        logs_db = result.scalars().all()
        
        logs = []
        for log in logs_db:
            logs.append({
                "id": log.id,
                "user_id": log.user_id,
                "username": log.username,
                "action": log.action,
                "module": log.module,
                "description": log.description,
                "request_path": log.request_path,
                "request_method": log.request_method,
                "response_code": log.response_code,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            })
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "logs": logs
            }
        }
    except Exception as e:
        logger.error(f"Error getting operation logs: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/operation-logs")
async def admin_create_operation_log(
    log_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """创建操作日志"""
    try:
        from app.models.operation_log import OperationLog
        
        log = OperationLog(
            user_id=log_data.get("user_id", 0),
            username=log_data.get("username"),
            action=log_data.get("action"),
            module=log_data.get("module"),
            description=log_data.get("description"),
            request_path=log_data.get("request_path"),
            request_method=log_data.get("request_method"),
            request_params=log_data.get("request_params"),
            response_code=log_data.get("response_code"),
            ip_address=log_data.get("ip_address"),
            user_agent=log_data.get("user_agent"),
        )
        db.add(log)
        await db.commit()
        
        return {"code": 200, "message": "日志已记录", "data": {"id": log.id}}
    except Exception as e:
        logger.error(f"Error creating operation log: {e}")
        return {"code": 500, "message": f"记录失败: {str(e)}", "data": None}


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.app_port,
        reload=settings.debug,
    )


# ==================== 会员中心模块 ====================

@app.get("/api/v1/member/center")
async def get_member_center(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取会员中心信息"""
    from app.models.member import MemberPlan, UserMembership
    
    user_id = current_user.get("user_id", 1) if current_user else None
    
    # 查询当前会员状态
    membership_result = await db.execute(
        select(UserMembership).where(
            UserMembership.user_id == user_id,
            UserMembership.status == 1
        )
    )
    membership = membership_result.scalar_one_or_none()
    
    # 查询套餐列表
    plan_result = await db.execute(
        select(MemberPlan).where(MemberPlan.status == 1).order_by(MemberPlan.sort_order.asc())
    )
    plans = plan_result.scalars().all()
    
    plan_list = []
    for p in plans:
        benefit_config = p.benefit_config or {}
        coupon_package = p.coupon_package or {}
        
        benefits = benefit_config.get("items", [])
        if not benefits:
            # 生成默认权益展示
            benefits = []
            if benefit_config.get("discount_rate"):
                rate = benefit_config["discount_rate"]
                benefits.append({"icon": "discount", "title": f"全场{int(rate*10)}折"})
            if coupon_package.get("total_value"):
                benefits.append({"icon": "coupon", "title": f"赠¥{coupon_package['total_value']}券包"})
        
        plan_list.append({
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "original_price": float(p.original_price),
            "sale_price": float(p.sale_price),
            "duration_days": p.duration_days,
            "tag": p.tag,
            "color": p.color,
            "is_recommend": p.is_recommend == 1,
            "benefits": benefits,
            "coupon_package": {
                "total_value": coupon_package.get("total_value", 0),
                "desc": coupon_package.get("desc", ""),
            }
        })
    
    member_info = None
    if membership:
        from datetime import date
        remaining_days = (membership.end_date - date.today()).days
        benefit_snapshot = membership.benefit_snapshot or {}
        if isinstance(benefit_snapshot, str):
            try:
                benefit_snapshot = json.loads(benefit_snapshot)
            except:
                benefit_snapshot = {}
        benefits = benefit_snapshot.get("items", [])
        
        member_info = {
            "plan_id": membership.plan_id,
            "start_date": membership.start_date.isoformat(),
            "end_date": membership.end_date.isoformat(),
            "remaining_days": max(0, remaining_days),
            "benefits": benefits,
        }
    
    return success({
        "is_member": membership is not None,
        "member_info": member_info,
        "plans": plan_list,
    })


@app.get("/api/v1/member/plans")
async def get_member_plans(
    db: AsyncSession = Depends(get_db)
):
    """获取会员套餐列表（公开）"""
    from app.models.member import MemberPlan
    
    result = await db.execute(
        select(MemberPlan).where(MemberPlan.status == 1).order_by(MemberPlan.sort_order.asc())
    )
    plans = result.scalars().all()
    
    data = []
    for p in plans:
        data.append({
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "original_price": float(p.original_price),
            "sale_price": float(p.sale_price),
            "duration_days": p.duration_days,
            "tag": p.tag,
            "color": p.color,
            "is_recommend": p.is_recommend == 1,
            "benefit_config": p.benefit_config,
            "coupon_package": p.coupon_package,
        })
    
    return success({"list": data})


@app.get("/api/v1/member/coupons")
async def get_member_coupons(
    status: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取会员消费券列表"""
    from sqlalchemy import text
    
    user_id = current_user.get("user_id", 1)
    
    sql = """
        SELECT id, name, type, value, min_amount, valid_end_time, status, source_type
        FROM user_coupons
        WHERE user_id = :user_id AND source_type IN (2, 3)
    """
    params = {"user_id": user_id}
    
    if status:
        sql += " AND status = :status"
        params["status"] = status
    
    sql += " ORDER BY created_at DESC"
    
    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    
    total_value = 0
    coupons = []
    for row in rows:
        if row["status"] == 1:
            total_value += float(row["value"])
        coupons.append({
            "id": row["id"],
            "name": row["name"],
            "type": row["type"],
            "value": float(row["value"]),
            "min_amount": float(row["min_amount"]),
            "valid_end_time": row["valid_end_time"].isoformat() if row["valid_end_time"] else None,
            "status": row["status"],
            "source_type": row["source_type"],
        })
    
    return success({
        "list": coupons,
        "total": len(coupons),
        "total_value": total_value,
    })


# ==================== 弹窗模块 ====================

@app.get("/api/v1/popups/member-activity")
async def get_member_popup(
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """获取会员活动弹窗配置"""
    from app.models.popup import PopupConfig, UserPopupLog
    from app.models.member import UserMembership
    from datetime import datetime, date
    
    user_id = current_user.get("user_id") if current_user else None
    now = datetime.now()
    
    # 查询启用的弹窗
    result = await db.execute(
        select(PopupConfig).where(
            PopupConfig.type == "member_activity",
            PopupConfig.status == 1,
        ).where(
            (PopupConfig.start_time.is_(None)) | (PopupConfig.start_time <= now)
        ).where(
            (PopupConfig.end_time.is_(None)) | (PopupConfig.end_time >= now)
        )
    )
    popup = result.scalars().first()
    
    if not popup:
        return success({"should_show": False})
    
    # 如果用户已是会员，不显示弹窗
    if user_id is not None:
        member_result = await db.execute(
            select(UserMembership).where(
                UserMembership.user_id == user_id,
                UserMembership.status == 1,
                UserMembership.end_date >= date.today()
            )
        )
        if member_result.scalar_one_or_none():
            return success({"should_show": False})
    
    # 检查是否已交互过（首次进入策略：点击主按钮、关闭或点击蒙层都算已交互）
    if popup.trigger_type == 1 and user_id is not None:
        log_result = await db.execute(
            select(UserPopupLog).where(
                UserPopupLog.user_id == user_id,
                UserPopupLog.popup_id == popup.id,
                UserPopupLog.action.in_([2, 3, 4])  # 点击主按钮、关闭或点击蒙层
            )
        )
        if log_result.scalar_one_or_none():
            return success({"should_show": False})
    
    content = popup.content or {}
    
    return success({
        "should_show": True,
        "popup": {
            "id": popup.id,
            "title": popup.title,
            "subtitle": popup.subtitle,
            "image": popup.image,
            "content": content,
            "primary_btn_text": popup.primary_btn_text,
            "primary_btn_color": popup.primary_btn_color,
            "close_btn_text": popup.close_btn_text,
            "trigger_type": popup.trigger_type,
            "target_plan_id": popup.target_plan_id,
            "target_page": popup.target_page,
        }
    })


@app.post("/api/v1/popups/{popup_id}/log")
async def log_popup_action(
    popup_id: int,
    data: dict,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """记录弹窗操作"""
    from app.models.popup import UserPopupLog
    
    user_id = current_user.get("user_id") if current_user else None
    action = data.get("action", 1)
    
    log = UserPopupLog(
        user_id=user_id,
        popup_id=popup_id,
        action=action,
    )
    db.add(log)
    await db.commit()
    
    return success(message="记录成功")


# ==================== 管理后台：会员套餐 ====================

@app.get("/api/v1/admin/member-plans")
async def admin_get_member_plans(
    status: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取会员套餐列表"""
    from app.models.member import MemberPlan
    
    query = select(MemberPlan).order_by(MemberPlan.sort_order.asc())
    if status is not None:
        query = query.where(MemberPlan.status == status)
    
    result = await db.execute(query)
    plans = result.scalars().all()
    
    data = []
    for p in plans:
        data.append({
            "id": p.id,
            "name": p.name,
            "subtitle": p.subtitle,
            "original_price": float(p.original_price),
            "sale_price": float(p.sale_price),
            "duration_days": p.duration_days,
            "tag": p.tag,
            "color": p.color,
            "is_recommend": p.is_recommend,
            "status": p.status,
            "sort_order": p.sort_order,
            "benefit_config": p.benefit_config,
            "coupon_package": p.coupon_package,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return success({"list": data})


@app.post("/api/v1/admin/member-plans")
async def admin_create_member_plan(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建会员套餐"""
    from app.models.member import MemberPlan
    
    plan = MemberPlan(
        name=data.get("name"),
        subtitle=data.get("subtitle"),
        original_price=data.get("original_price"),
        sale_price=data.get("sale_price"),
        duration_days=data.get("duration_days"),
        benefit_config=data.get("benefit_config", {}),
        coupon_package=data.get("coupon_package", {}),
        sort_order=data.get("sort_order", 0),
        tag=data.get("tag"),
        color=data.get("color", "#FF6B35"),
        is_recommend=data.get("is_recommend", 0),
        status=data.get("status", 1),
    )
    db.add(plan)
    await db.flush()
    await db.commit()
    
    return success({"id": plan.id}, message="创建成功")


@app.put("/api/v1/admin/member-plans/{plan_id}")
async def admin_update_member_plan(
    plan_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新会员套餐"""
    from app.models.member import MemberPlan
    
    result = await db.execute(select(MemberPlan).where(MemberPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        return {"code": 404, "message": "套餐不存在", "data": None}
    
    allowed_fields = [
        "name", "subtitle", "original_price", "sale_price", "duration_days",
        "benefit_config", "coupon_package", "sort_order", "tag", "color",
        "is_recommend", "status"
    ]
    
    for field in allowed_fields:
        if field in data:
            setattr(plan, field, data[field])
    
    await db.commit()
    return success({"id": plan.id}, message="更新成功")


@app.delete("/api/v1/admin/member-plans/{plan_id}")
async def admin_delete_member_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除会员套餐（软删除）"""
    from app.models.member import MemberPlan
    
    result = await db.execute(select(MemberPlan).where(MemberPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        return {"code": 404, "message": "套餐不存在", "data": None}
    
    plan.status = 0
    await db.commit()
    return success(message="已下架")


# ==================== 管理后台：弹窗配置 ====================

@app.get("/api/v1/admin/popups")
async def admin_get_popups(
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取弹窗配置列表"""
    from app.models.popup import PopupConfig
    
    query = select(PopupConfig).order_by(PopupConfig.created_at.desc())
    if type:
        query = query.where(PopupConfig.type == type)
    
    result = await db.execute(query)
    popups = result.scalars().all()
    
    data = []
    for p in popups:
        data.append({
            "id": p.id,
            "type": p.type,
            "title": p.title,
            "subtitle": p.subtitle,
            "image": p.image,
            "content": p.content,
            "primary_btn_text": p.primary_btn_text,
            "primary_btn_color": p.primary_btn_color,
            "close_btn_text": p.close_btn_text,
            "status": p.status,
            "trigger_type": p.trigger_type,
            "show_duration_seconds": p.show_duration_seconds,
            "target_plan_id": p.target_plan_id,
            "target_page": p.target_page,
            "start_time": p.start_time.isoformat() if p.start_time else None,
            "end_time": p.end_time.isoformat() if p.end_time else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return success({"list": data})


@app.post("/api/v1/admin/popups")
async def admin_create_popup(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建弹窗配置"""
    from app.models.popup import PopupConfig
    
    popup = PopupConfig(
        type=data.get("type", "member_activity"),
        title=data.get("title"),
        subtitle=data.get("subtitle"),
        image=data.get("image"),
        content=data.get("content"),
        primary_btn_text=data.get("primary_btn_text", "立即开通"),
        primary_btn_color=data.get("primary_btn_color", "#FF6B35"),
        close_btn_text=data.get("close_btn_text", "暂不开通"),
        trigger_type=data.get("trigger_type", 1),
        show_duration_seconds=data.get("show_duration_seconds", 0),
        target_plan_id=data.get("target_plan_id"),
        target_page=data.get("target_page"),
        status=data.get("status", 1),
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
    )
    db.add(popup)
    await db.flush()
    await db.commit()
    
    return success({"id": popup.id}, message="创建成功")


@app.put("/api/v1/admin/popups/{popup_id}")
async def admin_update_popup(
    popup_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新弹窗配置"""
    from app.models.popup import PopupConfig
    
    result = await db.execute(select(PopupConfig).where(PopupConfig.id == popup_id))
    popup = result.scalar_one_or_none()
    
    if not popup:
        return {"code": 404, "message": "弹窗不存在", "data": None}
    
    allowed_fields = [
        "type", "title", "subtitle", "image", "content", "primary_btn_text",
        "primary_btn_color", "close_btn_text", "trigger_type", "show_duration_seconds",
        "target_plan_id", "target_page", "status", "start_time", "end_time"
    ]
    
    for field in allowed_fields:
        if field in data:
            setattr(popup, field, data[field])
    
    await db.commit()
    return success({"id": popup.id}, message="更新成功")


@app.delete("/api/v1/admin/popups/{popup_id}")
async def admin_delete_popup(
    popup_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除弹窗配置"""
    from app.models.popup import PopupConfig
    
    result = await db.execute(select(PopupConfig).where(PopupConfig.id == popup_id))
    popup = result.scalar_one_or_none()
    
    if not popup:
        return {"code": 404, "message": "弹窗不存在", "data": None}
    
    popup.status = 0
    await db.commit()
    return success(message="已停用")


