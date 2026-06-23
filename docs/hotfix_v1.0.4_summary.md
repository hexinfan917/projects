# v1.0.4 热修复总结报告

**修复时间：** 2026-06-24  
**分支：** `hotfix/v1.0.4-order-bug`  
**基于版本：** v1.0.4 (eee2a59)  
**部署状态：** 已部署上线

---

## 问题总览

本次热修复共解决 **10 个问题**，涵盖小程序前端、管理后台前端、后端 API 三个层面。

---

## 1. 单人轻旅默认带宠物

### 现象
选择「单人轻旅（无宠）」套餐提交订单时，系统默认带上了宠物。

### 原因
`loadPets()` 函数从 `bookingParams` state 读取 `packageType` 判断是否为单人轻旅，但 `bookingParams` 是异步 state，在 `loadPets` 执行时可能尚未初始化，导致误判为普通套餐，从而加载了默认宠物。

### 修复
- `loadPets()` 改为直接从路由参数 `Taro.getCurrentInstance().router?.params` 读取 `packageType`
- `handleSubmit()` 增加兜底逻辑：单人轻旅强制 `pets: []`、`pet_count: 0`

**文件：** `frontend/miniapp/src/pages/orders/confirm/index.tsx`

---

## 2. 默认只选 1 位出行人

### 现象
订单确认页默认只选中 1 位出行人，但用户可能需要多位。

### 原因
出行人加载逻辑有缺陷，默认选中逻辑不正确。

### 修复
修复 `loadTravelers` 默认选中逻辑，确保按套餐需求正确选中出行人数量。

**文件：** `frontend/miniapp/src/pages/orders/confirm/index.tsx`

---

## 3. 提交订单 contact 不带 id_card

### 现象
订单提交时联系人信息没有携带身份证号，导致订单详情页不显示。

### 原因
`handleSubmit` 中组装 `contact` 对象时遗漏了 `id_card` 字段。

### 修复
在 `createOrder` 调用时确保 `contact` 包含 `id_card`。

**文件：** `frontend/miniapp/src/pages/orders/confirm/index.tsx`

---

## 4. 后端 422/400 错误显示 [object Object]

### 现象
后端返回校验错误时，前端提示框显示 `[object Object]` 而不是具体错误信息。

### 原因
错误处理逻辑没有正确解析后端返回的 JSON 错误对象，直接调用了 `String(error)`。

### 修复
统一错误格式化逻辑，正确提取后端返回的错误详情文字。

**文件：** `frontend/miniapp/src/utils/api.ts`

---

## 5. 宠物档案删除按钮不灵敏

### 现象
点击宠物档案页的删除按钮没有反应或需要多次点击。

### 原因
删除按钮的点击事件没有阻止冒泡，可能被父级元素的点击事件拦截。

### 修复
在删除按钮的 `onClick` 中添加 `stopPropagation()`。

**文件：** `frontend/miniapp/src/pages/profile/pets/index.tsx`

---

## 6. 首次添加宠物自动设为默认

### 现象
用户第一次添加宠物时，系统自动将其设为默认宠物，即使用户没有勾选。

### 原因
后端 `create_pet` 方法中强制逻辑：如果用户没有现有宠物，自动将新宠物 `is_default = 1`。

### 修复
删除后端强制默认逻辑，让 `is_default` 完全由用户选择决定。

**文件：** `backend/user-service/app/services/pet.py`

---

## 7. 首次添加出行人自动设为默认

### 现象
用户第一次添加出行人时，系统自动将其设为默认出行人，即使用户没有勾选。

### 原因
后端 `create_traveler` 方法中强制逻辑：如果用户没有现有出行人，自动将新出行人 `is_default = 1`。

### 修复
删除后端强制默认逻辑，让 `is_default` 完全由用户选择决定。

**文件：** `backend/user-service/app/services/traveler.py`

---

## 8. 订单详情页身份证号被默认出行人覆盖

### 现象
订单详情页显示的身份证号不是订单提交时的联系人身份证号，而是默认出行人的身份证号。

### 原因
后端订单详情接口在组装联系人信息时，无条件用默认出行人的身份证号覆盖订单本身的 `contact.id_card`。

### 修复
改为仅在订单 `contact` 本身没有 `id_card` 时才用默认出行人兜底补充。

```python
# 修复前
contact = {**contact, "id_card": contact_id_card}

# 修复后
if contact_id_card and isinstance(contact, dict) and not contact.get('id_card'):
    contact = {**contact, "id_card": contact_id_card}
```

