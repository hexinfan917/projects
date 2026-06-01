# 尾巴旅行 PetWay 产品文档 v1.0

> 本文档基于 v1.0.0 版本，详细描述所有已上线功能的业务逻辑、交互细节和技术实现。

---

## 目录

1. [产品概述](#1-产品概述)
2. [用户系统](#2-用户系统)
3. [路线与行程系统](#3-路线与行程系统)
4. [预订与价格系统](#4-预订与价格系统)
5. [订单系统](#5-订单系统)
6. [支付系统](#6-支付系统)
7. [会员与优惠券系统](#7-会员与优惠券系统)
8. [内容系统](#8-内容系统)
9. [管理后台](#9-管理后台)
10. [技术架构](#10-技术架构)
11. [数据库模型](#11-数据库模型)

---

## 1. 产品概述

### 1.1 产品定位
尾巴旅行（PetWay）是一个宠物友好型出行平台，专注于为宠物主人提供带宠出行的旅游路线和服务。平台支持大巴出行和自驾两种交通方式，提供一人一宠、一人两宠、二人一宠等多种套餐选择。

### 1.2 核心业务流程

```
用户注册/登录 → 浏览路线 → 选择日期/排期 → 选择套餐/交通方式
    → 添加出行人/宠物 → 选择Addon → 确认订单 → 支付 → 出行
```

### 1.3 用户角色

| 角色 | 说明 |
|------|------|
| 普通用户 | 小程序端消费者，浏览路线、下单、支付 |
| 管理员 | 管理后台运营人员，管理路线/订单/用户/内容 |

---

## 2. 用户系统

### 2.1 注册与登录

#### 2.1.1 登录方式
- **手机号快捷登录**：调用微信小程序 `getPhoneNumber` 组件，获取用户授权手机号
- **登录流程**：
  1. 用户点击「手机号快捷登录」按钮
  2. 调用微信 `getPhoneNumber` 获取加密手机号数据
  3. 后端解密手机号，同时获取微信 `code` 换取 `openid`
  4. 查询数据库：若手机号/ openid 已存在则直接登录；若不存在则创建新用户
  5. 返回 `access_token` 和用户信息

#### 2.1.2 新用户引导
- 新用户首次登录后，弹出「完善资料」弹窗
- 要求填写：昵称、头像
- 头像支持：从相册选择或拍照上传
- 昵称支持：手动输入或使用微信昵称（`type='nickname'` 输入框）
- 用户可选择「稍后再说」跳过，但下次进入小程序时仍会提示

#### 2.1.3 Token 机制
- 登录成功后，小程序本地存储 `access_token`（JWT）
- 每次 API 请求携带 `Authorization: Bearer <token>` 头部
- Token 有效期由后端控制，过期后需重新登录

### 2.2 用户资料

#### 2.2.1 基本信息
| 字段 | 说明 | 来源 |
|------|------|------|
| nickname | 昵称 | 用户填写/微信昵称 |
| avatar | 头像 URL | 用户上传/微信头像 |
| phone | 手机号 | 微信授权获取 |
| real_name | 真实姓名 | 用户填写 |
| id_card | 身份证号 | 用户填写 |
| gender | 性别（0母/1公） | 用户选择 |
| birthday | 生日 | 用户选择 |
| city | 城市 | 用户填写 |
| member_level | 会员等级 | 系统计算 |
| member_points | 会员积分 | 系统计算 |

#### 2.2.2 资料编辑
- 个人中心 → 编辑资料：可修改昵称、头像、性别、生日、城市
- 完善实名信息：真实姓名、身份证号（用于保险和出行人同步）

### 2.3 宠物管理

#### 2.3.1 宠物档案
- 每只宠物独立建档
- 字段：名称、品种、性别、生日、体重、疫苗情况、备注
- 支持上传宠物头像
- 宠物档案与出行人档案独立管理

#### 2.3.2 宠物与出行人的关联
- 下单时从宠物档案中选择携带的宠物
- 每只宠物可关联到具体出行人（谁带这只宠物）

### 2.4 出行人管理

#### 2.4.1 出行人档案
- 字段：姓名、手机号、身份证号
- 支持从用户资料同步（如果用户已填写实名信息）
- 支持手动新增出行人

#### 2.4.2 出行人同步逻辑
- 当用户完善个人资料中的实名信息时，系统自动同步到出行人档案
- 避免用户重复填写相同的身份信息

---

## 3. 路线与行程系统

### 3.1 路线模型

#### 3.1.1 路线基本信息
| 字段 | 说明 |
|------|------|
| route_no | 路线编号（唯一） |
| name | 路线名称 |
| route_type | 路线类型（枚举） |
| title | 副标题 |
| subtitle | 简介 |
| cover_image | 封面图 |
| gallery | 图集（JSON数组） |
| description | 详细描述（富文本） |
| highlights | 行程亮点（JSON） |
| highlights_detail | 亮点详情（富文本） |
| fee_description | 费用说明 |
| fee_include | 费用包含 |
| fee_exclude | 费用不包含 |
| notice | 注意事项 |
| duration | 行程时长 |
| difficulty | 难度等级（1-5） |
| min_participants | 最少成团人数 |
| max_participants | 最多人数 |
| is_hot | 是否热门 |
| status | 状态（1正常/0禁用/-1删除） |
| sort_order | 排序权重 |
| content_modules | 内容模块（JSON） |

#### 3.1.2 路线类型
- 支持自定义路线类型（如：溯溪、漂流、徒步、祈福等）
- 管理后台可增删改路线类型

### 3.2 排期管理

#### 3.2.1 排期基础信息
- 每条路线可配置多个排期（不同出发日期）
- 排期字段：schedule_date（日期）、start_time（开始时间）、end_time（结束时间）、stock（库存）、status（状态）

#### 3.2.2 排期级价格（v1.0 核心重构）
**所有价格完全下放到排期级别**，不再从路线默认价读取。

| 字段 | 说明 |
|------|------|
| price | 大巴一人一宠基础价 |
| self_drive_price | 自驾一人一宠基础价 |
| single_person_price | 大巴单人轻旅价 |
| two_person_one_pet_price | 大巴二人一宠价 |
| one_person_two_pet_price | 大巴一人两宠价 |
| single_pet_price | 大巴毛孩专属价 |
| extra_person_price | 大巴额外加人单价 |
| extra_pet_price | 大巴额外加宠单价 |
| self_drive_single_person_price | 自驾单人轻旅价 |
| self_drive_two_person_one_pet_price | 自驾二人一宠价 |
| self_drive_one_person_two_pet_price | 自驾一人两宠价 |
| self_drive_single_pet_price | 自驾毛孩专属价 |
| self_drive_extra_person_price | 自驾额外加人单价 |
| self_drive_extra_pet_price | 自驾额外加宠单价 |
| addon_prices | Addon动态定价（JSON：{addon_code: price}） |

#### 3.2.3 排期价格读取优先级
1. 排期级价格 > 路线默认价（已切断回退链）
2. 若排期价格未配置或为 0，显示 0 或"未配置"
3. 小程序不再回退到 `route.base_price`

#### 3.2.4 Addon 动态定价
- 每个排期可独立配置 Addon 价格
- 优先级：`schedule.addon_prices[addon.code]` > `addon.price`（路线默认价）
- 不填排期价则自动使用路线默认价

### 3.3 行程选配（Addon）

#### 3.3.1 Addon 分类
- 支持分类管理（如：酒店、门票、餐饮、座位票等）
- 每个 Addon 属于一个分类

#### 3.3.2 Addon 类型
| 类型 | 说明 |
|------|------|
| 普通 Addon | 简单的数量选择（如：座位票） |
| dog_ticket | 狗狗门票，支持多选项（如：小型犬/中型犬/大型犬） |
| hotel | 酒店房型，支持多房间选择 |

#### 3.3.3 Addon 配置字段
- name（名称）、code（编码）、price（默认价格）、category（分类）
- extra_config（扩展配置）：针对 hotel 和 dog_ticket 的特殊配置
- 路线可关联多个 Addon

---

## 4. 预订与价格系统

### 4.1 BookingPopup 预订弹窗

#### 4.1.1 日期选择
- 显示最近的有效排期（按日期升序）
- 日历弹窗：纵向排列月份，可滚动切换
- 日期显示格式：`MM/DD`
- 过期排期（无未来排期）显示"暂无营期"，预订按钮禁用
- 选择日期后自动触发 `scrollIntoView` 定位到对应月份

#### 4.1.2 交通方式选择
- 大巴出行 / 自行前往（自驾）
- 不同交通方式对应不同的价格字段（`price` vs `self_drive_price`）
- 自驾时过滤掉「毛孩专属接送（无主人陪同）」套餐（因为自驾必须有主人）

#### 4.1.3 套餐选择
| 套餐 | 基础人数 | 基础宠物数 | 价格字段 |
|------|---------|-----------|---------|
| 一人一宠 | 1 | 1 | price / self_drive_price |
| 一人两宠 | 1 | 2 | one_person_two_pet_price |
| 二人一宠 | 2 | 1 | two_person_one_pet_price |
| 单人轻旅（无宠） | 1 | 0 | single_person_price |
| 毛孩专属接送（无主人） | 0 | 1 | single_pet_price |

- 套餐价格完全从排期对应字段读取
- 未配置价格的套餐显示"未配置"，不可选

#### 4.1.4 额外人数选择
- 增加成人：步进器（- / 数量 / +），单价 = `extra_person_price`
- 增加宠物：步进器，单价 = `extra_pet_price`
- 价格实时计算并显示

#### 4.1.5 Addon 选择
- 列出路线关联的所有 Addon
- 价格优先级：排期级 `addon_prices[code]` > 路线默认 `addon.price`
- 普通 Addon：数量选择
- dog_ticket：多选项选择
- hotel：房间数量选择

#### 4.1.6 价格计算（BookingPopup）
```
路线价 = 套餐基础价 + extraPerson × extra_person_price + extraPet × extra_pet_price
总价 = 路线价 + Σ(addon_price × addon_quantity)
```

### 4.2 价格字段映射

#### 4.2.1 套餐价格字段映射
```
couple          → price / self_drive_price
one_person_two_pet → one_person_two_pet_price / self_drive_one_person_two_pet_price
two_person_one_pet → two_person_one_pet_price / self_drive_two_person_one_pet_price
single_person   → single_person_price / self_drive_single_person_price
single_pet      → single_pet_price / self_drive_single_pet_price
```

#### 4.2.2 额外价格字段映射
```
大巴出行: extra_person_price, extra_pet_price
自驾出行: self_drive_extra_person_price, self_drive_extra_pet_price
```

---

## 5. 订单系统

### 5.1 订单创建流程

#### 5.1.1 订单确认页（/orders/confirm）
- 从 BookingPopup 携带参数跳转：`packageType`, `travelType`, `scheduleId`, `extraPerson`, `extraPet`, `totalPrice`, `addons`

#### 5.1.2 出行人/宠物选择
- 从档案中选择出行人和宠物
- 支持新增出行人/宠物（临时添加，保存到档案）
- 默认第一个出行人为联系人（订单联系人）

#### 5.1.3 保险服务（必选）
- 宠物意外险：¥15/只，按实际选中宠物数计算
- 人身意外险：¥10/人，按实际选中出行人数计算
- 保险不可取消

#### 5.1.4 优惠券
- 显示可用优惠券列表
- 自动选中最优优惠券
- 优惠券不适用时自动取消选中

#### 5.1.5 已选信息展示
- 套餐类型、交通方式、额外增加（动态计算）、行程选配

#### 5.1.6 价格计算（订单确认页）
```
// 额外数量 = max(BookingPopup选择, 实际差额)
extraPersonCount = max(bookingParams.extraPerson, selectedTravelers.length - basePerson)
extraPetCount = max(bookingParams.extraPet, selectedPetIds.length - basePet)

routePrice = basePrice + extraPersonCount × extraPersonUnitPrice + extraPetCount × extraPetUnitPrice
insurance = 15 × selectedPetIds.length + 10 × selectedTravelers.length
addonTotal = Σ(addon_price × quantity)
total = routePrice + insurance + addonTotal - couponDiscount
```

#### 5.1.7 人数校验（提交时）
```
requiredPersons = basePerson + bookingParams.extraPerson
requiredPets = basePet + bookingParams.extraPet

selectedTravelers.length >= requiredPersons
selectedPetIds.length >= requiredPets
```

### 5.2 订单模型

#### 5.2.1 订单字段
| 字段 | 说明 |
|------|------|
| order_no | 订单编号 |
| user_id | 用户ID |
| route_id | 路线ID |
| schedule_id | 排期ID |
| travel_type | 交通方式（bus/self_drive） |
| package_type | 套餐类型 |
| participant_count | 出行人数 |
| pet_count | 宠物数 |
| route_price | 路线价格 |
| addon_amount | Addon总价 |
| insurance_amount | 保险总价 |
| coupon_id | 优惠券ID |
| coupon_discount | 优惠券抵扣 |
| total_amount | 订单总价 |
| status | 订单状态 |
| contact_name | 联系人姓名 |
| contact_phone | 联系人电话 |
| participants | 出行人列表（JSON） |
| pets | 宠物列表（JSON） |
| addons | Addon列表（JSON） |
| agreements | 已同意协议列表 |

#### 5.2.2 订单状态
| 状态码 | 含义 |
|--------|------|
| 10 | 待支付 |
| 20 | 已支付/待确认 |
| 30 | 已确认 |
| 40 | 进行中 |
| 50 | 已完成 |
| 60 | 已取消 |
| 70 | 退款中 |
| 80 | 已退款 |
| 90 | 测试/取消（测试订单标记） |

### 5.3 订单列表与详情

#### 5.3.1 订单列表
- 按状态分类：全部/待支付/进行中/已完成
- 显示订单基本信息：路线名称、日期、价格、状态

#### 5.3.2 订单详情
- 完整的订单信息展示
- 出行人/宠物信息
- 价格明细（基础价、额外人/宠、Addon、保险、优惠券）
- 支付状态和操作按钮

---

## 6. 支付系统

### 6.1 微信支付

#### 6.1.1 支付流程
1. 用户提交订单，后端创建订单
2. 调用微信支付统一下单接口
3. 返回小程序调起支付所需的参数
4. 小程序调用 `wx.requestPayment`
5. 支付成功后，微信回调通知后端
6. 后端更新订单状态为「已支付」

#### 6.1.2 支付配置
- 微信支付商户号：MCHID
- API 密钥
- 证书文件（apiclient_cert.pem, apiclient_key.pem）
- 支付回调地址

### 6.2 虚拟支付（会员购买）

#### 6.2.1 适用场景
- **会员套餐购买**：使用微信小程序虚拟支付能力，避免审核驳回
- 虚拟支付能力已开通（OfferID: 1450546337）

#### 6.2.2 支付流程
1. 用户选择会员套餐，创建会员购买订单
2. 后端调用虚拟支付接口生成 `signData` + `paySig` + `signature`
3. 小程序调用 `wx.requestVirtualPayment({ mode: 'short_series_goods' })`
4. 支付成功后，前端调用 `/api/v1/pay/virtual/confirm` 确认
5. 后端通知 order-service 开通会员
6. 微信服务器回调 `/api/v1/pay/virtual/notify`（兜底）

#### 6.2.3 支付配置
- OfferID：`1450546337`
- AppKey：现网密钥（配置在环境变量）
- 道具ID：`member_annual`（对应年度会员）
- 道具价格：0.01 元（测试价）/ 39.9 元（正式价）
- goodsPrice 单位：分（整数）

#### 6.2.4 价格一致性要求
管理后台售价、微信虚拟支付后台道具价格、数据库 `sale_price` 三者必须一致，否则支付时报 `GOODS_PRICE_INVALID`。

### 6.3 订单取消与退款

#### 6.2.1 取消规则
- 未支付订单：用户可直接取消
- 已支付订单：根据退订政策处理

#### 6.2.2 退款流程
- 用户申请退款
- 管理员审核
- 通过后调用微信退款接口
- 退款金额原路返回

---

## 7. 会员与优惠券系统

### 7.1 会员系统

#### 7.1.1 会员等级
- 根据消费金额或积分计算会员等级
- 不同等级享受不同权益

#### 7.1.2 会员购买流程
```
会员中心页 → 选择套餐 → 创建订单 → 调起虚拟支付
  → 支付成功 → 前端确认 → 开通会员 → 发放券包 → 跳转会员中心
```

- 购买前检查是否已有生效中会员
- 支付成功后创建 `user_memberships` 记录
- 同时发放套餐关联的优惠券包
- 若已有会员，则延长有效期（续费）

#### 7.1.3 会员权益
- 全场折扣（根据会员等级）
- 专属优惠券包
- 积分加倍

#### 7.1.4 会员积分
- 消费获得积分
- 积分可用于兑换或抵扣

### 7.2 优惠券系统

#### 7.2.1 优惠券类型
| 类型 | 说明 |
|------|------|
| 满减券 | 满 X 元减 Y 元 |
| 折扣券 | 按比例折扣 |
| 礼品券 | 特定服务免费 |

#### 7.2.2 优惠券使用规则
- 适用路线/套餐限制
- 有效期限制
- 最低消费金额限制
- 每人限领/限用次数

#### 7.2.3 自动选券
- 订单确认页自动筛选可用优惠券
- 自动选中最优优惠券（优惠金额最大）
- 当选中券不可用时自动取消选中

---

## 8. 内容系统

### 8.1 首页

#### 8.1.1 Banner 轮播
- 管理后台可配置 Banner
- 字段：标题、图片、链接、排序、状态

#### 8.1.2 推荐路线
- 热门路线（is_hot=1）
- 最近排期路线

### 8.2 文章系统

#### 8.2.1 文章类型
- 狗狗回顾（review）
- 其他自定义类型

#### 8.2.2 文章字段
- 标题、内容、封面图、分类、状态

### 8.3 公益活动

#### 8.3.1 公益活动管理
- 活动名称、描述、时间、地点、状态
- 用户可报名参加

---

## 9. 管理后台

### 9.1 用户管理

#### 9.1.1 用户列表
- 显示所有用户（包括禁用用户）
- 支持按昵称、手机号、会员状态筛选
- 操作：查看详情、编辑、删除（物理删除）

#### 9.1.2 用户详情
- 基本信息、宠物列表、出行人列表、订单记录

### 9.2 路线管理

#### 9.2.1 路线列表
- 创建、编辑、删除路线
- 设置路线类型、价格、排期

#### 9.2.2 路线编辑
- **基本信息**：名称、副标题、描述、封面、图集
- **行程亮点**：富文本编辑
- **费用说明**：包含/不包含/费用描述
- **注意事项**：富文本
- **内容模块**：可配置的模块化内容
- **营期管理**：排期列表和编辑（核心功能）
- **行程选配**：Addon 关联管理

#### 9.2.3 排期管理
- 排期列表：按日期升序排列
- 编辑排期：时间、库存、所有套餐价格、Addon 价格
- 新增排期：仅日期/时间/库存（简化表单）
- **编辑弹窗优化**：
  - `key={record.id}` 防止 Form 缓存旧数据
  - `editingField` 状态解决价格和库存共用 ID 问题
  - 只发送变更字段（`changedFields`）避免覆盖未修改价格

### 9.3 订单管理

#### 9.3.1 订单列表
- 查看所有订单
- 按状态筛选
- 操作：查看详情、确认、取消、退款

### 9.4 内容管理

#### 9.4.1 Banner 管理
- 增删改 Banner

#### 9.4.2 文章管理
- 增删改文章

#### 9.4.3 公益管理
- 增删改公益活动

### 9.5 系统管理

#### 9.5.1 协议管理
- 用户协议、隐私政策等
- 支持动态编辑和版本管理

#### 9.5.2 系统设置
- 基础配置项

---

## 10. 技术架构

### 10.1 微服务架构

```
┌─────────────────────────────────────────┐
│              API Gateway                 │
│         (petway-gateway)                 │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    │         │         │         │         │
┌───▼──┐ ┌───▼──┐ ┌───▼──┐ ┌───▼──┐ ┌───▼──┐
│user  │ │route │ │order │ │pay   │ │content│
│-svc  │ │-svc  │ │-svc  │ │-svc  │ │-svc  │
└──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
   │        │        │        │        │
   └────────┴────────┴────────┴────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼──┐ ┌───▼──┐ ┌───▼──┐
│mysql │ │redis │ │file  │
│      │ │      │ │-svc  │
└──────┘ └──────┘ └──┬───┘
                     │
                ┌────▼────┐
                │ uploads │
                └─────────┘
```

### 10.2 服务列表

| 服务 | 端口 | 职责 |
|------|------|------|
| gateway | 8000 | API 网关、路由转发、认证鉴权 |
| user-service | 8001 | 用户、认证、会员、宠物、出行人 |
| route-service | 8002 | 路线、排期、Addon、路线类型 |
| content-service | 8003 | 内容、Banner、文章、公益 |
| file-service | 8004 | 文件上传、静态资源 |
| order-service | 8005 | 订单、保险、优惠券 |
| pay-service | 8006 | 微信支付、退款 |
| message-service | 8007 | 消息、通知 |
| map-service | 8008 | 地图、POI |
| charity-service | 8009 | 公益活动、报名 |
| mysql | 3306 | 数据库 |
| redis | 6379 | 缓存、Session |

---

## 11. 数据库模型

### 11.1 核心表结构

#### 11.1.1 users（用户表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 用户ID |
| openid | varchar(64) | 微信openid |
| unionid | varchar(64) | 微信unionid |
| nickname | varchar(50) | 昵称 |
| phone | varchar(20) | 手机号 |
| avatar | varchar(500) | 头像URL |
| real_name | varchar(50) | 真实姓名 |
| id_card | varchar(18) | 身份证号 |
| gender | tinyint | 性别 |
| member_level | tinyint | 会员等级 |
| member_points | int | 积分 |
| status | tinyint | 状态（1正常/0禁用） |
| created_at | timestamp | 创建时间 |

#### 11.1.2 routes（路线表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 路线ID |
| route_no | varchar(20) | 路线编号 |
| name | varchar(100) | 路线名称 |
| route_type | tinyint | 路线类型 |
| cover_image | varchar(500) | 封面图 |
| description | longtext | 描述 |
| duration | varchar(20) | 时长 |
| min_participants | int | 最少人数 |
| max_participants | int | 最多人数 |
| is_hot | tinyint | 是否热门 |
| status | tinyint | 状态 |
| sort_order | int | 排序 |
| content_modules | json | 内容模块 |
| ... | ... | 其他字段 |

#### 11.1.3 route_schedules（路线排期表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 排期ID |
| route_id | bigint FK | 路线ID |
| schedule_date | date | 排期日期 |
| start_time | time | 开始时间 |
| end_time | time | 结束时间 |
| price | decimal(10,2) | 大巴基础价 |
| self_drive_price | decimal(10,2) | 自驾基础价 |
| single_person_price | decimal(10,2) | 大巴单人价 |
| two_person_one_pet_price | decimal(10,2) | 大巴二人一宠价 |
| one_person_two_pet_price | decimal(10,2) | 大巴一人两宠价 |
| single_pet_price | decimal(10,2) | 大巴单宠价 |
| extra_person_price | decimal(10,2) | 大巴加人价 |
| extra_pet_price | decimal(10,2) | 大巴加宠价 |
| self_drive_single_person_price | decimal(10,2) | 自驾单人价 |
| self_drive_two_person_one_pet_price | decimal(10,2) | 自驾二人一宠价 |
| self_drive_one_person_two_pet_price | decimal(10,2) | 自驾一人两宠价 |
| self_drive_single_pet_price | decimal(10,2) | 自驾单宠价 |
| self_drive_extra_person_price | decimal(10,2) | 自驾加人价 |
| self_drive_extra_pet_price | decimal(10,2) | 自驾加宠价 |
| addon_prices | json | Addon动态定价 |
| stock | int | 库存 |
| status | tinyint | 状态 |

#### 11.1.4 orders（订单表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 订单ID |
| order_no | varchar(32) | 订单编号 |
| user_id | bigint FK | 用户ID |
| route_id | bigint FK | 路线ID |
| schedule_id | bigint FK | 排期ID |
| travel_type | varchar(20) | 交通方式 |
| package_type | varchar(50) | 套餐类型 |
| participant_count | int | 出行人数 |
| pet_count | int | 宠物数 |
| route_price | decimal(10,2) | 路线价格 |
| addon_amount | decimal(10,2) | Addon金额 |
| insurance_amount | decimal(10,2) | 保险金额 |
| total_amount | decimal(10,2) | 总金额 |
| status | int | 订单状态 |
| contact_name | varchar(50) | 联系人姓名 |
| contact_phone | varchar(20) | 联系人电话 |
| participants | json | 出行人列表 |
| pets | json | 宠物列表 |
| addons | json | Addon列表 |
| created_at | timestamp | 创建时间 |

---

## 附录

### A. 版本变更记录

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.1.0 | 2026-06-01 | 接入微信小程序虚拟支付：会员购买改用 `wx.requestVirtualPayment`，支持真实支付和自动开通会员 |
| v1.0.0 | 2026-05-30 | 价格系统重构：排期级定价、Addon动态定价、订单人数校验、保险单位显示、审核合规修复 |

### B. 待优化项

1. **价格配置简化**：当前排期需要配置12个价格字段，操作繁琐，考虑提供批量配置或价格模板功能
2. **库存扣减**：当前未实现订单支付后的库存自动扣减
3. **退款自动化**：当前退款需要管理员手动操作，可考虑按规则自动退款
4. **订单评价**：订单完成后用户可评价
5. **消息通知**：支付成功、订单状态变更等消息推送

---

*文档更新时间：2026-06-01*
*对应版本：v1.1.0*
