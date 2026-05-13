# 尾巴旅行 - 产品技术文档 V5.0

## 一、系统架构

### 1.1 技术栈

| 层级 | 技术选型 |
|:---|:---|
| 小程序端 | Taro 3.x + React |
| 管理后台 | React 18 + Ant Design Pro |
| 后端服务 | Go 1.22 + Gin框架 |
| 数据库 | MySQL 8.0 + Redis 7 |
| 搜索引擎 | Elasticsearch 8.x |
| 对象存储 | 阿里云OSS + CDN |
| 消息队列 | RabbitMQ 3.12 |
| 直播/视频 | 腾讯云直播 + 云点播 |
| 地图服务 | 高德地图JS API 2.0 |

### 1.2 服务拆分

| 服务名 | 端口 | 职责 |
|:---|:---:|:---|
| user-service | 8001 | 用户注册/登录/档案/会员 |
| route-service | 8002 | 路线管理/库存/排期 |
| order-service | 8003 | 订单/支付/退款/发票 |
| map-service | 8004 | POI数据/路线规划 |
| content-service | 8005 | 内容管理/UGC/直播 |
| pay-service | 8006 | 支付通道/对账/分账 |
| message-service | 8007 | 短信/推送/站内信 |
| file-service | 8008 | 文件上传/处理/分发 |
| charity-service | 8009 | 公益信息展示（轻量） |

## 二、数据库设计

### 2.1 用户相关表

#### users 用户表

