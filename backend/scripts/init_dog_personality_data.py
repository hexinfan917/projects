"""
初始化犬格检测题目和分型数据
"""
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / 'user-service'))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from common.database import init_db, close_db, get_db
from common.logger import setup_logger

from app.models.dog_personality import (
    DogPersonalityQuestion,
    DogPersonalityLevel
)

logger = setup_logger("init-dog-personality")

# 17 道题完整题库
QUESTIONS = [
    # 第一模块：陌生人耐受度（满分 20）
    {
        "module_name": "陌生人耐受度",
        "module_order": 1,
        "question_order": 1,
        "title": "家中来访陌生客人，狗狗的第一反应是？",
        "options": [
            {"order": 0, "label": "主动上前嗅闻，摇尾巴，表现友好", "score": 7},
            {"order": 1, "label": "站在原地观察，等待主人示意后再靠近", "score": 4},
            {"order": 2, "label": "躲到主人身后或角落，表现出紧张", "score": 2},
            {"order": 3, "label": "大声吠叫、低吼，甚至做出攻击姿态", "score": 0}
        ],
        "max_score": 7
    },
    {
        "module_name": "陌生人耐受度",
        "module_order": 1,
        "question_order": 2,
        "title": "陌生人主动伸手，缓慢伸向狗狗头部时，狗狗会？",
        "options": [
            {"order": 0, "label": "主动把头凑过去，享受被抚摸", "score": 7},
            {"order": 1, "label": "身体僵硬但允许触碰，随后放松", "score": 4},
            {"order": 2, "label": "后退躲避，不愿被触碰", "score": 2},
            {"order": 3, "label": "呲牙、低吼或咬手", "score": 0}
        ],
        "max_score": 7
    },
    {
        "module_name": "陌生人耐受度",
        "module_order": 1,
        "question_order": 3,
        "title": "陌生人从主人手中短暂接过牵引绳，牵走狗狗 3 米，狗狗会？",
        "options": [
            {"order": 0, "label": "平静跟随，时不时回头看主人", "score": 6},
            {"order": 1, "label": "有些犹豫，但在陌生人引导下能走", "score": 4},
            {"order": 2, "label": "站在原地不肯走，需要陌生人拉拽", "score": 2},
            {"order": 3, "label": "激烈反抗、吠叫或试图挣脱", "score": 0}
        ],
        "max_score": 6
    },
    # 第二模块：同类狗狗社交耐受度（满分 18）
    {
        "module_name": "同类狗狗社交耐受度",
        "module_order": 2,
        "question_order": 4,
        "title": "户外遇到体型相近、情绪平稳的陌生狗狗，你的狗狗会？",
        "options": [
            {"order": 0, "label": "主动摇尾巴靠近，表现出玩耍兴趣", "score": 6},
            {"order": 1, "label": "保持礼貌距离，互相嗅闻后离开", "score": 4},
            {"order": 2, "label": "躲避、夹尾巴，想尽快离开", "score": 2},
            {"order": 3, "label": "吠叫、低吼或扑上去挑衅", "score": 0}
        ],
        "max_score": 6
    },
    {
        "module_name": "同类狗狗社交耐受度",
        "module_order": 2,
        "question_order": 5,
        "title": "遇到体型远大于自己的陌生狗狗时，你的狗狗会？",
        "options": [
            {"order": 0, "label": "保持冷静，正常社交或礼貌回避", "score": 6},
            {"order": 1, "label": "有些紧张，但能在主人安抚下保持平静", "score": 4},
            {"order": 2, "label": "明显害怕，拽着主人想逃走", "score": 2},
            {"order": 3, "label": "不顾一切冲上去大叫或攻击", "score": 0}
        ],
        "max_score": 6
    },
    {
        "module_name": "同类狗狗社交耐受度",
        "module_order": 2,
        "question_order": 6,
        "title": "和熟悉玩伴狗狗玩耍时被打断，你的狗狗会？",
        "options": [
            {"order": 0, "label": "听从主人指令，安静离开", "score": 6},
            {"order": 1, "label": "有些不舍，但很快配合主人", "score": 4},
            {"order": 2, "label": "需要反复催促才肯离开", "score": 2},
            {"order": 3, "label": "继续纠缠玩伴，对主人指令不理睬", "score": 0}
        ],
        "max_score": 6
    },
    # 第三模块：环境应激耐受度（满分 17）
    {
        "module_name": "环境应激耐受度",
        "module_order": 3,
        "question_order": 7,
        "title": "突然听到关门巨响、塑料袋风声、路人咳嗽或鞭炮声，狗狗会？",
        "options": [
            {"order": 0, "label": "耳朵动一下，但很快恢复平静", "score": 6},
            {"order": 1, "label": "短暂警觉，看向声音方向后放松", "score": 4},
            {"order": 2, "label": "明显受惊，躲到角落或主人怀里", "score": 2},
            {"order": 3, "label": "长时间狂吠、发抖或试图逃跑", "score": 0}
        ],
        "max_score": 6
    },
    {
        "module_name": "环境应激耐受度",
        "module_order": 3,
        "question_order": 8,
        "title": "进入陌生嘈杂环境（商场、人流量大的街道），狗狗会？",
        "options": [
            {"order": 0, "label": "好奇探索，适应良好", "score": 6},
            {"order": 1, "label": "紧跟主人，略有紧张但能坚持", "score": 4},
            {"order": 2, "label": "明显不安，一直想离开", "score": 2},
            {"order": 3, "label": "趴地不走、发抖或出现攻击行为", "score": 0}
        ],
        "max_score": 6
    },
    {
        "module_name": "环境应激耐受度",
        "module_order": 3,
        "question_order": 9,
        "title": "路上遇到雨伞、滑板、倒地杂物或反光物品，狗狗会？",
        "options": [
            {"order": 0, "label": "主动靠近嗅闻或无视", "score": 5},
            {"order": 1, "label": "绕开走，不影响正常前进", "score": 3},
            {"order": 2, "label": "停下脚步，需要主人引导", "score": 2},
            {"order": 3, "label": "狂吠不止，拒绝通过", "score": 0}
        ],
        "max_score": 5
    },
    # 第四模块：资源占有护食行为（满分 15）
    {
        "module_name": "资源占有护食行为",
        "module_order": 4,
        "question_order": 10,
        "title": "进食时主人伸手靠近食盆或拿走食物，狗狗会？",
        "options": [
            {"order": 0, "label": "毫无反应，甚至主动让开", "score": 5},
            {"order": 1, "label": "停顿一下，但没有护食行为", "score": 3},
            {"order": 2, "label": "发出低吼或加快进食速度", "score": 2},
            {"order": 3, "label": "呲牙、吠叫或试图咬人", "score": 0}
        ],
        "max_score": 5
    },
    {
        "module_name": "资源占有护食行为",
        "module_order": 4,
        "question_order": 11,
        "title": "玩耍玩具时，主人强行拿走玩具，狗狗会？",
        "options": [
            {"order": 0, "label": "松口让给主人，等待再次互动", "score": 5},
            {"order": 1, "label": "有些不情愿，但还是松口", "score": 3},
            {"order": 2, "label": "咬住不放，需要命令才松口", "score": 2},
            {"order": 3, "label": "低吼、护玩具或咬手", "score": 0}
        ],
        "max_score": 5
    },
    {
        "module_name": "资源占有护食行为",
        "module_order": 4,
        "question_order": 12,
        "title": "狗狗休息睡觉时，主人触碰它的爪子、肚子或耳朵，它会？",
        "options": [
            {"order": 0, "label": "放松接受，继续睡觉或摇尾巴", "score": 5},
            {"order": 1, "label": "抬头看一眼，但没有抵触", "score": 3},
            {"order": 2, "label": "身体僵硬，表现出不耐烦", "score": 2},
            {"order": 3, "label": "低吼、吠叫或咬人", "score": 0}
        ],
        "max_score": 5
    },
    # 第五模块：主人服从与自控能力（满分 20）
    {
        "module_name": "主人服从与自控能力",
        "module_order": 5,
        "question_order": 13,
        "title": "户外平地牵引绳随行，没有特殊诱惑时，狗狗会？",
        "options": [
            {"order": 0, "label": "始终保持在主人身侧，不拉扯绳子", "score": 7},
            {"order": 1, "label": "偶尔超前或落后，但轻轻一拉就回来", "score": 4},
            {"order": 2, "label": "经常拉扯绳子，方向不定", "score": 2},
            {"order": 3, "label": "爆冲、四处乱窜，主人难以控制", "score": 0}
        ],
        "max_score": 7
    },
    {
        "module_name": "主人服从与自控能力",
        "module_order": 5,
        "question_order": 14,
        "title": "主人原地静止站立 5 分钟，不给任何指令，狗狗会？",
        "options": [
            {"order": 0, "label": "安静坐在/站在主人身边等待", "score": 7},
            {"order": 1, "label": "偶尔走动，但不会离开主人太远", "score": 4},
            {"order": 2, "label": "频繁走动、嗅闻，注意力涣散", "score": 2},
            {"order": 3, "label": "拼命想挣脱牵引绳离开", "score": 0}
        ],
        "max_score": 7
    },
    {
        "module_name": "主人服从与自控能力",
        "module_order": 5,
        "question_order": 15,
        "title": "户外看到零食、小动物或落叶等诱惑物时，狗狗会？",
        "options": [
            {"order": 0, "label": "看一眼主人，继续随行", "score": 6},
            {"order": 1, "label": "有冲动想去，但听从制止", "score": 4},
            {"order": 2, "label": "需要主人多次制止才肯放弃", "score": 2},
            {"order": 3, "label": "完全失控，拼命追上去", "score": 0}
        ],
        "max_score": 6
    },
    # 第六模块：分离情绪与居家行为（满分 10）
    {
        "module_name": "分离情绪与居家行为",
        "module_order": 6,
        "question_order": 16,
        "title": "主人短暂离开视线 5 分钟，关门把狗狗单独留在家中，它会？",
        "options": [
            {"order": 0, "label": "安静等待，主人回来时才迎接", "score": 5},
            {"order": 1, "label": "略有焦虑，但很快安静下来", "score": 3},
            {"order": 2, "label": "一直吠叫、抓门或踱步", "score": 2},
            {"order": 3, "label": "极度焦虑，破坏家具或随地大小便", "score": 0}
        ],
        "max_score": 5
    },
    {
        "module_name": "分离情绪与居家行为",
        "module_order": 6,
        "question_order": 17,
        "title": "主人在家但不和狗狗互动时，狗狗会？",
        "options": [
            {"order": 0, "label": "自己安静休息或玩玩具", "score": 5},
            {"order": 1, "label": "偶尔过来撒娇，得不到回应就离开", "score": 3},
            {"order": 2, "label": "一直缠着主人，无法独处", "score": 2},
            {"order": 3, "label": "焦虑吠叫、破坏物品以引起注意", "score": 0}
        ],
        "max_score": 5
    }
]

