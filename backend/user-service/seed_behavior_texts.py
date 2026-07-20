"""
为犬格检测行为画像补全缺失的选项文案。
只对尚未配置行为规则的选项生成默认文案。
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from common.database import AsyncSessionLocal
from app.models.dog_personality import (
    DogPersonalityQuestion,
    DogPersonalityBehaviorTag,
    DogPersonalityBehaviorRule,
)


# 按模块名 + 选项顺序生成文案
MODULE_TEXTS = {
    "陌生人耐受度": [
        "对陌生人非常友好，主动上前打招呼，是典型的社交型选手。",
        "面对陌生人会先礼貌观察，熟悉后能快速放松下来。",
        "对陌生人倾向于回避或躲藏，需要循序渐进的正向社交。",
        "面对陌生人会保持高度警戒，容易出现吠叫、低吼等防御信号。",
    ],
    "同类狗狗社交耐受度": [
        "遇到同类时表现自信友好，喜欢互相嗅闻和一起玩耍。",
        "遇到同类会先观察再靠近，能和平相处但需要一点适应时间。",
        "遇到同类容易紧张，可能会回避或发出警告信号。",
        "遇到同类时反应较强，容易吠叫或挑衅，需要主人及时引导。",
    ],
    "环境应激耐受度": [
        "对新环境和突发声响很淡定，能快速适应各种场景。",
        "大多数情况能保持冷静，偶尔对突然刺激有正常警觉。",
        "对新环境和噪音比较敏感，容易受惊，需要温柔脱敏。",
        "面对陌生环境会非常紧张，可能出现躲避、颤抖或过度吠叫。",
    ],
    "资源占有护食行为": [
        "对食物和玩具非常放松，主人靠近或拿走都不会有抵触。",
        " mild 护物时会有些犹豫，但整体配合度不错。",
        "对食物、玩具等资源比较在意，靠近时可能会低吼或紧张。",
        "资源守护意识强，护食或护玩具行为明显，需要专业行为训练。",
    ],
    "主人服从与自控能力": [
        "服从性很高，能听从指令并克制冲动，是省心的伙伴。",
        "大多数情况下能配合指令，偶尔会被外界吸引注意力。",
        "自控力一般，需要主人反复引导和更多耐心训练。",
        "容易冲动，对指令响应较弱，建议加强基础服从训练。",
    ],
    "分离情绪与居家行为": [
        "情绪非常稳定，独处时也能自得其乐，不会过度依赖主人。",
        "主人离开时会有些想念，但能较快平静下来。",
        "独处时容易焦虑，可能会出现吠叫、破坏等分离焦虑表现。",
        "对分离非常敏感，独处时情绪反应强烈，需要逐步建立安全感。",
    ],
}

# 按四维维度 + 选项顺序兜底
DIMENSION_TEXTS = {
    "EI": [
        "天生的社交达人，面对陌生人和同类都很自信放松。",
        "熟络后很放松，初次见面会先礼貌观察再互动。",
        "面对陌生场景会比较谨慎，需要一点时间适应。",
        "对陌生人和环境保持高度警惕，容易紧张或回避。",
    ],
    "SN": [
        "对环境变化很淡定，不容易被突发声响或陌生事物吓到。",
        "多数情况沉着，遇到突然刺激能较快恢复平静。",
        "感官比较敏感，陌生声音、气味容易让它警觉。",
        "高敏感小雷达，细微变化都会注意到，需要温柔脱敏。",
    ],
    "FT": [
        "特别黏人，能敏锐感知主人情绪，喜欢被关注和回应。",
        "喜欢亲近主人，但也享受自己的独处空间。",
        "情感上偏独立，不太依赖主人的持续陪伴。",
        "情绪内敛，能自己消化情绪，看起来比较冷静稳重。",
    ],
    "PJ": [
        "随性自由派，讨厌被约束，能灵活适应各种变化。",
        "平时看心情，但熟悉的固定流程也能配合。",
        "喜欢可预期的生活，变化太大会有点不安。",
        "自律小管家，固定作息和明确规则让它最有安全感。",
    ],
}


def get_text(module_name: str, dimension: str, option_order: int) -> str:
    order = max(0, min(3, option_order))
    if module_name in MODULE_TEXTS:
        return MODULE_TEXTS[module_name][order]
    if dimension in DIMENSION_TEXTS:
        return DIMENSION_TEXTS[dimension][order]
    # 兜底
    defaults = [
        "表现非常优秀，是这个维度的强项。",
        "表现良好，整体处于舒适区。",
        "表现有些挑战，需要适当关注和引导。",
        "表现需要重点关注，建议进行针对性训练。",
    ]
    return defaults[order]


async def main():
    async with AsyncSessionLocal() as db:
        # 加载启用的题目
        result = await db.execute(
            select(DogPersonalityQuestion).where(DogPersonalityQuestion.is_active == 1)
        )
        questions = result.scalars().all()

        # 加载现有规则
        result = await db.execute(select(DogPersonalityBehaviorRule))
        existing_rules = result.scalars().all()
        existing_keys = {(r.question_id, r.option_order) for r in existing_rules}

        # 加载现有标签文案，用于复用
        result = await db.execute(select(DogPersonalityBehaviorTag))
        existing_tags = result.scalars().all()
        text_to_tag = {t.tag_text: t for t in existing_tags}

        created_tags = 0
        created_rules = 0

        for q in questions:
            options = q.options or []
            for opt in options:
                order = opt.get("order")
                if order is None:
                    continue
                if (q.id, order) in existing_keys:
                    continue

                text = get_text(q.module_name, q.dimension or "", order)
                tag = text_to_tag.get(text)

                if not tag:
                    tag_key = f"auto_{q.dimension or 'dp'}_{len(text_to_tag) + 1}"
                    tag = DogPersonalityBehaviorTag(
                        tag_key=tag_key,
                        tag_text=text,
                        category="problem" if order >= 2 else "positive",
                        threshold=1,
                        priority=0,
                        is_active=1,
                    )
                    db.add(tag)
                    await db.flush()
                    text_to_tag[text] = tag
                    created_tags += 1

                rule = DogPersonalityBehaviorRule(
                    tag_key=tag.tag_key,
                    question_id=q.id,
                    option_order=order,
                    weight=1,
                    is_active=1,
                )
                db.add(rule)
                created_rules += 1

        await db.commit()
        print(f"完成：新增 {created_tags} 个标签，{created_rules} 条规则。")


if __name__ == "__main__":
    asyncio.run(main())