```sql
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL COMMENT '微信openid',
  unionid VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
  nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  avatar VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  gender TINYINT DEFAULT 0 COMMENT '0未知 1男 2女',
  birthday DATE DEFAULT NULL,
  city VARCHAR(50) DEFAULT NULL,
  member_level TINYINT DEFAULT 0 COMMENT '0新手上路 1爱好者 2资深 3大使',
  member_points INT DEFAULT 0 COMMENT '积分',
  status TINYINT DEFAULT 1 COMMENT '0禁用 1正常',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_openid (openid),
  KEY idx_unionid (unionid),
  KEY idx_member_level (member_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

#### pet_profiles 宠物档案表

```sql
CREATE TABLE pet_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '主人ID',
  name VARCHAR(50) NOT NULL COMMENT '宠物名',
  breed VARCHAR(50) NOT NULL COMMENT '品种',
  breed_type TINYINT COMMENT '体型: 1小型 2中型 3大型 4巨型',
  birth_date DATE COMMENT '出生日期',
  gender TINYINT COMMENT '0母 1公',
  weight DECIMAL(4,1) COMMENT '体重kg',
  avatar VARCHAR(500) COMMENT '头像URL',
  tags JSON COMMENT '性格标签',
  health_notes TEXT COMMENT '健康备注',
  is_default TINYINT DEFAULT 0 COMMENT '是否默认宠物',
  status TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_id (user_id),
  KEY idx_breed (breed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物档案表';
```

### 2.2 路线模块

#### routes 路线表

```sql
CREATE TABLE routes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  route_no VARCHAR(20) NOT NULL COMMENT '路线编号 R2024001',
  name VARCHAR(100) NOT NULL COMMENT '路线名称',
  route_type TINYINT NOT NULL COMMENT '1山野厨房 2海边度假 3森林露营 4主题派对 5自驾路线',
  title VARCHAR(200) COMMENT '副标题',
  cover_image VARCHAR(500) COMMENT '封面图',
  gallery JSON COMMENT '图集URL数组',
  description TEXT COMMENT '详细介绍',
  highlights JSON COMMENT '亮点标签',
  suitable_breeds JSON COMMENT '适合品种',
  unsuitable_breeds JSON COMMENT '不适合品种',
  duration VARCHAR(20) COMMENT '时长: 半日/1日/2日',
  difficulty TINYINT DEFAULT 3 COMMENT '难度 1-5',
  min_participants INT DEFAULT 4 COMMENT '最小成团人数',
  max_participants INT DEFAULT 12 COMMENT '最大人数',
  base_price DECIMAL(10,2) COMMENT '基础价格',
  safety_video_url VARCHAR(500) COMMENT '安全视频URL',
  safety_video_duration INT DEFAULT 180 COMMENT '视频时长秒',
  is_safety_required TINYINT DEFAULT 1 COMMENT '是否强制观看',
  status TINYINT DEFAULT 1 COMMENT '0下架 1上架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_no (route_no),
  KEY idx_type_status (route_type, status),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线表';
```

#### route_schedules 路线排期表

```sql
CREATE TABLE route_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  route_id BIGINT UNSIGNED NOT NULL COMMENT '路线ID',
  schedule_date DATE NOT NULL COMMENT '活动日期',
  start_time TIME COMMENT '开始时间',
  end_time TIME COMMENT '结束时间',
  price DECIMAL(10,2) COMMENT '当日价格',
  stock INT DEFAULT 12 COMMENT '剩余库存',
  sold INT DEFAULT 0 COMMENT '已售',
  status TINYINT DEFAULT 1 COMMENT '0关闭 1可售 2已满 3已结束',
  guide_id BIGINT COMMENT '领队ID',
  trainer_id BIGINT COMMENT '训犬师ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_date (route_id, schedule_date),
  KEY idx_date (schedule_date),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路线排期表';
```

### 2.3 订单模块

#### orders 订单表

```sql
CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL COMMENT '订单号 QD202404071755001',
  user_id BIGINT UNSIGNED NOT NULL,
  schedule_id BIGINT UNSIGNED NOT NULL COMMENT '排期ID',
  route_id BIGINT UNSIGNED NOT NULL,
  route_name VARCHAR(100) COMMENT '冗余路线名',
  travel_date DATE COMMENT '出行日期',
  participant_count INT DEFAULT 1 COMMENT '成人数量',
  pet_count INT DEFAULT 1 COMMENT '宠物数量',
  participants JSON COMMENT '参与人宠详情',
  route_price DECIMAL(10,2) COMMENT '路线单价',
  insurance_price DECIMAL(10,2) DEFAULT 0 COMMENT '保险费用',
  equipment_price DECIMAL(10,2) DEFAULT 0 COMMENT '装备租赁',
  total_amount DECIMAL(10,2) COMMENT '应付总额',
  discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额',
  pay_amount DECIMAL(10,2) COMMENT '实付金额',
  status TINYINT DEFAULT 10 COMMENT '10待支付 20已支付 30已取消 40退款中 50已退款 60已完成 70已评价',
  pay_time TIMESTAMP NULL COMMENT '支付时间',
  pay_channel VARCHAR(20) COMMENT 'wechat/alipay',
  pay_transaction_id VARCHAR(64) COMMENT '第三方支付流水',
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_reason VARCHAR(500),
  refund_time TIMESTAMP NULL,
  remark VARCHAR(500) COMMENT '用户备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status),
  KEY idx_schedule (schedule_id),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
```

### 2.4 地图模块

#### poi_spots POI地点表

```sql
CREATE TABLE poi_spots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '场所名称',
  poi_type TINYINT NOT NULL COMMENT '1酒店 2餐厅 3公园 4景点 5医院 6服务区',
  category VARCHAR(50) COMMENT '细分标签',
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  address VARCHAR(200),
  longitude DECIMAL(10,7) COMMENT '经度',
  latitude DECIMAL(10,7) COMMENT '纬度',
  geohash VARCHAR(12) COMMENT '地理哈希',
  pet_level TINYINT DEFAULT 1 COMMENT '1允许 2友好 3亲宠',
  pet_facilities JSON COMMENT '设施列表',
  pet_policy TEXT COMMENT '宠物政策说明',
  pet_fee VARCHAR(100) COMMENT '宠物费用说明',
  images JSON COMMENT '环境照片',
  phone VARCHAR(20),
  business_hours VARCHAR(100),
  rating DECIMAL(2,1) DEFAULT 5.0 COMMENT '评分',
  review_count INT DEFAULT 0,
  is_verified TINYINT DEFAULT 0 COMMENT '是否平台认证',
  verified_at TIMESTAMP NULL,
  status TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_location (longitude, latitude),
  KEY idx_geohash (geohash),
  KEY idx_type_city (poi_type, city),
  KEY idx_pet_level (pet_level),
  FULLTEXT KEY ft_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POI地点表';
```

### 2.5 内容模块

#### video_watches 安全视频观看记录表

```sql
CREATE TABLE video_watches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  route_id BIGINT UNSIGNED NOT NULL,
  video_url VARCHAR(500),
  watch_progress INT DEFAULT 0 COMMENT '观看进度秒',
  is_completed TINYINT DEFAULT 0 COMMENT '是否看完',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_route (user_id, route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='视频观看记录';
```

#### contents UGC内容表

```sql
CREATE TABLE contents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  content_type TINYINT NOT NULL COMMENT '1攻略 2照片 3视频',
  author_id BIGINT UNSIGNED NOT NULL COMMENT '作者ID',
  route_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联路线',
  poi_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联POI',
  title VARCHAR(200) DEFAULT NULL,
  text_content TEXT COMMENT '文字内容',
  images JSON COMMENT '图片数组',
  video_url VARCHAR(500),
  video_duration INT DEFAULT 0,
  video_cover VARCHAR(500),
  tags JSON COMMENT '标签',
  location_name VARCHAR(100),
  longitude DECIMAL(10,7),
  latitude DECIMAL(10,7),
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  status TINYINT DEFAULT 1 COMMENT '0审核中 1已发布 2已下架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_author (author_id),
  KEY idx_route (route_id),
  KEY idx_poi (poi_id),
  KEY idx_type_status (content_type, status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='UGC内容表';
```

## 三、接口规范

### 3.1 通用响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "request_id": "req_202404071755001"
}
```

### 3.2 错误码定义

| Code | 含义 | 场景 |
|:---:|:---|:---|
| 200 | 成功 | - |
| 400 | 参数错误 | 缺少必填字段 |
| 401 | 未授权 | Token无效/过期 |
| 403 | 禁止访问 | 无权限操作 |
| 404 | 资源不存在 | 路线/订单未找到 |
| 409 | 冲突 | 库存不足/重复提交 |
| 429 | 请求过快 | 限流触发 |
| 500 | 服务器错误 | 内部异常 |

### 3.3 核心接口列表

#### 用户模块

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/user/login | POST | 微信登录 |
| /api/v1/user/profile | GET | 获取用户信息 |
| /api/v1/user/profile | PUT | 更新用户信息 |
| /api/v1/pets | GET | 获取宠物列表 |
| /api/v1/pets | POST | 创建宠物档案 |
| /api/v1/pets/:id | PUT | 更新宠物信息 |
| /api/v1/pets/:id | DELETE | 删除宠物档案 |

#### 路线模块

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/routes | GET | 路线列表 |
| /api/v1/routes/:id | GET | 路线详情 |
| /api/v1/routes/:id/schedules | GET | 路线排期 |
| /api/v1/routes/:id/safety-video | GET | 安全视频信息 |
| /api/v1/routes/:id/safety-video/watch | POST | 记录视频观看 |

#### 订单模块

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/orders | POST | 创建订单 |
| /api/v1/orders | GET | 订单列表 |
| /api/v1/orders/:id | GET | 订单详情 |
| /api/v1/orders/:id/pay | POST | 发起支付 |
| /api/v1/orders/:id/cancel | POST | 取消订单 |
| /api/v1/orders/:id/refund | POST | 申请退款 |
| /api/v1/orders/pay/callback | POST | 支付回调（微信） |

#### 地图模块

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/map/nearby | GET | 附近POI搜索 |
| /api/v1/map/route-plan | GET | 路线规划 |
| /api/v1/pois/:id | GET | POI详情 |
| /api/v1/pois/cities | GET | 城市列表 |
| /api/v1/pois/cities/:id/guides | GET | 城市攻略 |

#### 内容模块

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/contents | GET | 内容列表 |
| /api/v1/contents | POST | 发布内容 |
| /api/v1/contents/:id | GET | 内容详情 |
| /api/v1/contents/:id/like | POST | 点赞 |
| /api/v1/live/rooms | GET | 直播间列表 |
| /api/v1/live/rooms/:id | GET | 直播间详情 |

#### 公益模块（轻量）

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| /api/v1/charity/partners | GET | 合作机构列表 |
| /api/v1/charity/articles | GET | 科普文章列表 |
| /api/v1/charity/articles/:id | GET | 文章详情 |
| /api/v1/charity/donate | POST | 发起捐赠 |

## 四、非功能性需求

### 4.1 性能指标

| 指标 | 目标值 |
|:---|:---|
| 首页加载时间 | < 1.5s |
| 接口响应时间 | P99 < 200ms |
| 地图搜索响应 | < 500ms |
| 视频首帧时间 | < 1s |
| 并发订单处理 | 1000 TPS |
| 系统可用性 | 99.9% |

### 4.2 安全规范

| 层面 | 措施 |
|:---|:---|
| 传输安全 | 全站HTTPS，TLS 1.3 |
| 接口安全 | JWT鉴权，签名验证，防重放攻击 |
| 数据安全 | 敏感字段加密，数据库脱敏 |
| 支付安全 | 微信支付V3协议，异步通知验签 |
| 上传安全 | 内容审核，防OSS盗链 |
| 隐私合规 | 遵循个人信息保护法 |

### 4.3 监控告警

| 类型 | 工具 | 告警策略 |
|:---|:---|:---|
| 指标监控 | Prometheus + Grafana | CPU>80%，内存>85% |
| 日志监控 | ELK Stack | ERROR日志>10条/分钟 |
| 链路追踪 | Jaeger | 接口耗时>1s |
| 业务监控 | 自建Dashboard | 退款率>5% |

## 五、部署架构

### 5.1 生产环境

```
阿里云 Kubernetes 集群
├── 可用区A（杭州）
│   ├── Pod: user-service x 3
│   ├── Pod: route-service x 3
│   ├── Pod: order-service x 3
│   └── Pod: web-frontend x 2
├── 可用区B（杭州）
│   ├── Pod: map-service x 3
│   ├── Pod: content-service x 3
│   ├── Pod: pay-service x 3
│   └── Pod: admin-frontend x 2
└── 共享资源
    ├── RDS MySQL 主从（杭州）
    ├── Redis 集群（杭州+上海）
    ├── Elasticsearch（杭州）
    └── OSS + CDN（全国）
```

### 5.2 CI/CD流程

```
开发者提交代码 → GitLab
    ↓
GitLab CI 触发构建（Docker镜像）
    ↓
镜像推送至阿里云ACR
    ↓
ArgoCD 自动部署至K8s测试环境
    ↓
自动化测试（单元/集成/E2E）
    ↓
手动审批 → 生产环境灰度发布（5%→50%→100%）
    ↓
监控观察（30分钟无异常全量）
```

---

文档版本: V5.0 Technical
撰写日期: 2026-04-09
