# 产品需求文档（PRD）

## 免费路线会员专享 + 保险可配置功能

---

**版本**：v1.1  
**日期**：2026-06-08  
**状态**：待开发  
**负责人**：技术团队

---

## 一、背景与问题

### 1.1 现状

当前平台存在两类路线：
- **付费路线**（`is_free=0`）：所有用户按排期价格付费购买
- **免费路线**（`is_free=1`）：**所有用户**均可免费参加，无需支付路线费用和保险费用

现有 2 条免费路线：
| ID | 路线名称 | 当前规则 |
|----|---------|---------|
| 13 | 6月会员活动-夏日逃暑计划 | 对所有人完全免费（路线费=0，保险费=0） |
| 19 | 衢州第一届动物音乐节 | 对所有人完全免费（路线费=0，保险费=0） |

**当前保险费为前端硬编码**：宠物 ¥15/只，人身 ¥10/人，所有路线统一。

### 1.2 问题

1. **免费路线被非会员大量占用**：非会员无需付费即可参加会员活动，会员价值感低
2. **保险费用不可配置**：所有路线统一收取保险费，无法根据路线特性灵活设置
3. **会员权益无法体现**：无法通过"会员专享免费"吸引用户开通会员

### 1.3 目标

1. **会员专享免费**：免费路线可设置为仅限会员免费，非会员需按正常价格付费
2. **保险费用可配置**：每条路线可独立设置是否需要保险、保险单价

---

## 二、需求概述

### 2.1 功能定义

在路线维度增加两个能力：
1. **会员专享开关**（`is_member_only`）：控制免费路线是否仅限会员
2. **保险配置**（`is_insurance_required` + `pet_insurance_price` + `person_insurance_price`）：控制是否收取保险、保险单价

### 2.2 价格规则总表

| `is_free` | `is_member_only` | `is_insurance_required` | 会员总价 | 非会员总价 |
|-----------|-----------------|------------------------|---------|-----------|
| 0 | 任意 | 0 | 路线费 + 0 | 路线费 + 0 |
| 0 | 任意 | 1 | 路线费 + 保险 | 路线费 + 保险 |
| 1 | 0 | 0 | **¥0** | **¥0** |
| 1 | 0 | 1 | **¥0** + 保险 | **¥0** + 保险 |
| 1 | **1** | 0 | **¥0** | **路线费** + 0 |
| 1 | **1** | 1 | **¥0** + 保险 | **路线费** + 保险 |

### 2.3 用户故事

**故事 1 - 会员用户**
> 作为已开通会员的用户，当我浏览到"仅限会员免费"的路线时，我希望看到"会员专享免费"标识，下单时路线费为 0，保险费按路线配置收取。

**故事 2 - 非会员用户**
> 作为未开通会员的用户，当我浏览到"仅限会员免费"的路线时，我希望看到正常的价格和"会员可免费"提示，下单时需要按正常路线价格支付。

**故事 3 - 运营人员**
> 作为后台运营人员，我希望在创建/编辑路线时：
> - 设置"仅限会员免费"开关
> - 设置是否需要保险、宠物/人身保险单价
> - 灵活控制每条路线的收费规则

---

## 三、业务流程

### 3.1 会员用户购买会员专享免费路线（需保险）

```
浏览路线详情 
  → 显示"会员专享免费" + "需支付保险"
  → 选择日期/套餐
  → 路线价格=0，保险费=宠物数×单价+人数×单价
  → 提交订单
  → 创建订单(route_price=0, insurance_price=正常, is_free=1)
  → 如保险费>0：待支付；如保险费=0：已支付
```

### 3.2 非会员用户购买会员专享免费路线（需保险）

```
浏览路线详情
  → 显示正常价格 + "开通会员可免费"
  → 选择日期/套餐
  → 路线价格=原价，保险费=正常
  → 提交订单
  → 创建订单(route_price=原价, insurance_price=正常, is_free=0)
  → 状态=待支付
```

### 3.3 所有用户购买完全免费路线（无需保险）

```
浏览路线详情
  → 显示"免费活动"
  → 路线价格=0，保险费=0
  → 提交订单
  → 创建订单(route_price=0, insurance_price=0, is_free=1)
  → 状态=已支付
```

---

## 四、功能需求

### 4.1 数据库变更

#### 4.1.1 新增字段

