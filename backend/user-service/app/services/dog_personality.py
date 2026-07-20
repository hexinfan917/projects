"""
犬格检测服务（V2.0 四维二元模型）
"""
import re
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from common.exceptions import NotFoundException, BadRequestException, ForbiddenException
from common.logger import setup_logger

from app.models.dog_personality import (
    DogPersonalityModule,
    DogPersonalityQuestion,
    DogPersonalityLevel,
    DogPersonalityResult,
    DogPersonalityPKRecord,
    DogPersonalityBehaviorTag,
    DogPersonalityBehaviorRule
)
from app.models.pet import PetProfile
from app.schemas.dog_personality import (
    ResultCreate,
    SubmitResultResponse,
    ResultResponse,
    DimensionScore,
    DimensionScores,
    ReportData,
    ModuleResponse,
    PKRecordResponse
)

logger = setup_logger("dog-personality-service")

# 四维维度定义（顺序用于展示）
DIMENSIONS = ["EI", "SN", "FT", "PJ"]

# 默认模块描述（兜底）
DEFAULT_MODULE_DESCRIPTIONS = {
    "陌生人耐受度": "评估狗狗在面对非熟悉个体时的社交反馈，用于判定 E 外向 / I 内向社交倾向",
    "同类狗狗社交耐受度": "评估狗狗在面对同类时的社交意愿、边界感，用于判定 E 外向 / I 内向社交倾向",
    "环境应激耐受度": "评估狗狗在面对陌生环境、声音、移动物体的胆量表现，用于判定 S 现实稳定 / N 敏感易应激感知模式",
    "资源占有护食行为": "评估狗狗对食物、玩具、窝垫等资源的安全感与占有欲，用于判定 S 现实稳定 / N 敏感易应激感知模式",
    "主人服从与自控能力": "评估狗狗对主人指令的响应速度、冲动克制力，用于判定 P 随性好动 / J 规律守序生活偏好",
    "分离情绪与居家行为": "评估狗狗居家独处的情绪、粘人依赖程度，用于判定 F 共情粘人 / T 独立理性情绪表达",
}


