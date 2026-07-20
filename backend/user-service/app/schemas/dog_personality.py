"""
犬格检测相关Schema
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QuestionOption(BaseModel):
    """题目选项"""
    order: int = Field(..., description="选项顺序")
    label: str = Field(..., description="选项文案")
    score: int = Field(..., description="选项分值")
    polarity: Optional[str] = Field(None, description="选项极性 + 表示正极(E/S/F/P)，- 表示负极(I/N/T/J)")
    image_url: Optional[str] = Field(None, description="选项配图")


class ModuleBase(BaseModel):
    """模块基础信息"""
    name: str = Field(..., max_length=64, description="模块名称")
    module_order: int = Field(..., ge=1, description="模块排序")
    bind_dimension: Optional[str] = Field(None, max_length=8, description="绑定四维维度 E/I/S/N/F/T/P/J")
    description: Optional[str] = Field(None, max_length=512, description="模块描述")
    is_active: int = Field(default=1, ge=0, le=1, description="是否启用")


class ModuleCreate(ModuleBase):
    """创建模块"""
    pass


class ModuleUpdate(BaseModel):
    """更新模块"""
    name: Optional[str] = Field(None, max_length=64)
    module_order: Optional[int] = Field(None, ge=1)
    bind_dimension: Optional[str] = Field(None, max_length=8)
    description: Optional[str] = Field(None, max_length=512)
    is_active: Optional[int] = Field(None, ge=0, le=1)


class ModuleResponse(ModuleBase):
    """模块响应"""
    id: int = Field(..., description="模块ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class QuestionBase(BaseModel):
    """题目基础信息"""
    module_name: str = Field(..., max_length=64, description="模块名称")
    module_order: int = Field(..., ge=1, description="模块排序")
    question_order: int = Field(..., ge=1, description="题号")
    title: str = Field(..., max_length=512, description="题干")
    image_url: Optional[str] = Field(None, max_length=512, description="题干配图")
    video_url: Optional[str] = Field(None, max_length=512, description="题干视频")
    options: List[QuestionOption] = Field(..., description="选项数组")
    max_score: int = Field(..., ge=0, description="本题满分")
    is_active: int = Field(default=1, ge=0, le=1, description="是否启用")


class QuestionCreate(QuestionBase):
    """创建题目"""
    pass


class QuestionUpdate(BaseModel):
    """更新题目"""
    module_name: Optional[str] = Field(None, max_length=64)
    module_order: Optional[int] = Field(None, ge=1)
    question_order: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, max_length=512)
    image_url: Optional[str] = Field(None, max_length=512)
    video_url: Optional[str] = Field(None, max_length=512)
    options: Optional[List[QuestionOption]] = None
    max_score: Optional[int] = Field(None, ge=0)
    is_active: Optional[int] = Field(None, ge=0, le=1)


class QuestionResponse(QuestionBase):
    """题目响应"""
    id: int = Field(..., description="题目ID")
    dimension: Optional[str] = Field(None, description="所属四维维度")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    """按模块分组的题目列表"""
    module_name: str = Field(..., description="模块名称")
    module_order: int = Field(..., description="模块排序")
    module_dimension: Optional[str] = Field(None, description="模块绑定维度")
    module_description: Optional[str] = Field(None, description="模块描述")
    questions: List[QuestionResponse] = Field(..., description="题目列表")


class LevelBase(BaseModel):
    """分型基础信息（V2.0 16 套犬格人设）"""
    code: str = Field(..., max_length=8, description="4位犬格编码")
    title: str = Field(..., max_length=64, description="人格称号")
    description: Optional[str] = Field(None, description="性格解读")
    guide: Optional[str] = Field(None, description="饲养训练指南")
    recommendation: Optional[str] = Field(None, description="业务推荐文案")
    is_active: int = Field(default=1, ge=0, le=1, description="是否启用")


class LevelCreate(LevelBase):
    """创建分型"""
    pass


class LevelUpdate(BaseModel):
    """更新分型"""
    code: Optional[str] = Field(None, max_length=8)
    title: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    guide: Optional[str] = None
    recommendation: Optional[str] = None
    is_active: Optional[int] = Field(None, ge=0, le=1)


class LevelResponse(LevelBase):
    """分型响应"""
    id: int = Field(..., description="分型ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class AnswerItem(BaseModel):
    """答题项"""
    question_id: int = Field(..., description="题目ID")
    module_name: str = Field(..., description="模块名称")
    option_order: int = Field(..., description="选项顺序")
    score: int = Field(0, ge=0, description="选项得分（兼容字段，服务端忽略，按题库配置反查）")


class TempPetInfo(BaseModel):
    """临时宠物信息"""
    name: str = Field(..., max_length=50, description="宠物名")
    breed: str = Field(..., max_length=50, description="品种")
    age_str: str = Field(..., max_length=20, description="年龄文本")
    gender: int = Field(..., ge=0, le=1, description="0母 1公")
    weight: Optional[float] = Field(None, ge=0, description="体重（kg）")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")


class ResultCreate(BaseModel):
    """提交测评"""
    pet_id: Optional[int] = Field(None, description="已有宠物ID，与temp_pet_info二选一")
    temp_pet_info: Optional[TempPetInfo] = Field(None, description="临时宠物信息")
    answers: List[AnswerItem] = Field(..., description="答案数组")
    duration_seconds: Optional[int] = Field(default=0, ge=0, description="答题时长（秒），用于可信度评分")


class DimensionScore(BaseModel):
    """单维度得分"""
    dimension: str = Field(..., description="维度编码 EI/SN/FT/PJ")
    score: int = Field(..., description="得分")
    max_score: int = Field(..., description="满分")
    rate: float = Field(..., description="得分率")
    positive_score: int = Field(0, description="正极累计得分")
    negative_score: int = Field(0, description="负极累计得分")
    positive_max: int = Field(0, description="正极满分")
    negative_max: int = Field(0, description="负极满分")


class DimensionScores(BaseModel):
    """四维得分"""
    EI: DimensionScore = Field(..., description="外向/内向")
    SN: DimensionScore = Field(..., description="现实/敏感")
    FT: DimensionScore = Field(..., description="共情/理性")
    PJ: DimensionScore = Field(..., description="随性/规律")


class ReportData(BaseModel):
    """报告数据"""
    type_code: str = Field(..., description="犬格编码")
    title: str = Field(..., description="人格称号")
    description: str = Field(..., description="性格解读")
    guide: str = Field(..., description="饲养训练指南")
    recommendation: str = Field(..., description="业务推荐文案")
    key_behaviors: Optional[List[str]] = Field(default=None, description="关键行为画像（根据答题提取）")


class ResultResponse(BaseModel):
    """测评结果响应"""
    id: int = Field(..., description="记录ID")
    user_id: int = Field(..., description="用户ID")
    pet_id: int = Field(..., description="宠物ID")
    pet_name: Optional[str] = Field(None, description="宠物名")
    pet_avatar: Optional[str] = Field(None, description="宠物头像")
    profile_status: Optional[str] = Field(None, description="宠物档案状态（complete/incomplete）")
    type_code: str = Field(..., description="犬格编码")
    dimension_scores: DimensionScores = Field(..., description="四维得分")
    reliability_score: int = Field(..., description="可信度评分")
    report_data: ReportData = Field(..., description="报告数据")
    created_at: datetime = Field(..., description="测评时间")
    
    class Config:
        from_attributes = True


class ResultBriefResponse(BaseModel):
    """测评记录简要响应"""
    id: int = Field(..., description="记录ID")
    pet_id: int = Field(..., description="宠物ID")
    pet_name: Optional[str] = Field(None, description="宠物名")
    type_code: str = Field(..., description="犬格编码")
    title: Optional[str] = Field(None, description="人格称号")
    created_at: datetime = Field(..., description="测评时间")

    class Config:
        from_attributes = True


class SubmitResultResponse(BaseModel):
    """提交测评返回"""
    result_id: int = Field(..., description="结果ID")
    pet_id: int = Field(..., description="宠物ID")
    type_code: str = Field(..., description="犬格编码")
    title: str = Field(..., description="人格称号")


class AdminResultFilter(BaseModel):
    """管理后台测评记录筛选"""
    user_id: Optional[int] = None
    pet_id: Optional[int] = None
    type_code: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PKRecordCreate(BaseModel):
    """创建PK记录"""
    a_result_id: int = Field(..., description="A方测评结果ID")
    b_result_id: int = Field(..., description="B方测评结果ID")


class PKRecordResponse(BaseModel):
    """PK记录响应"""
    id: int = Field(..., description="PK记录ID")
    a_result_id: int = Field(..., description="A方测评结果ID")
    b_result_id: int = Field(..., description="B方测评结果ID")
    winner_result_id: Optional[int] = Field(None, description="胜出方结果ID")
    a_total_score: int = Field(..., description="A方总分")
    b_total_score: int = Field(..., description="B方总分")
    created_at: datetime = Field(..., description="PK时间")

    class Config:
        from_attributes = True


class PKRecordListItem(BaseModel):
    """PK记录列表项"""
    id: int = Field(..., description="PK记录ID")
    a_result_id: int = Field(..., description="A方测评结果ID")
    b_result_id: int = Field(..., description="B方测评结果ID")
    a_pet_name: Optional[str] = Field(None, description="A方宠物名")
    a_pet_avatar: Optional[str] = Field(None, description="A方宠物头像")
    a_total_score: int = Field(..., description="A方总分")
    a_type_code: str = Field(..., description="A方犬格编码")
    a_title: Optional[str] = Field(None, description="A方人格称号")
    b_pet_name: Optional[str] = Field(None, description="B方宠物名")
    b_pet_avatar: Optional[str] = Field(None, description="B方宠物头像")
    b_total_score: int = Field(..., description="B方总分")
    b_type_code: str = Field(..., description="B方犬格编码")
    b_title: Optional[str] = Field(None, description="B方人格称号")
    winner_side: str = Field(..., description="胜负 a/b/tie")
    my_side: str = Field(..., description="当前用户所在侧 a/b")
    created_at: datetime = Field(..., description="PK时间")

    class Config:
        from_attributes = True


# ============== 行为画像配置 Schema ==============

class BehaviorTagBase(BaseModel):
    """行为标签基础"""
    tag_key: str = Field(..., max_length=64, description="标签标识")
    tag_text: str = Field(..., max_length=512, description="展示文案")
    category: str = Field(default="problem", max_length=16, description="分类 problem/positive")
    threshold: int = Field(default=2, ge=1, description="触发阈值")
    priority: int = Field(default=0, description="排序权重")
    is_active: int = Field(default=1, ge=0, le=1, description="是否启用")


class BehaviorTagCreate(BehaviorTagBase):
    """创建行为标签"""
    pass


class BehaviorTagUpdate(BaseModel):
    """更新行为标签"""
    tag_key: Optional[str] = Field(None, max_length=64)
    tag_text: Optional[str] = Field(None, max_length=512)
    category: Optional[str] = Field(None, max_length=16)
    threshold: Optional[int] = Field(None, ge=1)
    priority: Optional[int] = None
    is_active: Optional[int] = Field(None, ge=0, le=1)


class BehaviorTagResponse(BehaviorTagBase):
    """行为标签响应"""
    id: int = Field(..., description="标签ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class BehaviorRuleBase(BaseModel):
    """行为规则基础"""
    tag_key: str = Field(..., max_length=64, description="关联标签标识")
    question_id: int = Field(..., description="题目ID")
    option_order: Optional[int] = Field(default=None, description="选项order，NULL表示任意")
    weight: int = Field(default=1, ge=1, description="得分权重")
    is_active: int = Field(default=1, ge=0, le=1, description="是否启用")


class BehaviorRuleCreate(BehaviorRuleBase):
    """创建行为规则"""
    pass


class BehaviorRuleUpdate(BaseModel):
    """更新行为规则"""
    tag_key: Optional[str] = Field(None, max_length=64)
    question_id: Optional[int] = None
    option_order: Optional[int] = None
    weight: Optional[int] = Field(None, ge=1)
    is_active: Optional[int] = Field(None, ge=0, le=1)


class BehaviorRuleResponse(BehaviorRuleBase):
    """行为规则响应"""
    id: int = Field(..., description="规则ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class BehaviorRuleWithTag(BaseModel):
    """行为规则带标签信息"""
    id: int
    tag_key: str
    tag_text: str
    category: str
    question_id: int
    option_order: Optional[int]
    weight: int
    is_active: int
    created_at: datetime
    updated_at: datetime