**表名**：`routes`（路线表）

| 字段名 | 类型 | 默认值 | 是否为空 | 说明 |
|--------|------|--------|---------|------|
| `is_member_only` | `TINYINT(1)` | `0` | `NOT NULL` | `0`=所有人可免费，`1`=仅限会员免费 |
| `is_insurance_required` | `TINYINT(1)` | `1` | `NOT NULL` | `0`=不需要保险，`1`=需要保险 |
| `pet_insurance_price` | `DECIMAL(10,2)` | `15.00` | `NOT NULL` | 宠物保险单价（元/只） |
| `person_insurance_price` | `DECIMAL(10,2)` | `10.00` | `NOT NULL` | 人身保险单价（元/人） |

#### 4.1.2 数据迁移

```sql
-- 步骤 1：新增字段
ALTER TABLE routes 
ADD COLUMN is_member_only TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0所有人可免费 1仅限会员免费' AFTER is_free,
ADD COLUMN is_insurance_required TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0不需要保险 1需要保险' AFTER is_member_only,
ADD COLUMN pet_insurance_price DECIMAL(10,2) NOT NULL DEFAULT 15.00 COMMENT '宠物保险单价' AFTER is_insurance_required,
ADD COLUMN person_insurance_price DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT '人身保险单价' AFTER pet_insurance_price;

-- 步骤 2：现有免费路线设为会员专享 + 不需要保险（保持完全免费）
UPDATE routes 
SET is_member_only = 1, 
    is_insurance_required = 0,
    pet_insurance_price = 0,
    person_insurance_price = 0
WHERE is_free = 1;

-- 步骤 3：付费路线统一保险单价
UPDATE routes 
SET pet_insurance_price = 15.00,
    person_insurance_price = 10.00
WHERE is_free = 0;
```

**影响范围**：2 条免费路线（ID 13、ID 19）变为会员专享 + 不需要保险

**回滚方案**：
```sql
ALTER TABLE routes 
DROP COLUMN is_member_only,
DROP COLUMN is_insurance_required,
DROP COLUMN pet_insurance_price,
DROP COLUMN person_insurance_price;
```

---

### 4.2 后端需求

#### 4.2.1 路线服务（route-service）

**需求 1：Model 层新增字段**
- 文件：`backend/route-service/app/models/route.py`
- 在 `Route` 类中新增：
  ```python
  is_member_only: Mapped[int] = mapped_column(Integer, default=0, comment="0所有人可免费 1仅限会员免费")
  is_insurance_required: Mapped[int] = mapped_column(Integer, default=1, comment="0不需要保险 1需要保险")
  pet_insurance_price: Mapped[float] = mapped_column(DECIMAL(10,2), default=15.00, comment="宠物保险单价")
  person_insurance_price: Mapped[float] = mapped_column(DECIMAL(10,2), default=10.00, comment="人身保险单价")
  ```

**需求 2：Schema 层新增字段**
- 文件：`backend/route-service/app/schemas/route.py`
- 在 `RouteCreate` 和 `RouteUpdate` schema 中新增：
  ```python
  is_member_only: int = 0
  is_insurance_required: int = 1
  pet_insurance_price: float = 15.00
  person_insurance_price: float = 10.00
  ```

**需求 3：路线列表/详情接口返回新增字段**
- 文件：`backend/route-service/main.py`
- 在路线详情、列表、创建、编辑接口的返回数据中增加：
  ```python
  "is_free": r.is_free,
  "is_member_only": r.is_member_only,
  "is_insurance_required": r.is_insurance_required,
  "pet_insurance_price": float(r.pet_insurance_price),
  "person_insurance_price": float(r.person_insurance_price),
  ```

#### 4.2.2 订单服务（order-service）

**需求 4：创建订单时判断会员身份 + 保险配置**
- 文件：`backend/order-service/main.py`
- 在 `create_order` 函数中：

