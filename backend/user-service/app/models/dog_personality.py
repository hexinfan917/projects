"""
犬格检测模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, JSON, DECIMAL, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class DogPersonalityModule(Base):
    """犬格检测模块配置表"""
    __tablename__ = "dog_personality_modules"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="模块ID")
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, comment="模块名称")
    module_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="模块排序")
    bind_dimension: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, comment="绑定四维维度 E/I/S/N/F/T/P/J")
    description: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="模块描述")
    is_active: Mapped[int] = mapped_column(Integer, default=1, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityQuestion(Base):
    """犬格检测题目配置表"""
    __tablename__ = "dog_personality_questions"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="题目ID")
    module_name: Mapped[str] = mapped_column(String(64), nullable=False, comment="模块名称")
    module_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="模块排序")
    dimension: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, comment="所属四维维度")
    question_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="题号")
    title: Mapped[str] = mapped_column(String(512), nullable=False, comment="题干")
    image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="题干配图")
    video_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="题干视频")
    options: Mapped[dict] = mapped_column(JSON, nullable=False, comment="选项数组")
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="本题满分")
    is_active: Mapped[int] = mapped_column(Integer, default=1, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityLevel(Base):
    """犬格检测分型配置表（V2.0 16 套犬格人设）"""
    __tablename__ = "dog_personality_levels"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="分型ID")
    code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True, comment="4位犬格编码")
    title: Mapped[str] = mapped_column(String(64), nullable=False, comment="人格称号")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="性格解读")
    guide: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="饲养训练指南")
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="业务推荐文案")
    is_active: Mapped[int] = mapped_column(Integer, default=1, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityBreedWeight(Base):
    """犬格检测犬种权重配置表（V2.0 暂不启用，保留表结构）"""
    __tablename__ = "dog_personality_breed_weights"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="权重ID")
    breed_group: Mapped[str] = mapped_column(String(64), nullable=False, comment="犬种分组")
    module_name: Mapped[str] = mapped_column(String(64), nullable=False, comment="模块名称")
    weight: Mapped[float] = mapped_column(DECIMAL(3, 2), nullable=False, default=1.00, comment="权重系数")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityResult(Base):
    """犬格检测测评记录表（V2.0 四维二元模型）"""
    __tablename__ = "dog_personality_results"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="记录ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="用户ID")
    pet_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="宠物ID")
    answers: Mapped[list] = mapped_column(JSON, nullable=False, comment="答案数组")
    dimension_scores: Mapped[dict] = mapped_column(JSON, nullable=False, comment="四维得分")
    type_code: Mapped[str] = mapped_column(String(8), nullable=False, comment="犬格编码")
    reliability_score: Mapped[int] = mapped_column(Integer, default=100, comment="可信度评分")
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="答题时长（秒）")
    report_data: Mapped[dict] = mapped_column(JSON, nullable=False, comment="报告快照")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityBehaviorTag(Base):
    """犬格检测行为画像标签配置表"""
    __tablename__ = "dog_personality_behavior_tags"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="标签ID")
    tag_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, comment="标签标识")
    tag_text: Mapped[str] = mapped_column(String(512), nullable=False, comment="展示文案")
    category: Mapped[str] = mapped_column(String(16), nullable=False, default="problem", comment="分类 problem/positive")
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=2, comment="触发阈值")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="排序权重")
    is_active: Mapped[int] = mapped_column(Integer, default=1, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityBehaviorRule(Base):
    """犬格检测行为画像规则配置表"""
    __tablename__ = "dog_personality_behavior_rules"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="规则ID")
    tag_key: Mapped[str] = mapped_column(String(64), nullable=False, comment="关联标签")
    question_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="题目ID")
    option_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="选项order，NULL表示任意")
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=1, comment="得分权重")
    is_active: Mapped[int] = mapped_column(Integer, default=1, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class DogPersonalityPKRecord(Base):
    """犬格PK记录表"""
    __tablename__ = "dog_personality_pk_records"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="PK记录ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="当前用户ID")
    a_result_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="A方测评结果ID")
    b_result_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="B方测评结果ID")
    winner_result_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="胜出方结果ID（平局为NULL）")
    a_total_score: Mapped[int] = mapped_column(Integer, default=0, comment="A方总分")
    b_total_score: Mapped[int] = mapped_column(Integer, default=0, comment="B方总分")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="状态 0删除 1有效")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