**文件：** `backend/order-service/main.py`

---

## 9. 订单详情页不显示出行方式

### 现象
小程序和后台管理订单详情页都没有显示「出行方式」字段。

### 原因
- **前端**：没有添加出行方式的 UI 展示
- **后端 admin 接口**：返回数据遗漏了 `travel_type` 字段

### 修复
- 小程序订单详情页新增出行方式展示（大巴出行/自行前往）
- 管理后台订单详情 Modal 新增出行方式展示
- 后端 admin 订单详情接口补充 `travel_type` 字段

**文件：**
- `frontend/miniapp/src/pages/orders/detail/index.tsx`
- `frontend/admin/src/pages/Orders/index.tsx`
- `backend/order-service/main.py`

---

## 10. 订单详情页只显示 1 个出行人（两人一宠时）

### 现象
订单详情页「出行人与宠物」区域只显示 1 个出行人，但订单实际是 2 人。

### 原因
前端代码只渲染了 `order.contact`（单个联系人），没有遍历 `order.participants`（所有出行人列表）。

### 修复
- 修改订单详情页，遍历显示 `order.participants` 中的所有出行人
- 同时保留 `order.contact` 作为「联系人」（账号主人，用于平台联系）单独展示
- 每个出行人显示姓名、身份证号、手机号

**文件：** `frontend/miniapp/src/pages/orders/detail/index.tsx`

---

## 11. 联系人显示为第一个出行人而非账号主人

### 现象
订单详情页「联系人」显示的是张清清（第一个出行人），但账号主人是帆帆（手机号 18734729308）。

### 原因
订单确认页提交时，将 `selectedTravelers[0]`（第一个选中的出行人）设为 `contact`，而不是账号主人。同时 `participants` 被设为 `selectedTravelers.slice(1)`，漏掉了第一个出行人。

### 修复
- 订单确认页新增获取用户信息 `getUserProfile()`
- 联系人（contact）使用账号主人的信息（`real_name`、`phone`、`id_card`）
- 出行人（participants）包含所有选中的出行人（不再排除第一个）

**文件：** `frontend/miniapp/src/pages/orders/confirm/index.tsx`

---

## 部署记录

| 时间 | 操作 | 结果 |
|------|------|------|
| 第一次 | 全量部署所有服务 | ✅ 成功（5m57s）|
| 第二次 | 全量部署（补充 travel_type）| ❌ 超时（300s）|
| 手动 | 启动所有 Docker 服务 | ✅ 成功 |
| 第三次 | 单独部署 user-service | ❌ 超时（300s）|
| 手动 | 启动 user-service | ✅ 成功 |
| 后续 | 小程序前端构建 | ✅ 多次成功 |

**注意：** Docker 构建在导出镜像层时容易超时，建议后续将超时时间设置为 600 秒以上。

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `frontend/miniapp/src/pages/orders/confirm/index.tsx` | 单人轻旅不带宠物、默认出行人、contact 带 id_card、联系人使用账号主人 |
| `frontend/miniapp/src/pages/orders/detail/index.tsx` | 显示所有出行人、显示联系人、显示出行方式 |
| `frontend/miniapp/src/pages/orders/detail/index.scss` | 出行人分隔样式 |
| `frontend/miniapp/src/pages/profile/pets/index.tsx` | 删除按钮 stopPropagation |
| `frontend/miniapp/src/utils/api.ts` | 错误格式化 |
| `frontend/admin/src/pages/Orders/index.tsx` | 出行方式展示 |
| `backend/order-service/main.py` | 身份证号修复、travel_type 字段、admin travel_type |
| `backend/user-service/app/services/pet.py` | 删除强制默认宠物逻辑 |
| `backend/user-service/app/services/traveler.py` | 删除强制默认出行人逻辑 |

---

## 测试建议

1. **单人轻旅**：选择单人轻旅套餐，确认不自动带宠物
2. **默认出行人**：首次添加出行人不勾选默认，确认不自动默认
3. **身份证号**：提交订单带身份证号，详情页正确显示
4. **两人一宠**：选择 2 位出行人，订单详情页显示所有出行人
5. **联系人**：确认联系人显示账号主人（手机号 18734729308）而非第一个出行人
6. **出行方式**：订单详情页正确显示「大巴出行」或「自行前往」
7. **后台管理**：订单列表和详情正确显示出行方式