```python
# 1. 判断用户是否会员
async def check_user_membership(user_id: int, db: AsyncSession) -> bool:
    result = await db.execute(
        text("""
            SELECT 1 FROM user_memberships 
            WHERE user_id = :user_id AND status = 1 AND end_date >= CURDATE()
        """),
        {"user_id": user_id}
    )
    return result.scalar() is not None

is_member = await check_user_membership(user_id, db)

# 2. 获取路线配置（需从 route-service 获取或本地查询）
route_is_member_only = getattr(data, 'is_member_only', 0)
route_is_insurance_required = getattr(data, 'is_insurance_required', 1)

# 3. 计算路线价格
if data.is_free == 1 and route_is_member_only == 1 and not is_member:
    # 非会员购买会员专享免费路线 = 按原价
    actual_route_price = data.route_price
    order_is_free = 0
else:
    # 会员 或 非会员专享 或 付费路线
    actual_route_price = data.route_price
    order_is_free = 1 if data.is_free == 1 else 0

# 4. 计算保险费（根据路线配置）
if route_is_insurance_required == 1:
    actual_insurance_price = data.insurance_price  # 前端已按配置计算
else:
    actual_insurance_price = 0

# 5. 总价
total_amount = actual_route_price + actual_insurance_price + data.equipment_price + data.addon_amount
```

**需求 5：可用优惠券接口调整**
- 文件：`backend/order-service/main.py` 第 2092 行附近
- 在计算优惠券可用性时：
  ```python
  # 会员专享免费路线的折扣基础
  if is_free_route:
      route_is_member_only = ...  # 从 route 查询
      if route_is_member_only and not is_member:
          discount_base = route_price  # 非会员按原价算优惠券
      else:
          discount_base = 0  # 会员免费，无优惠券可用
  ```

#### 4.2.3 用户服务（user-service）

**需求 6：会员中心接口（现有，无需改动）**
- `/api/v1/member/center` 已返回 `is_member` 字段

---

### 4.3 前端小程序需求

#### 4.3.1 路线详情页

**需求 7：显示会员专享标识**
- 文件：`frontend/miniapp/src/pages/routes/detail/index.tsx`
- 当 `route.is_free === 1 && route.is_member_only === 1` 时：
  - 显示 **"会员专享免费"** 金色标签
  - 非会员用户显示提示："开通会员即可免费参加此路线"

**需求 8：保险配置展示**
- 当 `route.is_insurance_required === 1` 时：
  - 展示保险费用明细（宠物 ¥X/只、人身 ¥Y/人）
- 当 `route.is_insurance_required === 0` 时：
  - 不展示保险相关费用

**需求 9：价格展示逻辑**

| 用户 | 路线类型 | 保险配置 | 展示 |
|------|---------|---------|------|
| 会员 | 会员专享免费 | 需保险 | `¥0` + "需支付保险 ¥X" |
| 会员 | 会员专享免费 | 无需保险 | `¥0` + "完全免费" |
| 非会员 | 会员专享免费 | 需保险 | `¥{原价}` + "会员可免费" |
| 非会员 | 会员专享免费 | 无需保险 | `¥{原价}` + "会员可免费" |
| 任意 | 全员免费 | 需保险 | `¥0` + "需支付保险 ¥X" |
| 任意 | 全员免费 | 无需保险 | `¥0` + "完全免费" |
| 任意 | 付费路线 | 需保险 | `¥{原价}` + "含保险" |
| 任意 | 付费路线 | 无需保险 | `¥{原价}` |

#### 4.3.2 订单确认页

**需求 10：获取会员状态 + 路线配置**
- 文件：`frontend/miniapp/src/pages/orders/confirm/index.tsx`
- 在页面加载时：
  1. 调用 `getMemberCenter()` 获取 `is_member`
  2. 从 `route` 对象读取保险配置

**需求 11：价格重算逻辑**

```typescript
// 路线配置
const isMemberOnly = route?.is_member_only === 1
const isInsuranceRequired = route?.is_insurance_required === 1
const petInsuranceUnit = route?.pet_insurance_price ?? 15
const personInsuranceUnit = route?.person_insurance_price ?? 10

// 是否享受免费路线
const memberFree = route?.is_free === 1 && isMemberOnly && isMember

// 路线价格
const routePrice = memberFree ? 0 : (basePrice + extraPersonCount * extraPersonUnitPrice + extraPetCount * extraPetUnitPrice)

// 保险费（按路线配置）
const petInsuranceTotal = isInsuranceRequired ? selectedPetIds.length * petInsuranceUnit : 0
const personInsuranceTotal = isInsuranceRequired ? selectedTravelers.length * personInsuranceUnit : 0
const insurancePrice = petInsuranceTotal + personInsuranceTotal

// 总价
const total = routePrice + addonTotal + insurancePrice

// 可提交条件
const canSubmit = selectedTravelers.length > 0
  && (route?.is_free === 1 && !isMemberOnly
    ? (selectedTravelers.length === 1 && selectedPetIds.length === 1)
    : selectedPetIds.length > 0)
  && (agreements.length === 0 || agreed)
```

