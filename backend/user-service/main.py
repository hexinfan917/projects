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
                "gender": u.gender,
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
        allowed_fields = ['nickname', 'phone', 'gender', 'birthday', 'city', 
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
