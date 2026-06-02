# 免费路线配置优化方案

## 一、背景与问题

当前管理后台配置路线时，所有路线（无论免费还是付费）共用同一套复杂表单：
- 6 个 Tab（基本信息 / 行程亮点 / 费用说明 / 注意事项 / 内容模块 / 营期管理）
- 路线表 45+ 个字段（大量价格字段、自驾字段、保险字段等）
- 排期表 27 个字段（12 个套餐价格 + 选配价格）

免费活动（如会员活动、狗狗寻宝记）只需要：名称、类型、封面、时间、地点、简单描述、人数上限。现有表单对运营人员极其不友好。

## 二、设计目标

1. **向后兼容**：现有付费路线数据和行为完全不变
2. **最小侵入**：仅通过 `is_free` 一个标记区分两类路线
3. **配置简化**：免费路线在管理后台只展示必要字段
4. **展示简化**：小程序端免费路线隐藏不必要的价格体系和内容模块

---

## 三、方案设计

### 3.1 数据模型层

#### 变更：routes 表新增 `is_free` 字段

```sql
ALTER TABLE routes ADD COLUMN is_free TINYINT NOT NULL DEFAULT 0 COMMENT '0=付费路线 1=免费路线' AFTER status;
CREATE INDEX idx_routes_is_free ON routes(is_free);
```

- `is_free = 0`（默认）：现有全部 3 条付费路线，行为完全不变
- `is_free = 1`：免费路线，走简化流程

#### route_schedules 表无需变更

免费路线排期的 `price = 0` 即可，已有字段满足需求。

---

### 3.2 管理后台 — 路线配置表单优化

#### 基本信息 Tab：顶部增加「是否免费活动」开关

```
┌─────────────────────────────────────────┐
│  是否免费活动  [Switch: 关闭 / 开启]      │
├─────────────────────────────────────────┤
│  路线名称 *                               │
│  路线类型 *                               │
│  封面图片                                 │
│  图集                                     │
│  副标题                                   │
│  活动描述 (富文本)                        │
│  ...                                     │
└─────────────────────────────────────────┘
```

#### 当 `is_free = true` 时的动态行为

| 行为 | 说明 |
|------|------|
| 隐藏 Tab | 「行程亮点」「费用说明」「注意事项」「内容模块」4 个 Tab 隐藏 |
| 保留 Tab | 「基本信息」「营期管理」2 个 Tab |
| 基本信息简化 | 隐藏：难度、min/max 人数、所有价格字段、安全视频 |
| 营期管理简化 | 只显示：日期、开始时间、结束时间、库存；价格自动设为 0，不展示价格输入 |
| 必填校验 | 仅校验：name、route_type、cover_image |

#### 当 `is_free = false` 时的动态行为

完全保持现有表单不变，所有 6 个 Tab 和 45+ 字段照常展示。

---

### 3.3 后端 API 适配

#### Schema 变更

```python
# RouteCreateUpdate — 新增 is_free 字段
class RouteCreateUpdate(BaseModel):
    name: str
    route_type: int
    is_free: Optional[int] = 0   # ← 新增
    # ... 其他字段保持不变

# RouteResponse / RouteDetailResponse — 新增 is_free 字段  
class RouteResponse(BaseModel):
    id: int
    name: str
    is_free: int                  # ← 新增
    # ... 其他字段保持不变
```

#### 校验逻辑变更

```python
@app.post("/api/v1/admin/routes")
async def create_route(data: RouteCreateUpdate, ...):
    # 免费路线：跳过价格字段校验
    if data.is_free:
        # base_price、self_drive_discount 等允许为 None
        # 不创建 route_addons（行程选配）
        pass
    # 付费路线：保持现有校验逻辑不变
```

#### 排期创建适配

```python
# 免费路线添加排期时，price 自动设为 0
if route.is_free:
    schedule_data.price = 0
    schedule_data.self_drive_price = None
    # 所有套餐价格自动设为 None，不展示也不需要填写
```

---

### 3.4 小程序端 — 差异化展示

#### 路线详情页 (`pages/routes/detail/index.tsx`)