**需求 12：创建订单参数**

```typescript
createOrder({
  route_id: route.id,
  schedule_id: schedule.id,
  route_name: route.name,
  travel_date: schedule.schedule_date,
  contact: { name: contact.name, phone: contact.phone },
  participants,
  pets: selectedPets.map(p => ({ id: p.id, name: p.name, breed: p.breed, weight: p.weight, gender: p.gender })),
  participant_count: selectedTravelers.length,
  pet_count: selectedPetIds.length,
  route_price: routePrice,
  insurance_price: insurancePrice,
  equipment_price: 0,
  discount_amount: memberFree ? 0 : couponDiscount,
  coupon_id: memberFree ? null : selectedCouponId,
  addons: memberFree ? [] : [...(bookingParams?.addons || []), ...selectedAddons],
  addon_amount: memberFree ? 0 : addonTotal,
  travel_type: memberFree ? 'self_drive' : bookingParams?.travelType,
  is_free: memberFree ? 1 : 0,
  is_member_only: route?.is_member_only,      // 传给后端
  is_insurance_required: route?.is_insurance_required  // 传给后端
})
```

#### 4.3.3 订单详情页

**需求 13：价格明细展示**
- 文件：`frontend/miniapp/src/pages/orders/detail/index.tsx`
- 展示格式：
  ```
  路线费用：¥0（会员专享免费）
  宠物保险（2只 × ¥15）：¥30
  人身保险（1人 × ¥10）：¥10
  合计：¥40
  ```

---

### 4.4 Admin 管理后台需求

#### 4.4.1 路线编辑页

**需求 14：会员专享开关**
- 文件：`frontend/admin/src/pages/Routes/Edit.tsx`
- 条件显示：仅在 `is_free=1` 时显示
- 表单控件：
  ```tsx
  {form.getFieldValue('is_free') === 1 && (
    <Form.Item
      name="is_member_only"
      label="仅限会员免费"
      tooltip="开启后，非会员需按正常价格支付路线费用"
    >
      <Radio.Group>
        <Radio value={0}>所有人可免费</Radio>
        <Radio value={1}>仅限会员免费</Radio>
      </Radio.Group>
    </Form.Item>
  )}
  ```

**需求 15：保险配置面板**
- 文件：`frontend/admin/src/pages/Routes/Edit.tsx`
- 表单控件：
  ```tsx
  <Form.Item
    name="is_insurance_required"
    label="是否需要保险"
  >
    <Radio.Group>
      <Radio value={0}>不需要保险</Radio>
      <Radio value={1}>需要保险</Radio>
    </Radio.Group>
  </Form.Item>

  {form.getFieldValue('is_insurance_required') === 1 && (
    <>
      <Form.Item
        name="pet_insurance_price"
        label="宠物保险单价（元/只）"
        rules={[{ required: true, message: '请输入宠物保险单价' }]}
      >
        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        name="person_insurance_price"
        label="人身保险单价（元/人）"
        rules={[{ required: true, message: '请输入人身保险单价' }]}
      >
        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
      </Form.Item>
    </>
  )}
  ```

**需求 16：表单初始值**
- 文件：`frontend/admin/src/pages/Routes/Edit.tsx`
- 初始值设置：
  ```tsx
  initialValues={{
    status: 1,
    is_free: 0,
    is_member_only: 0,
    is_insurance_required: 1,
    pet_insurance_price: 15.00,
    person_insurance_price: 10.00,
    is_hot: 0,
    difficulty: 3,
    min_participants: 4,
    max_participants: 12,
    ...
  }}
  ```

#### 4.4.2 路线列表页

**需求 17：路线列表标识**
- 文件：`frontend/admin/src/pages/Routes/List.tsx`
- 在路线列表中增加标识列：

| 路线类型 | 标识 |
|---------|------|
| 付费路线 | - |
| 全员免费 | 绿色标签"全员免费" |
| 会员专享免费 + 无需保险 | 金色标签"会员专享 · 免保险" |
| 会员专享免费 + 需保险 | 金色标签"会员专享 · 需保险" |