LEVELS = [
    {
        "level": "S",
        "min_score": 85,
        "max_score": 100,
        "name": "稳定包容型",
        "label": "天使性格",
        "description": "你的狗狗是一只社交自信、情绪稳定、服从性高的「天使狗」。它对陌生人友好，对同类包容，面对新环境也能保持冷静，是理想的出行伙伴。",
        "fit": "适合参加各类活动，包括高强度徒步、大型狗狗聚会、商场等复杂环境。",
        "risk": "几乎没有明显行为隐患，保持现有的社会化训练即可。",
        "suggestion": "可以尝试更高难度的训练项目，如敏捷赛、飞盘、搜救游戏，继续丰富它的生活体验。"
    },
    {
        "level": "A",
        "min_score": 70,
        "max_score": 84,
        "name": "温和谨慎型",
        "label": "乖巧性格",
        "description": "你的狗狗性格温和，大部分情况下表现乖巧，但在陌生环境或突发事件面前会表现出一定的谨慎，需要主人的引导和鼓励。",
        "fit": "适合参加常规路线、中小型聚会、安静的户外活动。避免一下子进入过于嘈杂或刺激的环境。",
        "risk": "在压力较大的场景下可能出现退缩、紧张，长期忽视可能发展为恐惧反应。",
        "suggestion": "多进行正向脱敏训练，循序渐进地带它接触新环境、新人和新狗狗，建立安全感。"
    },
    {
        "level": "B",
        "min_score": 50,
        "max_score": 69,
        "name": "冲动敏感型",
        "label": "问题萌芽性格",
        "description": "你的狗狗在某些方面表现得比较敏感或冲动，可能已经出现了一些行为问题的苗头，比如对特定刺激过度反应、服从性不稳定等。",
        "fit": "建议选择安静、小团、低刺激的路线和活动，避免高强度社交或复杂环境。",
        "risk": "护食、吠叫、爆冲、分离焦虑等问题可能加重，影响出行安全和家庭生活质量。",
        "suggestion": "针对短板模块进行专项训练，必要时寻求专业训犬师帮助，制定系统的行为矫正计划。"
    },
    {
        "level": "C",
        "min_score": 0,
        "max_score": 49,
        "name": "焦虑攻击型",
        "label": "高危性格",
        "description": "你的狗狗目前表现出较高的焦虑或攻击性，存在比较明显的应激反应或行为问题，不建议在没有专业指导的情况下参加集体活动。",
        "fit": "暂时不建议参加平台组织的户外活动，建议先从家庭环境的基础训练开始。",
        "risk": "咬人、咬狗、严重分离焦虑、过度护食等风险较高，需要高度重视。",
        "suggestion": "建议尽快咨询专业训犬师或动物行为医生，进行一对一行为评估和矫正，切勿强行社会化。"
    }
]


async def init_data():
    """初始化数据"""
    await init_db()
    
    async for db in get_db():
        # 初始化题目
        for q_data in QUESTIONS:
            result = await db.execute(
                select(DogPersonalityQuestion).where(
                    DogPersonalityQuestion.question_order == q_data["question_order"]
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info(f"题目 {q_data['question_order']} 已存在，跳过")
                continue
            
            question = DogPersonalityQuestion(**q_data)
            db.add(question)
            logger.info(f"创建题目 {q_data['question_order']}: {q_data['title'][:20]}...")
        
        await db.commit()
        
        # 初始化分型
        for l_data in LEVELS:
            result = await db.execute(
                select(DogPersonalityLevel).where(
                    DogPersonalityLevel.level == l_data["level"]
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info(f"分型 {l_data['level']} 已存在，跳过")
                continue
            
            level = DogPersonalityLevel(**l_data)
            db.add(level)
            logger.info(f"创建分型 {l_data['level']}: {l_data['label']}")
        
        await db.commit()
        break
    
    await close_db()
    logger.info("犬格检测数据初始化完成")


if __name__ == "__main__":
    asyncio.run(init_data())