class DogPersonalityService:
    """犬格检测服务"""

    async def get_active_modules(self, db: AsyncSession) -> List[DogPersonalityModule]:
        """获取启用的模块配置"""
        result = await db.execute(
            select(DogPersonalityModule)
            .where(DogPersonalityModule.is_active == 1)
            .order_by(DogPersonalityModule.module_order)
        )
        return list(result.scalars().all())

    async def get_active_questions(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """获取按模块分组的启用题目"""
        modules_config = await self.get_active_modules(db)
        module_order_map = {m.name: m.module_order for m in modules_config}
        module_desc_map = {m.name: (m.description or DEFAULT_MODULE_DESCRIPTIONS.get(m.name, "")) for m in modules_config}
        module_dimension_map = {m.name: m.bind_dimension for m in modules_config}
        module_order_list = [m.name for m in modules_config]

        result = await db.execute(
            select(DogPersonalityQuestion)
            .where(DogPersonalityQuestion.is_active == 1)
            .order_by(DogPersonalityQuestion.module_order, DogPersonalityQuestion.question_order)
        )
        questions = result.scalars().all()

        # 按模块分组
        modules = {}
        for q in questions:
            if q.module_name not in modules:
                modules[q.module_name] = {
                    "module_name": q.module_name,
                    "module_order": module_order_map.get(q.module_name, q.module_order),
                    "module_dimension": module_dimension_map.get(q.module_name),
                    "module_description": module_desc_map.get(q.module_name, ""),
                    "questions": []
                }
            modules[q.module_name]["questions"].append({
                "id": q.id,
                "question_order": q.question_order,
                "dimension": q.dimension or module_dimension_map.get(q.module_name),
                "title": q.title,
                "image_url": q.image_url or "",
                "video_url": q.video_url or "",
                "options": q.options,
                "max_score": q.max_score
            })

        # 按模块顺序排序
        ordered_modules = []
        for module_name in module_order_list:
            if module_name in modules:
                ordered_modules.append(modules[module_name])

        # 数据库未配置但题目存在的模块放最后
        for module_name, module_data in modules.items():
            if module_name not in module_order_list:
                ordered_modules.append(module_data)

        return ordered_modules

    async def get_question_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """获取题目统计（用于小程序首页）"""
        modules = await self.get_active_modules(db)
        result = await db.execute(
            select(func.count(DogPersonalityQuestion.id))
            .where(DogPersonalityQuestion.is_active == 1)
        )
        question_count = result.scalar() or 0
        return {
            "question_count": question_count,
            "module_count": len(modules)
        }

    async def get_levels(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """获取启用的分型配置（V2.0 返回 16 套犬格人设）"""
        result = await db.execute(
            select(DogPersonalityLevel)
            .where(DogPersonalityLevel.is_active == 1)
            .order_by(DogPersonalityLevel.code)
        )
        levels = result.scalars().all()
        return [{
            "id": l.id,
            "code": l.code,
            "title": l.title,
            "description": l.description,
            "guide": l.guide,
            "recommendation": l.recommendation,
            "is_active": l.is_active
        } for l in levels]

    async def create_or_get_pet_from_temp(
        self,
        user_id: int,
        temp_pet_info: Dict[str, Any],
        db: AsyncSession
    ) -> PetProfile:
        """根据临时宠物信息创建档案；若用户已存在相同档案则复用，避免重复创建"""
        age_str = (temp_pet_info.get("age_str", "") or "").strip()
        name = (temp_pet_info.get("name", "") or "").strip()
        breed = (temp_pet_info.get("breed", "") or "").strip()
        gender = temp_pet_info.get("gender")

        # 先按关键信息查找是否已存在相同宠物档案
        result = await db.execute(
            select(PetProfile).where(
                and_(
                    PetProfile.user_id == user_id,
                    PetProfile.status == 1,
                    PetProfile.name == name,
                    PetProfile.breed == breed,
                    PetProfile.gender == gender,
                    PetProfile.age_str == age_str,
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.info(f"犬格检测复用已有宠物档案: id={existing.id}, user_id={user_id}")
            return existing

        birth_date = None
        # 纯数字年龄自动计算 birth_date
        if age_str and re.match(r'^\d+(\.\d+)?$', age_str):
            try:
                age_val = float(age_str)
                now = datetime.now()
                year = int(now.year - age_val)
                month = now.month
                day = now.day
                birth_date = date(year, month, day)
            except Exception as e:
                logger.error(f"根据 age_str 计算 birth_date 失败: {age_str}, 错误: {e}")

        avatar = temp_pet_info.get("avatar") or ""

        pet_data = {
            "name": name,
            "breed": breed,
            "birth_date": birth_date.isoformat() if birth_date else None,
            "age_str": age_str,
            "gender": gender,
            "weight": temp_pet_info.get("weight"),
            "avatar": avatar,
            "is_default": 0,
            "profile_status": "incomplete",
            "source": "personality_test"
        }

        pet = PetProfile(
            user_id=user_id,
            **pet_data
        )
        db.add(pet)
        await db.commit()
        await db.refresh(pet)
        logger.info(f"犬格检测自动创建宠物档案: id={pet.id}, user_id={user_id}")
        return pet

    def _calculate_dimension_scores(
        self,
        answers: List[Dict[str, Any]],
        question_map: Dict[int, DogPersonalityQuestion]
    ) -> Dict[str, DimensionScore]:
        """计算四维得分（双极计分模型）

        每个选项应通过 polarity 字段标记属于哪一极：
        '+' => 正极（E/S/F/P），'-' => 负极（I/N/T/J）。
        缺失 polarity 的旧数据按得分与中点关系回退处理。
        最终通过比较正/负极得分率判定该维度倾向。
        """
        dim_data: Dict[str, Dict[str, int]] = {
            "EI": {"positive_score": 0, "negative_score": 0, "positive_max": 0, "negative_max": 0},
            "SN": {"positive_score": 0, "negative_score": 0, "positive_max": 0, "negative_max": 0},
            "FT": {"positive_score": 0, "negative_score": 0, "positive_max": 0, "negative_max": 0},
            "PJ": {"positive_score": 0, "negative_score": 0, "positive_max": 0, "negative_max": 0},
        }

        for answer in answers:
            question_id = answer.get("question_id")
            score = answer.get("score", 0)
            option_order = answer.get("option_order", 0)
            question = question_map.get(question_id)
            if not question:
                continue
            dimension = self._normalize_dimension(question.dimension)
            if not dimension:
                continue

            # 找到当前选项，读取其极性
            options = question.options or []
            option = next((o for o in options if o.get("order") == option_order), None)
            polarity = (option or {}).get("polarity") if option else None
            max_score = question.max_score or 0

            if polarity == "+":
                dim_data[dimension]["positive_score"] += score
                dim_data[dimension]["positive_max"] += max_score
            elif polarity == "-":
                dim_data[dimension]["negative_score"] += score
                dim_data[dimension]["negative_max"] += max_score
            else:
                # 兼容旧数据：按得分是否达到中点分配
                mid = max_score / 2
                if score >= mid:
                    dim_data[dimension]["positive_score"] += score
                    dim_data[dimension]["positive_max"] += max_score
                else:
                    dim_data[dimension]["negative_score"] += (max_score - score)
                    dim_data[dimension]["negative_max"] += max_score

        result = {}
        for dim in DIMENSIONS:
            data = dim_data[dim]
            positive_score = data["positive_score"]
            negative_score = data["negative_score"]
            positive_max = data["positive_max"] or 0
            negative_max = data["negative_max"] or 0
            total_max = positive_max + negative_max
            total_score = positive_score + negative_score

            result[dim] = DimensionScore(
                dimension=dim,
                score=total_score,
                max_score=total_max,
                rate=round(total_score / (total_max or 1), 2),
                positive_score=positive_score,
                negative_score=negative_score,
                positive_max=positive_max,
                negative_max=negative_max,
            )
        return result

    def _normalize_dimension(self, dimension: Optional[str]) -> Optional[str]:
        """将模块绑定维度归一化为内部维度编码"""
        if not dimension:
            return None
        dim = dimension.upper().replace("/", "")
        mapping = {
            "EI": "EI", "IE": "EI",
            "SN": "SN", "NS": "SN",
            "FT": "FT", "TF": "FT",
            "PJ": "PJ", "JP": "PJ",
        }
        return mapping.get(dim)

    def _determine_type_code(self, dimension_scores: Dict[str, DimensionScore]) -> str:
        """根据四维得分判定 4 位犬格编码（双极比较）"""
        code = ""
        mapping = {
            "EI": ("E", "I"),
            "SN": ("S", "N"),
            "FT": ("F", "T"),
            "PJ": ("P", "J"),
        }
        for dim in DIMENSIONS:
            ds = dimension_scores[dim]
            positive_rate = ds.positive_score / (ds.positive_max or 1)
            negative_rate = ds.negative_score / (ds.negative_max or 1)
            first, second = mapping[dim]
            code += first if positive_rate >= negative_rate else second
        return code

    def _calculate_reliability_score(
        self,
        answers: List[Dict[str, Any]],
        duration_seconds: int,
        dimension_scores: Dict[str, DimensionScore],
        question_map: Dict[int, DogPersonalityQuestion]
    ) -> int:
        """计算可信度评分

        综合以下因素动态评估报告可信度：
        1. 答题时长：过短惩罚、充足奖励
        2. 选项分布集中度：全部相同或严重偏态惩罚
        3. 维度区分度：各维度两极得分过于接近则结果模糊，惩罚
        4. 极端得分：全选最低/最高惩罚
        """
        score = 100.0
        question_count = len(answers)
        if question_count == 0:
            return 0

        # 1. 答题时长因子
        if duration_seconds > 0:
            if duration_seconds < 20:
                score -= 25
            elif duration_seconds < 40:
                score -= 15
            elif duration_seconds < 60:
                score -= 8
            elif duration_seconds < 120:
                score -= 3
            elif duration_seconds >= 180:
                score += 3

        # 2. 选项分布集中度
        option_orders = [a.get("option_order") for a in answers]
        distribution: Dict[Any, int] = {}
        for o in option_orders:
            distribution[o] = distribution.get(o, 0) + 1
        max_ratio = max(distribution.values()) / question_count

        if max_ratio == 1.0:
            score -= 25
        elif max_ratio >= 0.8:
            score -= 12
        elif max_ratio >= 0.6:
            score -= 5

        # 3. 维度区分度：两极越接近，结果越模糊，扣分；区分度高则加分
        dim_penalty = 0
        for dim in DIMENSIONS:
            ds = dimension_scores.get(dim)
            if not ds:
                continue
            pos_rate = ds.positive_score / (ds.positive_max or 1)
            neg_rate = ds.negative_score / (ds.negative_max or 1)
            diff = abs(pos_rate - neg_rate)
            if diff <= 0.1:
                dim_penalty += 5
            elif diff <= 0.25:
                dim_penalty += 2
            elif diff >= 0.5:
                dim_penalty -= 2
        score -= dim_penalty / len(DIMENSIONS)

        # 4. 极端得分校验
        total = sum(a.get("score", 0) for a in answers)
        max_possible = 0
        for answer in answers:
            question = question_map.get(answer.get("question_id"))
            if question:
                max_possible += question.max_score or 0

        if max_possible > 0:
            if total == 0 or total == max_possible:
                score -= 15
            elif total <= max_possible * 0.1 or total >= max_possible * 0.9:
                score -= 6

        return max(0, min(100, int(round(score))))

    async def _load_behavior_configs(
        self,
        db: AsyncSession
    ) -> tuple[List[DogPersonalityBehaviorTag], List[DogPersonalityBehaviorRule]]:
        """加载启用的行为画像标签与规则"""
        result = await db.execute(
            select(DogPersonalityBehaviorTag).where(DogPersonalityBehaviorTag.is_active == 1)
        )
        tags = list(result.scalars().all())

        result = await db.execute(
            select(DogPersonalityBehaviorRule).where(DogPersonalityBehaviorRule.is_active == 1)
        )
        rules = list(result.scalars().all())
        return tags, rules

    def _extract_key_behaviors(
        self,
        answers: List[Dict[str, Any]],
        tags: List[DogPersonalityBehaviorTag],
        rules: List[DogPersonalityBehaviorRule]
    ) -> List[str]:
        """根据答题选项和后台配置提取关键行为画像

        标签、规则、阈值、分类均来自管理后台配置，不再硬编码。
        """
        if not tags or not rules:
            return ["目前暂未生成行为画像。"]

        tag_map: Dict[str, DogPersonalityBehaviorTag] = {t.tag_key: t for t in tags}

        # 规则索引：题目ID -> (精确选项order规则, 通配规则)
        exact_rules: Dict[int, List[DogPersonalityBehaviorRule]] = {}
        wildcard_rules: Dict[int, List[DogPersonalityBehaviorRule]] = {}
        for rule in rules:
            if rule.option_order is None:
                wildcard_rules.setdefault(rule.question_id, []).append(rule)
            else:
                exact_rules.setdefault(rule.question_id, []).append(rule)

        # 累加各标签得分
        behavior_scores: Dict[str, int] = {t.tag_key: 0 for t in tags}
        for answer in answers:
            qid = answer.get("question_id")
            order = answer.get("option_order")

            for rule in exact_rules.get(qid, []):
                if rule.option_order == order:
                    if rule.tag_key in behavior_scores:
                        behavior_scores[rule.tag_key] += rule.weight
            for rule in wildcard_rules.get(qid, []):
                if rule.tag_key in behavior_scores:
                    behavior_scores[rule.tag_key] += rule.weight

        # 筛选满足阈值的标签
        selected_tags = []
        for tag in tags:
            score = behavior_scores.get(tag.tag_key, 0)
            if score >= tag.threshold:
                selected_tags.append((tag, score))

        # 按优先级、得分降序
        selected_tags.sort(key=lambda x: (x[0].priority, x[1]), reverse=True)

        # 分类：问题行为优先，正向特质补充，最多 3 条
        problems = [(t, s) for t, s in selected_tags if t.category == "problem"]
        positives = [(t, s) for t, s in selected_tags if t.category == "positive"]

        selected = []
        if problems:
            selected.extend(problems[:2])
            if positives:
                selected.append(positives[0])
        else:
            selected.extend(positives[:3])

        if not selected:
            return ["目前暂未表现出特别突出的行为倾向，性格比较均衡。"]

        return [t.tag_text for t, _ in selected]

    async def submit_result(
        self,
        user_id: int,
        data: ResultCreate,
        db: AsyncSession
    ) -> SubmitResultResponse:
        """提交测评"""
        # 处理宠物
        if data.pet_id:
            # 使用已有宠物
            result = await db.execute(
                select(PetProfile).where(
                    and_(
                        PetProfile.id == data.pet_id,
                        PetProfile.user_id == user_id,
                        PetProfile.status == 1
                    )
                )
            )
            pet = result.scalar_one_or_none()
            if not pet:
                raise NotFoundException("宠物不存在")
        elif data.temp_pet_info:
            # 创建临时宠物档案
            pet = await self.create_or_get_pet_from_temp(
                user_id,
                data.temp_pet_info.model_dump(),
                db
            )
        else:
            raise BadRequestException("请选择宠物或填写宠物信息")

        # 获取启用题目
        result = await db.execute(
            select(DogPersonalityQuestion).where(DogPersonalityQuestion.is_active == 1)
        )
        questions = result.scalars().all()
        question_ids = [q.id for q in questions]
        question_map = {q.id: q for q in questions}

        # 校验答案（数量、题目有效、question_id 不重复）
        if len(data.answers) != len(question_ids):
            raise BadRequestException(f"请回答全部 {len(question_ids)} 道题目")

        seen_question_ids = set()
        for answer in data.answers:
            if answer.question_id not in question_ids:
                raise BadRequestException(f"题目 {answer.question_id} 不存在或未启用")
            if answer.question_id in seen_question_ids:
                raise BadRequestException(f"题目 {answer.question_id} 重复作答")
            seen_question_ids.add(answer.question_id)

        # 服务端按 question_id + option_order 反查选项得分，忽略客户端传入的 score
        normalized_answers = []
        for answer in data.answers:
            question = question_map[answer.question_id]
            option = next(
                (o for o in (question.options or []) if o.get("order") == answer.option_order),
                None
            )
            if option is None:
                raise BadRequestException(f"题目 {answer.question_id} 不存在选项 {answer.option_order}")
            answer_dict = answer.model_dump()
            answer_dict["score"] = option.get("score", 0)
            normalized_answers.append(answer_dict)

        # 计算四维得分
        dimension_scores = self._calculate_dimension_scores(
            normalized_answers,
            question_map
        )

        # 判定犬格编码
        type_code = self._determine_type_code(dimension_scores)

        # 获取分型
        result = await db.execute(
            select(DogPersonalityLevel).where(
                and_(
                    DogPersonalityLevel.code == type_code,
                    DogPersonalityLevel.is_active == 1
                )
            )
        )
        level = result.scalar_one_or_none()
        if not level:
            raise BadRequestException(f"未找到犬格分型 {type_code}")

        # 可信度评分
        answers_dump = normalized_answers
        reliability_score = self._calculate_reliability_score(
            answers_dump,
            data.duration_seconds or 0,
            dimension_scores,
            question_map
        )

        # 加载行为画像配置并提取画像
        behavior_tags, behavior_rules = await self._load_behavior_configs(db)
        key_behaviors = self._extract_key_behaviors(answers_dump, behavior_tags, behavior_rules)

        # 构建报告快照
        report_data = ReportData(
            type_code=type_code,
            title=level.title,
            description=level.description or "",
            guide=level.guide or "",
            recommendation=level.recommendation or "",
            key_behaviors=key_behaviors
        )

        # 保存测评记录
        record = DogPersonalityResult(
            user_id=user_id,
            pet_id=pet.id,
            answers=normalized_answers,
            dimension_scores={
                dim: ds.model_dump() for dim, ds in dimension_scores.items()
            },
            type_code=type_code,
            reliability_score=reliability_score,
            duration_seconds=data.duration_seconds,
            report_data=report_data.model_dump()
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

        return SubmitResultResponse(
            result_id=record.id,
            pet_id=pet.id,
            type_code=type_code,
            title=level.title
        )

    async def get_result(
        self,
        result_id: int,
        user_id: int,
        db: AsyncSession
    ) -> ResultResponse:
        """获取测评结果"""
        result = await db.execute(
            select(DogPersonalityResult, PetProfile).join(
                PetProfile,
                DogPersonalityResult.pet_id == PetProfile.id
            ).where(
                and_(
                    DogPersonalityResult.id == result_id,
                    DogPersonalityResult.user_id == user_id
                )
            )
        )
        row = result.first()
        if not row:
            raise NotFoundException("测评记录不存在")

        record, pet = row
        ds = record.dimension_scores or {}

        return ResultResponse(
            id=record.id,
            user_id=record.user_id,
            pet_id=record.pet_id,
            pet_name=pet.name,
            pet_avatar=pet.avatar,
            profile_status=pet.profile_status,
            type_code=record.type_code,
            dimension_scores=DimensionScores(
                EI=DimensionScore(**ds.get("EI", {"dimension": "EI", "score": 0, "max_score": 0, "rate": 0})),
                SN=DimensionScore(**ds.get("SN", {"dimension": "SN", "score": 0, "max_score": 0, "rate": 0})),
                FT=DimensionScore(**ds.get("FT", {"dimension": "FT", "score": 0, "max_score": 0, "rate": 0})),
                PJ=DimensionScore(**ds.get("PJ", {"dimension": "PJ", "score": 0, "max_score": 0, "rate": 0})),
            ),
            reliability_score=record.reliability_score,
            report_data=record.report_data,
            created_at=record.created_at
        )

    async def get_recent_results(
        self,
        user_id: int,
        limit: int,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """获取最近测评记录"""
        result = await db.execute(
            select(DogPersonalityResult, PetProfile, DogPersonalityLevel)
            .join(PetProfile, DogPersonalityResult.pet_id == PetProfile.id)
            .join(
                DogPersonalityLevel,
                DogPersonalityResult.type_code == DogPersonalityLevel.code,
                isouter=True
            )
            .where(
                DogPersonalityResult.user_id == user_id
            ).order_by(
                desc(DogPersonalityResult.created_at)
            ).limit(limit)
        )
        rows = result.all()

        return [{
            "id": record.id,
            "pet_id": record.pet_id,
            "pet_name": pet.name,
            "type_code": record.type_code,
            "title": level.title if level else None,
            "created_at": record.created_at.isoformat()
        } for record, pet, level in rows]

    async def get_result_list(
        self,
        user_id: int,
        page: int,
        page_size: int,
        db: AsyncSession
    ) -> tuple:
        """获取当前用户测评记录列表（分页）"""
        query = (
            select(DogPersonalityResult, PetProfile, DogPersonalityLevel)
            .join(PetProfile, DogPersonalityResult.pet_id == PetProfile.id)
            .join(
                DogPersonalityLevel,
                DogPersonalityResult.type_code == DogPersonalityLevel.code,
                isouter=True
            )
            .where(DogPersonalityResult.user_id == user_id)
        )

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar() or 0

        result = await db.execute(
            query.order_by(desc(DogPersonalityResult.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = result.all()

        data = [{
            "id": record.id,
            "pet_id": record.pet_id,
            "pet_name": pet.name,
            "pet_avatar": pet.avatar or '',
            "type_code": record.type_code,
            "title": level.title if level else None,
            "created_at": record.created_at.isoformat()
        } for record, pet, level in rows]

        return total, data

    async def get_trend(
        self,
        user_id: int,
        pet_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """获取测评趋势（V2.0 返回各维度得分趋势）"""
        result = await db.execute(
            select(DogPersonalityResult).where(
                and_(
                    DogPersonalityResult.user_id == user_id,
                    DogPersonalityResult.pet_id == pet_id
                )
            ).order_by(desc(DogPersonalityResult.created_at)).limit(10)
        )
        # 取最近 10 条后反转为时间升序，保证前端图表按时间顺序展示
        records = list(reversed(result.scalars().all()))

        if not records:
            raise NotFoundException("暂无测评记录")

        dimension_trends = {dim: [] for dim in DIMENSIONS}
        type_code_trend = []

        for record in records:
            date_str = record.created_at.strftime("%Y-%m-%d")
            type_code_trend.append({
                "date": date_str,
                "type_code": record.type_code
            })
            ds = record.dimension_scores or {}
            for dim in DIMENSIONS:
                dim_data = ds.get(dim, {})
                dimension_trends[dim].append({
                    "date": date_str,
                    "score": dim_data.get("score", 0),
                    "rate": dim_data.get("rate", 0)
                })

        return {
            "type_code_trend": type_code_trend,
            "dimension_trends": dimension_trends
        }

    async def _save_single_pk_record(
        self,
        user_id: int,
        a_result_id: int,
        b_result_id: int,
        winner_result_id: Optional[int],
        a_total: int,
        b_total: int,
        db: AsyncSession
    ) -> DogPersonalityPKRecord:
        """保存单个用户的 PK 记录"""
        existing = await db.execute(
            select(DogPersonalityPKRecord).where(
                and_(
                    DogPersonalityPKRecord.user_id == user_id,
                    DogPersonalityPKRecord.a_result_id == a_result_id,
                    DogPersonalityPKRecord.b_result_id == b_result_id,
                    DogPersonalityPKRecord.status == 1,
                )
            )
        )
        pk_record = existing.scalar_one_or_none()
        if pk_record:
            pk_record.winner_result_id = winner_result_id
            pk_record.a_total_score = a_total
            pk_record.b_total_score = b_total
        else:
            pk_record = DogPersonalityPKRecord(
                user_id=user_id,
                a_result_id=a_result_id,
                b_result_id=b_result_id,
                winner_result_id=winner_result_id,
                a_total_score=a_total,
                b_total_score=b_total,
            )
            db.add(pk_record)
        return pk_record

    async def create_or_update_pk_record(
        self,
        user_id: int,
        a_result_id: int,
        b_result_id: int,
        db: AsyncSession
    ) -> PKRecordResponse:
        """创建或更新 PK 记录，双方用户各保存一条

        安全约束：调用方必须是 a/b 任一方报告的主人（下方归属校验），
        因此向对方列表写入属于合法的参与者行为；第三方调用会被 403 拒绝。
        """
        # 校验双方结果是否存在
        result = await db.execute(
            select(DogPersonalityResult).where(
                DogPersonalityResult.id.in_([a_result_id, b_result_id])
            )
        )
        records = {r.id: r for r in result.scalars().all()}
        if a_result_id not in records or b_result_id not in records:
            raise NotFoundException("测评结果不存在")

        a_record = records[a_result_id]
        b_record = records[b_result_id]

        # 禁止自己和自己 PK（同一结果 或 同一用户）
        if a_result_id == b_result_id:
            raise BadRequestException("不能自己和自己 PK")
        if a_record.user_id == b_record.user_id:
            raise BadRequestException("不能用自己的宠物和自己 PK")

        # 只能记录自己实际参与的 PK：当前用户必须拥有 result_a 或 result_b 之一
        if a_record.user_id != user_id and b_record.user_id != user_id:
            logger.warning(f"用户 {user_id} 尝试记录不属于自己的 PK: a={a_result_id}(uid={a_record.user_id}), b={b_result_id}(uid={b_record.user_id})")
            raise ForbiddenException("只能记录自己参与的 PK")

        # 总分按四维得分之和计算
        a_total = self._sum_dimension_scores(a_record.dimension_scores)
        b_total = self._sum_dimension_scores(b_record.dimension_scores)
        logger.info(f"记录 PK: user={user_id}, a={a_result_id}, b={b_result_id}, a_total={a_total}, b_total={b_total}")

        # 判定胜负：总分高者胜；总分相同则可信度高的获胜
        winner_result_id = None
        if a_total > b_total:
            winner_result_id = a_record.id
        elif b_total > a_total:
            winner_result_id = b_record.id
        elif a_record.reliability_score > b_record.reliability_score:
            winner_result_id = a_record.id
        elif b_record.reliability_score > a_record.reliability_score:
            winner_result_id = b_record.id

        # 双方各写入一条记录（已通过归属校验，当前用户必为其中一方）
        current_record = await self._save_single_pk_record(
            user_id, a_result_id, b_result_id, winner_result_id, a_total, b_total, db
        )
        opponent_id = b_record.user_id if a_record.user_id == user_id else a_record.user_id
        await self._save_single_pk_record(
            opponent_id, a_result_id, b_result_id, winner_result_id, a_total, b_total, db
        )

        await db.commit()
        await db.refresh(current_record)
        return PKRecordResponse.model_validate(current_record)

    async def get_pk_record_list(
        self,
        user_id: int,
        page: int,
        page_size: int,
        db: AsyncSession
    ) -> tuple:
        """获取当前用户的 PK 记录列表（分页）"""
        query = (
            select(DogPersonalityPKRecord)
            .where(
                and_(
                    DogPersonalityPKRecord.user_id == user_id,
                    DogPersonalityPKRecord.status == 1,
                )
            )
        )

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar() or 0

        result = await db.execute(
            query.order_by(desc(DogPersonalityPKRecord.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        pk_records = result.scalars().all()

        if not pk_records:
            return total, []

        # 批量获取结果与宠物信息
        result_ids = set()
        for r in pk_records:
            result_ids.add(r.a_result_id)
            result_ids.add(r.b_result_id)

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
                "pet_name": pet.name if pet else None,
                "pet_avatar": pet.avatar if pet else None,
                "type_code": record.type_code,
                "title": level.title if level else None,
                "total_score": self._sum_dimension_scores(record.dimension_scores),
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
            # PK 记录只为参与者本人创建，当前用户必在 a/b 一侧
            if a_info.get("user_id") == user_id:
                my_side = "a"
            else:
                my_side = "b"
            data.append({
                "id": r.id,
                "a_result_id": r.a_result_id,
                "b_result_id": r.b_result_id,
                "a_pet_name": a_info.get("pet_name"),
                "a_pet_avatar": a_info.get("pet_avatar"),
                "a_total_score": r.a_total_score,
                "a_type_code": a_info.get("type_code"),
                "a_title": a_info.get("title"),
                "b_pet_name": b_info.get("pet_name"),
                "b_pet_avatar": b_info.get("pet_avatar"),
                "b_total_score": r.b_total_score,
                "b_type_code": b_info.get("type_code"),
                "b_title": b_info.get("title"),
                "winner_side": winner_side,
                "my_side": my_side,
                "created_at": r.created_at.isoformat(),
            })

        return total, data

    def _sum_dimension_scores(self, dimension_scores: Optional[dict]) -> int:
        """将四维得分汇总为总分"""
        if not dimension_scores:
            return 0
        return sum(int(v.get("score", 0)) for v in dimension_scores.values())