---

## 五、接口变更

### 5.1 路线详情/列表接口

**响应字段新增**：
```json
{
  "code": 200,
  "data": {
    "id": 13,
    "name": "6月会员活动-夏日逃暑计划",
    "is_free": 1,
    "is_member_only": 1,
    "is_insurance_required": 0,
    "pet_insurance_price": 0.00,
    "person_insurance_price": 0.00,
    "cover_image": "...",
    "price": 0,
    ...
  }
}
```

### 5.2 创建订单接口

**请求字段新增**：
```json
{
  "route_id": 13,
  "route_price": 0,
  "insurance_price": 0,
  "is_free": 1,
  "is_member_only": 1,
  "is_insurance_required": 0,
  ...
}
```

**后端逻辑变更**：详见 4.2.2 需求 4

### 5.3 可用优惠券接口

**后端逻辑变更**：详见 4.2.2 需求 5

### 5.4 Admin 路线创建/编辑接口

**请求字段新增**：
```json
{
  "name": "夏日逃暑计划",
  "is_free": 1,
  "is_member_only": 1,
  "is_insurance_required": 0,
  "pet_insurance_price": 0.00,
  "person_insurance_price": 0.00,
  ...
}
```

---

## 六、边界情况

| 场景 | 预期行为 |
|------|---------|
| 会员过期后购买 | 按非会员价格计算（路线费+保险费） |
| 非会员用优惠券买会员专享 | 优惠券按原价计算门槛和折扣 |
| 会员买全员免费路线 | 仍免费（不受 `is_member_only` 影响） |
| 免费路线 + 无需保险 + 0 路线费 | 订单总价=0，直接标记已支付 |
| 会员专享 + 需保险 | 订单总价=保险费，状态=待支付 |
| 路线库存不足 | 与付费路线相同库存校验 |
| Admin 把已发布路线改为会员专享 | 仅影响新订单，历史订单不变 |
| Admin 关闭保险（`is_insurance_required=0`） | 该路线不再收取任何保险费 |
| Admin 修改保险单价 | 仅影响新订单，历史订单保险金额不变 |
| 小程序旧版本访问 | 旧版本看不到新字段，默认按全员免费 + 硬编码保险处理 |

---

## 七、测试用例

### 7.1 会员专享功能测试

| 用例 ID | 场景 | 操作 | 预期结果 |
|---------|------|------|---------|
| TC-01 | 会员购买会员专享免费 + 需保险 | 会员下单 | 路线费=0，保险费=正常，订单=待支付 |
| TC-02 | 会员购买会员专享免费 + 无需保险 | 会员下单 | 路线费=0，保险费=0，订单=已支付 |
| TC-03 | 非会员购买会员专享免费 + 需保险 | 非会员下单 | 路线费=原价，保险费=正常，订单=待支付 |
| TC-04 | 非会员购买会员专享免费 + 无需保险 | 非会员下单 | 路线费=原价，保险费=0，订单=待支付 |
| TC-05 | 全员免费 + 无需保险 | 任意用户下单 | 路线费=0，保险费=0，订单=已支付 |
| TC-06 | 全员免费 + 需保险 | 任意用户下单 | 路线费=0，保险费=正常，订单=待支付 |
| TC-07 | 付费路线 + 需保险 | 任意用户下单 | 路线费=原价，保险费=正常，订单=待支付 |
| TC-08 | 付费路线 + 无需保险 | 任意用户下单 | 路线费=原价，保险费=0，订单=待支付 |

### 7.2 保险配置测试

| 用例 ID | 场景 | 操作 | 预期结果 |
|---------|------|------|---------|
| TC-09 | 修改宠物保险单价为 20 | Admin 编辑路线 | 小程序展示 ¥20/只，订单按 ¥20 计算 |
| TC-10 | 关闭保险 | Admin 设置 `is_insurance_required=0` | 小程序不展示保险，订单保险费=0 |
| TC-11 | 保险单价为 0 | Admin 设置单价为 0 | 订单保险费=0，但字段仍存在 |

### 7.3 兼容性测试