| 模块 | 付费路线 (is_free=0) | 免费路线 (is_free=1) |
|------|----------------------|----------------------|
| 顶部价格区 | 显示「￥XXX起/人」或「自驾￥XXX起」 | 显示「免费」 |
| 套餐选择区 | 显示大巴/自驾切换 + 多套餐选择 | 隐藏，显示「免费报名」按钮 |
| Tab 栏 | 行程亮点 / 费用说明 / 注意事项 / 营期 | 活动介绍 / 营期 |
| 费用说明 | 展示 fee_description / fee_include / fee_exclude | 隐藏 |
| 注意事项 | 展示 notice | 隐藏 |
| 内容模块 | 展示 content_modules | 隐藏 |
| 底部按钮 | 「立即预订」 | 「免费报名」 |

#### 路线列表页 (`pages/routes/index.tsx`)

- 已支持 `schedule_price = 0` 显示「免费」，无需变更

#### 确认页 (`pages/orders/confirm/index.tsx`)

- 免费路线：跳过套餐选择，不显示价格明细，显示「费用：免费」
- 提交订单时：`pay_amount = 0`，订单状态直接设为「已支付」或走免费报名流程

#### 支付页 (`pages/orders/pay/index.tsx`)

- 免费路线：显示「免费报名成功」或直接跳转到订单详情，不进入支付流程

---

### 3.5 免费路线预约流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  路线详情页   │ ──→ │  选择营期    │ ──→ │  填写信息    │ ──→ │  报名成功    │
│  点击免费报名 │     │  （日历选择） │     │  （人数/宠物）│     │  （无需支付） │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

免费路线不需要：套餐选择、价格计算、优惠券、支付流程。

---

## 四、实施计划

### Phase 1：数据库 + 后端（1 小时）
1. 创建 migration：routes 表添加 `is_free` 字段
2. 修改 `Route` model：添加 `is_free` 字段
3. 修改 `RouteCreateUpdate` / `RouteResponse` schema：添加 `is_free`
4. 修改 create/update 接口：根据 `is_free` 简化校验
5. 修改 schedule create 接口：免费路线 price 自动设为 0

### Phase 2：管理后台（2 小时）
1. `Edit.tsx`：基本信息 Tab 添加 `is_free` Switch
2. `Edit.tsx`：根据 `is_free` 动态显示/隐藏 Tab
3. `Edit.tsx`：根据 `is_free` 简化基本信息字段
4. `Edit.tsx`：营期管理 Tab 简化（免费路线隐藏价格输入）
5. `List.tsx`：列表增加「免费」标签列

### Phase 3：小程序端（2 小时）
1. `detail/index.tsx`：根据 `is_free` 差异化展示 Tab 和模块
2. `detail/index.tsx`：免费路线底部按钮改为「免费报名」
3. `confirm/index.tsx`：免费路线跳过套餐选择和支付流程
4. `pay/index.tsx`：免费路线直接报名成功

### Phase 4：测试验证（1 小时）
1. 创建一条免费路线，验证表单简化
2. 验证现有付费路线不受影响
3. 小程序端验证免费路线展示和报名流程

---

## 五、兼容性说明

| 层面 | 兼容性策略 |
|------|-----------|
| 数据库 | `is_free` 默认 0，现有数据自动为付费路线 |
| 后端 API | 新增可选字段 `is_free`，不传默认为 0 |
| 管理后台 | 新增 Switch 控件，默认关闭（付费路线） |
| 小程序 | 新增 `is_free` 判断分支，不影响付费路线展示 |
| 排期价格 | 免费路线 price=0，已修复的前端 falsy 问题已支持 |

---

## 六、决策点

以下问题需要确认后再实施：

1. **免费路线是否需要人数限制？**
   - 方案 A：保留 min/max participants，免费活动也限制人数（推荐）
   - 方案 B：完全不需要人数限制

2. **免费路线是否需要「活动介绍」富文本？**
   - 方案 A：保留 `description` 富文本，作为「活动介绍」Tab 的内容（推荐）
   - 方案 B：只保留纯文本简介

3. **免费路线报名时是否需要填写保险信息？**
   - 方案 A：不需要保险，免费活动简化到极致
   - 方案 B：仍需要保险，但保险费用由平台承担

4. **免费路线是否支持「行程选配」（如加餐、摄影）？**
   - 方案 A：不支持，免费活动不配选项目（推荐）
   - 方案 B：支持，但选配也免费或单独定价

5. **免费路线的订单是否需要走订单系统？**
   - 方案 A：走订单系统，但 pay_amount=0，状态直接为「已支付」（推荐，便于统计）
   - 方案 B：不走订单系统，单独做一个「报名记录」表
