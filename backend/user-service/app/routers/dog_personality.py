"""
犬格检测路由（V2.0 四维二元模型）
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func, delete
from common.database import get_db
from common.response import success
from common.dependencies import get_current_user, get_optional_user, require_admin

from app.schemas.dog_personality import (
    ResultCreate,
    SubmitResultResponse,
    ResultResponse,
    AdminResultFilter,
    ModuleCreate,
    ModuleUpdate,
    ModuleResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    LevelCreate,
    LevelUpdate,
    LevelResponse,
    PKRecordCreate,
    BehaviorTagCreate,
    BehaviorTagUpdate,
    BehaviorTagResponse,
    BehaviorRuleCreate,
    BehaviorRuleUpdate,
    BehaviorRuleResponse,
    BehaviorRuleWithTag
)
from app.models.dog_personality import (
    DogPersonalityModule,
    DogPersonalityQuestion,
    DogPersonalityLevel,
    DogPersonalityResult,
    DogPersonalityPKRecord,
    DogPersonalityBehaviorTag,
    DogPersonalityBehaviorRule
)
from app.services.dog_personality import DogPersonalityService

router = APIRouter()
admin_router = APIRouter(dependencies=[Depends(require_admin)])
service = DogPersonalityService()


@router.get("/questions")
async def get_questions(
    db: AsyncSession = Depends(get_db)
):
    """获取启用的题目列表（按模块分组）"""
    modules = await service.get_active_questions(db)
    return success({"modules": modules})


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db)
):
    """获取题目统计（用于小程序首页）"""
    stats = await service.get_question_stats(db)
    return success(stats)


@router.get("/levels")
async def get_levels(
    db: AsyncSession = Depends(get_db)
):
    """获取启用的分型配置（16 套犬格人设）"""
    levels = await service.get_levels(db)
    return success({"levels": levels})


@router.post("/results")
async def submit_result(
    data: ResultCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """提交测评"""
    result = await service.submit_result(current_user["user_id"], data, db)
    return success(result.model_dump(mode='json'))


@router.get("/results/recent/list")
async def get_recent_results(
    limit: int = Query(default=3, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取最近测评记录"""
    results = await service.get_recent_results(current_user["user_id"], limit, db)
    return success({"list": results})