| 用例 ID | 场景 | 预期结果 |
|---------|------|---------|
| TC-12 | 历史免费订单查看 | 价格展示正确，保险=0 |
| TC-13 | Admin 编辑旧路线 | 新字段默认值为兼容值（`is_member_only=0`, `is_insurance_required=1`） |
| TC-14 | 小程序旧版本访问 | 旧版本默认按全员免费 + 硬编码保险处理 |

---

## 八、风险评估与应对

| 风险 | 等级 | 影响 | 应对方案 |
|------|------|------|---------|
| 现有免费路线用户投诉 | 🟡 中 | 非会员原本完全免费，现在需付费 | 现有 2 条路线设 `is_insurance_required=0`，保持**完全免费不变**；仅影响未来新路线 |
| 保险单价配置错误 | 🟡 中 | 运营误填为负数或极高价格 | 表单校验 `min=0`，输入框限制范围 |
| 数据迁移遗漏 | 🟢 低 | 部分路线保险配置不正确 | 迁移脚本 + 人工核对 + Admin 可手动修正 |
| 会员状态判断延迟 | 🟢 低 | 高并发时会员查询慢 | 会员状态可缓存到 JWT token 或 Redis |
| 小程序版本兼容 | 🟡 中 | 旧版本看不到新字段 | 后端对旧版本返回默认值，旧版本按原有逻辑处理 |
| 优惠券逻辑混乱 | 🟡 中 | 会员专享路线的折扣基础计算错误 | 重点测试非会员使用优惠券的场景 |

---

## 九、上线计划

| 阶段 | 任务 | 负责人 | 预计时间 |
|------|------|--------|---------|
| 1 | 数据库迁移 + 后端 Model/Schema | 后端 | 0.5 天 |
| 2 | 订单服务价格计算 + 优惠券逻辑 | 后端 | 0.5 天 |
| 3 | 小程序前端（路线详情 + 订单确认 + 订单详情） | 前端 | 1 天 |
| 4 | Admin 后台（路线编辑 + 列表 + 保险配置） | 前端 | 1 天 |
| 5 | 联调测试（重点：会员/非会员/保险配置组合） | 全组 | 1 天 |
| 6 | 灰度发布 + 观察 | 运维 | 1 天 |

**总计**：约 5 个工作日

---

## 十、附录

### 10.1 相关表结构

```sql
-- routes（路线表）
CREATE TABLE routes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  is_free TINYINT(1) DEFAULT 0 COMMENT '0付费 1免费',
  is_member_only TINYINT(1) DEFAULT 0 COMMENT '0所有人可免费 1仅限会员免费',
  is_insurance_required TINYINT(1) DEFAULT 1 COMMENT '0不需要保险 1需要保险',
  pet_insurance_price DECIMAL(10,2) DEFAULT 15.00 COMMENT '宠物保险单价',
  person_insurance_price DECIMAL(10,2) DEFAULT 10.00 COMMENT '人身保险单价',
  base_price DECIMAL(10,2),
  ...
);

-- user_memberships（用户会员表）
CREATE TABLE user_memberships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  status TINYINT(1) DEFAULT 1 COMMENT '1生效中 2已过期',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  ...
);
```

### 10.2 配置示例

| 路线 | is_free | is_member_only | is_insurance_required | pet_price | person_price | 会员总价 | 非会员总价 |
|------|---------|---------------|----------------------|-----------|-------------|---------|-----------|
| 夏日逃暑计划 | 1 | 1 | 0 | 0 | 0 | ¥0 | ¥原价 |
| 动物音乐节 | 1 | 1 | 0 | 0 | 0 | ¥0 | ¥原价 |
| 未来会员活动A | 1 | 1 | 1 | 15 | 10 | ¥0+保险 | ¥原价+保险 |
| 未来全员活动B | 1 | 0 | 1 | 15 | 10 | ¥0+保险 | ¥0+保险 |
| 常规付费路线 | 0 | 0 | 1 | 15 | 10 | ¥原价+保险 | ¥原价+保险 |
| 特殊活动路线 | 0 | 0 | 0 | 0 | 0 | ¥原价 | ¥原价 |

### 10.3 接口文档链接

- 路线详情：`GET /api/v1/routes/{id}`
- 创建订单：`POST /api/v1/orders`
- 可用优惠券：`POST /api/v1/coupons/available-for-order`
- 会员中心：`GET /api/v1/member/center`

---

**文档结束**
