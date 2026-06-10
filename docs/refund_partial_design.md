# 部分退款功能设计方案

## 一、业务场景分析

基于现有宠物旅行活动平台的业务特点，部分退款的典型场景：

| 场景 | 说明 | 优先级 |
|------|------|--------|
| 扣手续费退款 | 用户临近出行取消，扣除 X% 手续费后退剩余 | 高 |
| 退装备/保险/选配 | 用户临时不需要装备租赁、保险或选配服务 | 高 |
| 部分出行人取消 | 订单含多人，部分人不去，退对应人数费用 | 中 |
| 活动变动补偿 | 活动改期/调整，管理员主动退差价或补偿 | 中 |

## 二、现有系统现状

### 2.1 订单金额结构
```
total_amount = route_price + insurance_price + equipment_price + addon_amount
pay_amount   = total_amount - discount_amount - member_discount_amount
```

### 2.2 退款现状
- **用户端**：申请退款时 `refund_amount = pay_amount`，强制全额
- **Admin 端**：接口预留了 `refund_type='partial'` 参数，但前端未使用
- **数据库**：只有 `orders.refund_amount` 一个字段，无退款明细
- **支付**：微信 V3 API 原生支持部分退款

### 2.3 限制
- 无子订单/子项概念，无法按"装备/保险"维度精确退款
- 一笔订单只能记录一笔退款
- 优惠券恢复逻辑绑定全额退款

## 三、推荐方案：多笔部分退款

### 3.1 核心设计原则
1. **简化模型**：管理员直接输入退款金额 + 原因，不强制绑定具体项目
2. **多笔支持**：一笔订单可分多次退，累计不超过 pay_amount
3. **向后兼容**：现有全额退款流程完全保留
4. **最小改动**：数据库仅新增一张表 + 一个字段

### 3.2 数据库变更

#### 新增 refund_records 表
```sql
CREATE TABLE refund_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL COMMENT '关联订单ID',
  refund_no VARCHAR(32) NOT NULL UNIQUE COMMENT '退款单号',
  amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
  reason VARCHAR(500) COMMENT '退款原因',
  type VARCHAR(20) DEFAULT 'partial' COMMENT 'full-全额 partial-部分',
  status TINYINT DEFAULT 10 COMMENT '10-处理中 20-成功 30-失败',
  transaction_id VARCHAR(64) COMMENT '微信退款单号',
  fail_reason VARCHAR(500) COMMENT '失败原因',
  operator_id BIGINT COMMENT '操作人ID(管理员)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_refund_no (refund_no),
  INDEX idx_status (status)
);
```

#### 修改 orders 表
```sql
-- 新增累计已退金额字段（已有 refund_amount 表示最近一次/当前退款金额）
ALTER TABLE orders ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0 COMMENT '累计已退金额';
```

### 3.3 状态流转

```
用户申请退款:          待出行(20) → 退款中(40)
                         ↓
Admin 全额通过:        退款中(40) → 已退款(50)
Admin 部分通过:        退款中(40) → 部分退款(55) → 待出行(20)可继续退
Admin 最后一笔退完:    部分退款(55) → 已退款(50)
Admin 拒绝:            退款中(40) → 退款驳回(45)
```

**关键规则**：
- 状态 55（部分退款）= 已有退款成功，但累计金额 < pay_amount，订单仍可正常使用/继续退
- 状态 50（已退款）= 累计退款 = pay_amount，订单关闭
- 优惠券恢复逻辑：仅当 `refunded_amount == pay_amount` 时恢复

### 3.4 API 设计

#### 用户端（不变）
| 端点 | 说明 |
|------|------|
| POST /api/v1/orders/{id}/refund | 仍申请全额退款，状态变 40 |

#### Admin 端（新增/修改）
| 端点 | 说明 |
|------|------|
| POST /api/v1/admin/refunds/{id}/approve | 修改为支持选择"全额"或"部分" |
| POST /api/v1/admin/refunds/{id}/partial | **新增**：部分退款，指定金额 |
| GET /api/v1/admin/refunds | 返回退款列表（含部分退款订单） |
| GET /api/v1/admin/orders/{id} | 返回订单详情 + refund_records 列表 |

#### 支付服务（不变）
| 端点 | 说明 |
|------|------|
| POST /api/v1/pay/refund | 已支持任意 refund_amount，无需改动 |

#### 部分退款请求示例
```json
{
  "refund_amount": 99.00,
  "reason": "用户临时取消保险服务",
  "type": "partial"
}
```

### 3.5 校验规则

```python
# 部分退款金额校验
assert refund_amount > 0, "退款金额必须大于0"
assert refund_amount <= order.pay_amount, "退款金额不能超过实付金额"
assert order.refunded_amount + refund_amount <= order.pay_amount, "累计退款不能超过实付金额"
```

### 3.6 Admin UI 设计

**退款审核弹窗**：
```
┌─────────────────────────────┐
│ 订单号: ORD20240601xxx       │
│ 实付金额: ¥299.00            │
│ 已退金额: ¥0.00              │
│ 剩余可退: ¥299.00            │
├─────────────────────────────┤
│ [○] 全额退款  [●] 部分退款   │
│ 退款金额: [________] 元      │
│ 退款原因: [______________]   │
├─────────────────────────────┤
│      [确认退款] [取消]       │
└─────────────────────────────┘
```

**退款记录展示**（订单详情页新增）：
| 退款单号 | 金额 | 类型 | 状态 | 操作人 | 时间 |
|---------|------|------|------|--------|------|
| REF001 | ¥99 | 部分 | 成功 | admin | 2024-06-01 |
| REF002 | ¥200 | 部分 | 成功 | admin | 2024-06-02 |

### 3.7 用户端展示

订单详情增加退款记录区域：
```
实付金额: ¥299.00
已退金额: ¥99.00
实付净额: ¥200.00

退款记录:
- 2024-06-01 退款 ¥99.00 (原因: 取消保险)
```

## 四、备选方案对比

| 维度 | 方案A(推荐): 多笔部分退款 | 方案B: 按项目维度退款 | 方案C: 单笔部分退款 |
|------|------------------------|---------------------|-------------------|
| 改动量 | 中（+1表 +1字段 +3接口） | 大（需拆子订单） | 小（改1接口） |
| 灵活性 | 高（任意金额任意次数） | 高（精确到项目） | 低（只能退一次） |
| 适用场景 | 扣手续费、退装备、补偿 | 精确退装备/保险 | 仅支持扣手续费 |
| 实现复杂度 | 中 | 高 | 低 |
| 微信支持 | 完全支持 | 完全支持 | 完全支持 |

## 五、实施步骤建议

1. **数据库迁移**：新增 refund_records 表 + orders.refunded_amount 字段
2. **后端 API**：
   - 修改 approve 接口支持 partial
   - 新增 partial 退款专用接口
   - 修改订单详情返回退款记录
3. **Admin 前端**：
   - 退款审核弹窗增加"部分退款"选项
   - 订单详情增加退款记录列表
4. **用户端小程序**：
   - 订单详情增加"已退金额"和退款记录展示
5. **测试**：
   - 全额退款流程回归测试
   - 部分退款（一笔、多笔）测试
   - 金额边界校验测试