@router.get("/results/list")
async def get_result_list(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户测评记录列表"""
    total, results = await service.get_result_list(
        current_user["user_id"], page, page_size, db
    )
    return success({"total": total, "list": results, "page": page, "page_size": page_size})


@router.get("/results/trend/data")
async def get_trend(
    pet_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取同一宠物的测评趋势"""
    trend = await service.get_trend(current_user["user_id"], pet_id, db)
    return success(trend)


@router.get("/results/{result_id}/public")
async def get_result_public(
    result_id: int,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """获取测评报告公开摘要（用于 PK 分享等场景）

    按 PRD 15.7 裁剪：不暴露用户 ID、详细解读全文，仅保留 PK 展示所需摘要。
    """
    from app.models.pet import PetProfile

    result = await db.execute(
        select(DogPersonalityResult, PetProfile, DogPersonalityLevel).join(
            PetProfile,
            DogPersonalityResult.pet_id == PetProfile.id,
            isouter=True
        ).join(
            DogPersonalityLevel,
            DogPersonalityResult.type_code == DogPersonalityLevel.code,
            isouter=True
        ).where(DogPersonalityResult.id == result_id)
    )
    row = result.first()
    if not row:
        return success(message="记录不存在", code=404)

    record, pet, level = row
    ds = record.dimension_scores or {}
    is_owner = bool(current_user) and current_user.get("user_id") == record.user_id
    return success({
        "id": record.id,
        "pet_id": record.pet_id,
        "pet_name": pet.name if pet else None,
        "pet_avatar": pet.avatar if pet else None,
        "type_code": record.type_code,
        "title": level.title if level else None,
        "dimension_scores": ds,
        "reliability_score": record.reliability_score,
        "is_owner": is_owner,
        "created_at": record.created_at.isoformat()
    })


@router.get("/results/{result_id}")
async def get_result(
    result_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """查看测评报告详情"""
    result = await service.get_result(result_id, current_user["user_id"], db)
    return success(result.model_dump(mode='json'))


@router.post("/pk/records")
async def create_pk_record(
    data: PKRecordCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """记录当前用户参与的一次 PK"""
    record = await service.create_or_update_pk_record(
        current_user["user_id"], data.a_result_id, data.b_result_id, db
    )
    return success(record.model_dump(mode='json'))


@router.get("/pk/records/list")
async def get_pk_record_list(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的 PK 记录列表"""
    total, results = await service.get_pk_record_list(
        current_user["user_id"], page, page_size, db
    )
    return success({"total": total, "list": results, "page": page, "page_size": page_size})


# ========== 管理后台接口 ==========

async def _get_module_order_map(db: AsyncSession) -> dict:
    """获取模块名称到排序/维度/描述的映射"""
    result = await db.execute(
        select(DogPersonalityModule).where(DogPersonalityModule.is_active == 1)
    )
    modules = result.scalars().all()
    return {
        m.name: {
            "module_order": m.module_order,
            "dimension": m.bind_dimension,
            "description": m.description,
        }
        for m in modules
    }


@admin_router.get("/modules")
async def admin_get_modules(
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取模块列表"""
    result = await db.execute(
        select(DogPersonalityModule).order_by(DogPersonalityModule.module_order)
    )
    modules = result.scalars().all()
    return success({
        "list": [{
            "id": m.id,
            "name": m.name,
            "module_order": m.module_order,
            "bind_dimension": m.bind_dimension,
            "description": m.description,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat(),
            "updated_at": m.updated_at.isoformat()
        } for m in modules]
    })


@admin_router.post("/modules")
async def admin_create_module(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建模块"""
    module = DogPersonalityModule(**data)
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return success({"id": module.id})


@admin_router.put("/modules/{module_id}")
async def admin_update_module(
    module_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新模块"""
    result = await db.execute(
        select(DogPersonalityModule).where(DogPersonalityModule.id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        return success(message="模块不存在", code=404)

    # 记录模块原名称：改名时仍按原 name 定位该模块下的题目
    original_name = module.name

    for key, value in data.items():
        setattr(module, key, value)

    await db.commit()
    await db.refresh(module)

    # 同步更新该模块下所有题目的 dimension 字段
    if "bind_dimension" in data:
        await db.execute(
            DogPersonalityQuestion.__table__.update().where(
                DogPersonalityQuestion.module_name == original_name
            ).values(dimension=data["bind_dimension"])
        )
        await db.commit()

    return success(message="更新成功")


@admin_router.delete("/modules/{module_id}")
async def admin_delete_module(
    module_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除模块"""
    result = await db.execute(
        select(DogPersonalityModule).where(DogPersonalityModule.id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        return success(message="模块不存在", code=404)

    # 删除前检查：模块下仍存在题目时禁止删除，避免产生孤儿题目
    question_count_result = await db.execute(
        select(func.count()).select_from(DogPersonalityQuestion).where(
            DogPersonalityQuestion.module_name == module.name
        )
    )
    question_count = question_count_result.scalar() or 0
    if question_count > 0:
        return success(
            message=f"该模块下还有 {question_count} 道题目，请先删除或迁移题目后再删除模块",
            code=400
        )

    await db.delete(module)
    await db.commit()
    return success(message="删除成功")


@admin_router.get("/questions")
async def admin_get_questions(
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取全部题目"""
    result = await db.execute(
        select(DogPersonalityQuestion).order_by(
            DogPersonalityQuestion.module_order,
            DogPersonalityQuestion.question_order
        )
    )
    questions = result.scalars().all()
    return success({
        "list": [{
            "id": q.id,
            "module_name": q.module_name,
            "module_order": q.module_order,
            "dimension": q.dimension,
            "question_order": q.question_order,
            "title": q.title,
            "image_url": q.image_url,
            "video_url": q.video_url,
            "options": q.options,
            "max_score": q.max_score,
            "is_active": q.is_active,
            "created_at": q.created_at.isoformat(),
            "updated_at": q.updated_at.isoformat()
        } for q in questions]
    })


@admin_router.post("/questions")
async def admin_create_question(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建题目"""
    order_map = await _get_module_order_map(db)
    if data.get("module_name"):
        info = order_map.get(data["module_name"], {})
        if not data.get("module_order"):
            data["module_order"] = info.get("module_order", 1)
        data["dimension"] = info.get("dimension")

    question = DogPersonalityQuestion(**data)
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return success({"id": question.id})


@admin_router.put("/questions/{question_id}")
async def admin_update_question(
    question_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新题目"""
    result = await db.execute(
        select(DogPersonalityQuestion).where(DogPersonalityQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        return success(message="题目不存在", code=404)

    # 如果修改了模块名称，自动同步模块排序与维度
    if "module_name" in data:
        order_map = await _get_module_order_map(db)
        info = order_map.get(data["module_name"], {})
        if "module_order" not in data:
            data["module_order"] = info.get("module_order", question.module_order)
        data["dimension"] = info.get("dimension")

    for key, value in data.items():
        setattr(question, key, value)

    await db.commit()
    await db.refresh(question)
    return success(message="更新成功")


@admin_router.delete("/questions/{question_id}")
async def admin_delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除题目"""
    result = await db.execute(
        select(DogPersonalityQuestion).where(DogPersonalityQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        return success(message="题目不存在", code=404)

    await db.delete(question)
    await db.commit()
    return success(message="删除成功")


@admin_router.put("/questions/{question_id}/sort")
async def admin_sort_question(
    question_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台调整题目排序"""
    result = await db.execute(
        select(DogPersonalityQuestion).where(DogPersonalityQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        return success(message="题目不存在", code=404)

    if "module_order" in data:
        question.module_order = data["module_order"]
    if "question_order" in data:
        question.question_order = data["question_order"]

    await db.commit()
    await db.refresh(question)
    return success(message="排序更新成功")


@admin_router.get("/levels")
async def admin_get_levels(
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取分型配置"""
    result = await db.execute(
        select(DogPersonalityLevel).order_by(DogPersonalityLevel.code)
    )
    levels = result.scalars().all()
    return success({
        "list": [{
            "id": l.id,
            "code": l.code,
            "title": l.title,
            "description": l.description,
            "guide": l.guide,
            "recommendation": l.recommendation,
            "is_active": l.is_active,
            "created_at": l.created_at.isoformat(),
            "updated_at": l.updated_at.isoformat()
        } for l in levels]
    })


@admin_router.post("/levels")
async def admin_create_level(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台创建分型"""
    level = DogPersonalityLevel(**data)
    db.add(level)
    await db.commit()
    await db.refresh(level)
    return success({"id": level.id})


@admin_router.put("/levels/{level_id}")
async def admin_update_level(
    level_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """管理后台更新分型"""
    result = await db.execute(
        select(DogPersonalityLevel).where(DogPersonalityLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        return success(message="分型不存在", code=404)

    # PRD 11.2：犬格编码创建后不可修改，忽略请求中的 code 字段
    data.pop("code", None)

    for key, value in data.items():
        setattr(level, key, value)

    await db.commit()
    await db.refresh(level)
    return success(message="更新成功")


@admin_router.delete("/levels/{level_id}")
async def admin_delete_level(
    level_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台删除分型"""
    result = await db.execute(
        select(DogPersonalityLevel).where(DogPersonalityLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        return success(message="分型不存在", code=404)

    await db.delete(level)
    await db.commit()
    return success(message="删除成功")


@admin_router.get("/results")
async def admin_get_results(
    user_id: Optional[int] = Query(None),
    pet_id: Optional[int] = Query(None),
    type_code: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取测评记录列表"""
    query = select(DogPersonalityResult)
    conditions = []

    if user_id:
        conditions.append(DogPersonalityResult.user_id == user_id)
    if pet_id:
        conditions.append(DogPersonalityResult.pet_id == pet_id)
    if type_code:
        conditions.append(DogPersonalityResult.type_code == type_code)
    if start_time:
        conditions.append(DogPersonalityResult.created_at >= start_time)
    if end_time:
        conditions.append(DogPersonalityResult.created_at <= end_time)

    if conditions:
        query = query.where(and_(*conditions))

    # 总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()

    # 分页
    result = await db.execute(
        query.order_by(desc(DogPersonalityResult.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    records = result.scalars().all()

    return success({
        "total": total,
        "page": page,
        "page_size": page_size,
        "list": [{
            "id": r.id,
            "user_id": r.user_id,
            "pet_id": r.pet_id,
            "type_code": r.type_code,
            "dimension_scores": r.dimension_scores,
            "reliability_score": r.reliability_score,
            "created_at": r.created_at.isoformat()
        } for r in records]
    })


@admin_router.get("/results/{result_id}")
async def admin_get_result_detail(
    result_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取测评报告详情"""
    from app.models.pet import PetProfile

    result = await db.execute(
        select(DogPersonalityResult, PetProfile, DogPersonalityLevel).join(
            PetProfile,
            DogPersonalityResult.pet_id == PetProfile.id,
            isouter=True
        ).join(
            DogPersonalityLevel,
            DogPersonalityResult.type_code == DogPersonalityLevel.code,
            isouter=True
        ).where(DogPersonalityResult.id == result_id)
    )
    row = result.first()
    if not row:
        return success(message="记录不存在", code=404)

    record, pet, level = row
    return success({
        "id": record.id,
        "user_id": record.user_id,
        "pet_id": record.pet_id,
        "pet_name": pet.name if pet else None,
        "type_code": record.type_code,
        "title": level.title if level else None,
        "dimension_scores": record.dimension_scores,
        "reliability_score": record.reliability_score,
        "report_data": record.report_data,
        "answers": record.answers,
        "created_at": record.created_at.isoformat()
    })


# ============== 行为画像配置管理 ==============

def _tag_to_dict(tag: DogPersonalityBehaviorTag) -> dict:
    return {
        "id": tag.id,
        "tag_key": tag.tag_key,
        "tag_text": tag.tag_text,
        "category": tag.category,
        "threshold": tag.threshold,
        "priority": tag.priority,
        "is_active": tag.is_active,
        "created_at": tag.created_at.isoformat() if tag.created_at else None,
        "updated_at": tag.updated_at.isoformat() if tag.updated_at else None,
    }


@admin_router.get("/behavior-tags")
async def admin_list_behavior_tags(
    db: AsyncSession = Depends(get_db)
):
    """管理后台：获取行为标签列表"""
    result = await db.execute(
        select(DogPersonalityBehaviorTag).order_by(
            DogPersonalityBehaviorTag.category,
            desc(DogPersonalityBehaviorTag.priority),
            DogPersonalityBehaviorTag.id
        )
    )
    tags = result.scalars().all()
    return success({"list": [_tag_to_dict(t) for t in tags]})


@admin_router.post("/behavior-tags")
async def admin_create_behavior_tag(
    data: BehaviorTagCreate,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：创建行为标签"""
    existing = await db.execute(
        select(DogPersonalityBehaviorTag).where(DogPersonalityBehaviorTag.tag_key == data.tag_key)
    )
    if existing.scalar_one_or_none():
        return success(message="标签标识已存在", code=400)

    tag = DogPersonalityBehaviorTag(**data.model_dump())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return success(_tag_to_dict(tag))


@admin_router.put("/behavior-tags/{tag_id}")
async def admin_update_behavior_tag(
    tag_id: int,
    data: BehaviorTagUpdate,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：更新行为标签"""
    result = await db.execute(
        select(DogPersonalityBehaviorTag).where(DogPersonalityBehaviorTag.id == tag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        return success(message="标签不存在", code=404)

    update_data = data.model_dump(exclude_unset=True)
    if "tag_key" in update_data and update_data["tag_key"] != tag.tag_key:
        existing = await db.execute(
            select(DogPersonalityBehaviorTag).where(
                DogPersonalityBehaviorTag.tag_key == update_data["tag_key"]
            )
        )
        if existing.scalar_one_or_none():
            return success(message="标签标识已存在", code=400)

    for k, v in update_data.items():
        setattr(tag, k, v)
    await db.commit()
    await db.refresh(tag)
    return success(_tag_to_dict(tag))


@admin_router.delete("/behavior-tags/{tag_id}")
async def admin_delete_behavior_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：删除行为标签（同时清理关联规则）"""
    result = await db.execute(
        select(DogPersonalityBehaviorTag).where(DogPersonalityBehaviorTag.id == tag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        return success(message="标签不存在", code=404)

    await db.execute(
        delete(DogPersonalityBehaviorRule).where(
            DogPersonalityBehaviorRule.tag_key == tag.tag_key
        )
    )
    await db.delete(tag)
    await db.commit()
    return success(message="删除成功")


def _rule_to_dict(rule: DogPersonalityBehaviorRule, tag_text: str = "", category: str = "") -> dict:
    return {
        "id": rule.id,
        "tag_key": rule.tag_key,
        "question_id": rule.question_id,
        "option_order": rule.option_order,
        "weight": rule.weight,
        "is_active": rule.is_active,
        "tag_text": tag_text,
        "category": category,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


@admin_router.get("/behavior-rules")
async def admin_list_behavior_rules(
    tag_key: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """管理后台：获取行为规则列表（带标签文案）"""
    query = (
        select(
            DogPersonalityBehaviorRule,
            DogPersonalityBehaviorTag.tag_text,
            DogPersonalityBehaviorTag.category
        )
        .join(
            DogPersonalityBehaviorTag,
            DogPersonalityBehaviorRule.tag_key == DogPersonalityBehaviorTag.tag_key,
            isouter=True
        )
    )
    if tag_key:
        query = query.where(DogPersonalityBehaviorRule.tag_key == tag_key)

    query = query.order_by(DogPersonalityBehaviorRule.id)
    result = await db.execute(query)
    rows = result.all()

    data = [_rule_to_dict(rule, tag_text or "", category or "") for rule, tag_text, category in rows]
    return success({"list": data})


@admin_router.post("/behavior-rules")
async def admin_create_behavior_rule(
    data: BehaviorRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：创建行为规则"""
    tag = await db.execute(
        select(DogPersonalityBehaviorTag).where(
            DogPersonalityBehaviorTag.tag_key == data.tag_key
        )
    )
    tag_obj = tag.scalar_one_or_none()
    if not tag_obj:
        return success(message="标签标识不存在", code=400)

    rule = DogPersonalityBehaviorRule(**data.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return success(_rule_to_dict(rule, tag_obj.tag_text, tag_obj.category))


@admin_router.put("/behavior-rules/{rule_id}")
async def admin_update_behavior_rule(
    rule_id: int,
    data: BehaviorRuleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：更新行为规则"""
    result = await db.execute(
        select(DogPersonalityBehaviorRule).where(DogPersonalityBehaviorRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        return success(message="规则不存在", code=404)

    update_data = data.model_dump(exclude_unset=True)
    if "tag_key" in update_data:
        tag = await db.execute(
            select(DogPersonalityBehaviorTag).where(
                DogPersonalityBehaviorTag.tag_key == update_data["tag_key"]
            )
        )
        if not tag.scalar_one_or_none():
            return success(message="标签标识不存在", code=400)

    for k, v in update_data.items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)

    tag = await db.execute(
        select(DogPersonalityBehaviorTag.tag_text, DogPersonalityBehaviorTag.category).where(
            DogPersonalityBehaviorTag.tag_key == rule.tag_key
        )
    )
    tag_row = tag.first()
    tag_text, category = tag_row if tag_row else ("", "")
    return success(_rule_to_dict(rule, tag_text or "", category or ""))


@admin_router.delete("/behavior-rules/{rule_id}")
async def admin_delete_behavior_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """管理后台：删除行为规则"""
    result = await db.execute(
        select(DogPersonalityBehaviorRule).where(DogPersonalityBehaviorRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        return success(message="规则不存在", code=404)

    await db.delete(rule)
    await db.commit()
    return success(message="删除成功")


@admin_router.get("/pk/records")
async def admin_get_pk_records(
    user_id: Optional[int] = Query(None),
    a_result_id: Optional[int] = Query(None),
    b_result_id: Optional[int] = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """管理后台：获取 PK 记录列表"""
    from app.models.pet import PetProfile

    query = select(DogPersonalityPKRecord)
    conditions = [DogPersonalityPKRecord.status == 1]

    if user_id:
        conditions.append(DogPersonalityPKRecord.user_id == user_id)
    if a_result_id:
        conditions.append(DogPersonalityPKRecord.a_result_id == a_result_id)
    if b_result_id:
        conditions.append(DogPersonalityPKRecord.b_result_id == b_result_id)

    query = query.where(and_(*conditions))

    # 总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # 分页
    result = await db.execute(
        query.order_by(desc(DogPersonalityPKRecord.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    pk_records = result.scalars().all()

    if not pk_records:
        return success({
            "total": total,
            "page": page,
            "page_size": page_size,
            "list": []
        })

    # 批量获取结果与宠物信息
    result_ids = set()
    user_ids = set()
    for r in pk_records:
        result_ids.add(r.a_result_id)
        result_ids.add(r.b_result_id)
        user_ids.add(r.user_id)

    rows = await db.execute(
        select(DogPersonalityResult, PetProfile, DogPersonalityLevel)
        .join(
            PetProfile,
            DogPersonalityResult.pet_id == PetProfile.id,
            isouter=True
        )
        .join(
            DogPersonalityLevel,
            DogPersonalityResult.type_code == DogPersonalityLevel.code,
            isouter=True
        )
        .where(DogPersonalityResult.id.in_(result_ids))
    )
    result_map = {}
    for record, pet, level in rows.all():
        result_map[record.id] = {
            "pet_id": record.pet_id,
            "pet_name": pet.name if pet else None,
            "pet_avatar": pet.avatar if pet else None,
            "type_code": record.type_code,
            "title": level.title if level else None,
            "total_score": service._sum_dimension_scores(record.dimension_scores),
            "user_id": record.user_id,
        }

    data = []
    for r in pk_records:
        a_info = result_map.get(r.a_result_id, {})
        b_info = result_map.get(r.b_result_id, {})
        if r.winner_result_id == r.a_result_id:
            winner_side = "a"
        elif r.winner_result_id == r.b_result_id:
            winner_side = "b"
        else:
            winner_side = "tie"

        data.append({
            "id": r.id,
            "user_id": r.user_id,
            "a_result_id": r.a_result_id,
            "b_result_id": r.b_result_id,
            "a_user_id": a_info.get("user_id"),
            "a_pet_id": a_info.get("pet_id"),
            "a_pet_name": a_info.get("pet_name"),
            "a_pet_avatar": a_info.get("pet_avatar"),
            "a_type_code": a_info.get("type_code"),
            "a_title": a_info.get("title"),
            "a_total_score": r.a_total_score,
            "b_user_id": b_info.get("user_id"),
            "b_pet_id": b_info.get("pet_id"),
            "b_pet_name": b_info.get("pet_name"),
            "b_pet_avatar": b_info.get("pet_avatar"),
            "b_type_code": b_info.get("type_code"),
            "b_title": b_info.get("title"),
            "b_total_score": r.b_total_score,
            "winner_side": winner_side,
            "created_at": r.created_at.isoformat(),
        })

    return success({
        "total": total,
        "page": page,
        "page_size": page_size,
        "list": data
    })
