-- 优惠券、会员中心、弹窗配置模块
-- 创建于 2025-05-08

-- ==================== 优惠券模块 ====================

-- 优惠券模板表
CREATE TABLE IF NOT EXISTS coupon_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '优惠券名称',
  type TINYINT NOT NULL COMMENT '1满减券 2折扣券 3立减券(无门槛)',
  value DECIMAL(10,2) NOT NULL COMMENT '优惠值：满减/立减为金额，折扣为0-1小数',
  min_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低订单金额门槛',
  max_discount DECIMAL(10,2) DEFAULT 0 COMMENT '折扣券最高优惠金额，0为不限制',
  total_count INT DEFAULT 0 COMMENT '发放总量，0为不限量',
  per_user_limit INT DEFAULT 1 COMMENT '每人限领张数，0为不限',
  valid_type TINYINT DEFAULT 1 COMMENT '1领取后X天有效 2固定时间段有效',
  valid_days INT DEFAULT 7 COMMENT '领取后有效天数',
  valid_start_time DATETIME DEFAULT NULL COMMENT '固定有效期开始',
  valid_end_time DATETIME DEFAULT NULL COMMENT '固定有效期结束',
  applicable_type TINYINT DEFAULT 1 COMMENT '1全部路线 2指定路线 3指定路线类型',
  applicable_ids JSON DEFAULT NULL COMMENT '适用对象ID列表',
  is_exclusive TINYINT DEFAULT 0 COMMENT '1不可与其他优惠券叠加',
  source_type TINYINT DEFAULT 1 COMMENT '1通用 2会员购买赠送 3会员每月发放',
  description VARCHAR(500) DEFAULT NULL COMMENT '使用说明',
  color VARCHAR(20) DEFAULT '#FF6B35' COMMENT '券面主题色',
  status TINYINT DEFAULT 1 COMMENT '0停用 1启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type_status (type, status),
  KEY idx_status (status),
  KEY idx_source_type (source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券模板表';

-- 用户优惠券表
CREATE TABLE IF NOT EXISTS user_coupons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  template_id BIGINT UNSIGNED NOT NULL COMMENT '模板ID',
  coupon_no VARCHAR(32) NOT NULL COMMENT '券编号',
  name VARCHAR(100) NOT NULL COMMENT '券名称（冗余）',
  type TINYINT NOT NULL COMMENT '1满减券 2折扣券 3立减券',
  value DECIMAL(10,2) NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2) DEFAULT 0,
  applicable_type TINYINT DEFAULT 1,
  applicable_ids JSON DEFAULT NULL,
  valid_start_time DATETIME NOT NULL,
  valid_end_time DATETIME NOT NULL,
  status TINYINT DEFAULT 1 COMMENT '1未使用 2已使用 3已过期 4已作废',
  used_order_id BIGINT UNSIGNED DEFAULT NULL COMMENT '使用订单ID',
  used_at DATETIME DEFAULT NULL COMMENT '使用时间',
  source_type TINYINT DEFAULT 1 COMMENT '1主动领取 2后台定向发放 3新人注册 4活动奖励 5积分兑换 6会员购买赠送 7会员月度发放',
  source_id BIGINT UNSIGNED DEFAULT NULL COMMENT '来源业务ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_coupon_no (coupon_no),
  KEY idx_user_status (user_id, status),
  KEY idx_user_valid (user_id, valid_end_time, status),
  KEY idx_used_order (used_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户优惠券表';

-- ==================== 会员中心模块 ====================

-- 会员套餐表
CREATE TABLE IF NOT EXISTS member_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '套餐名称',
  subtitle VARCHAR(200) DEFAULT NULL COMMENT '副标题',
  original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
  sale_price DECIMAL(10,2) NOT NULL COMMENT '售价',
  duration_days INT NOT NULL COMMENT '有效期天数',
  benefit_config JSON NOT NULL COMMENT '权益配置JSON',
  coupon_package JSON NOT NULL COMMENT '券包配置JSON',
  sort_order INT DEFAULT 0 COMMENT '排序',
  tag VARCHAR(20) DEFAULT NULL COMMENT '角标',
  color VARCHAR(20) DEFAULT '#FF6B35' COMMENT '主题色',
  is_recommend TINYINT DEFAULT 0 COMMENT '1推荐套餐',
  status TINYINT DEFAULT 1 COMMENT '0下架 1上架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员套餐表';

-- 用户会员订阅表
CREATE TABLE IF NOT EXISTS user_memberships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  plan_id BIGINT UNSIGNED NOT NULL COMMENT '套餐ID',
  status TINYINT DEFAULT 1 COMMENT '1生效中 2已过期 3已退款',
  start_date DATE NOT NULL COMMENT '生效开始日期',
  end_date DATE NOT NULL COMMENT '生效结束日期',
  order_id BIGINT UNSIGNED NOT NULL COMMENT '关联购买订单ID',
  pay_amount DECIMAL(10,2) NOT NULL COMMENT '实际支付金额',
  is_auto_renew TINYINT DEFAULT 0 COMMENT '1自动续费',
  benefit_snapshot JSON NOT NULL COMMENT '权益快照',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_active (user_id, status),
  KEY idx_user (user_id),
  KEY idx_end_date (end_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会员订阅表';

-- 会员购买订单表
CREATE TABLE IF NOT EXISTS member_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL COMMENT '订单编号 MV开头',
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  pay_amount DECIMAL(10,2) NOT NULL,
  status TINYINT DEFAULT 10 COMMENT '10待支付 20已支付 30已取消 40已退款',
  pay_time DATETIME DEFAULT NULL,
  pay_channel VARCHAR(20) DEFAULT NULL,
  pay_trade_no VARCHAR(64) DEFAULT NULL,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_time DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员购买订单表';

-- ==================== 弹窗配置模块 ====================

-- 弹窗配置表
CREATE TABLE IF NOT EXISTS popup_configs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL COMMENT '弹窗类型：member_activity',
  title VARCHAR(100) NOT NULL COMMENT '弹窗标题',
  subtitle VARCHAR(200) DEFAULT NULL COMMENT '副标题',
  image VARCHAR(500) DEFAULT NULL COMMENT '弹窗主图URL',
  content JSON DEFAULT NULL COMMENT '内容配置（权益列表等）',
  primary_btn_text VARCHAR(20) DEFAULT '立即开通' COMMENT '主按钮文案',
  primary_btn_color VARCHAR(20) DEFAULT '#FF6B35' COMMENT '主按钮颜色',
  close_btn_text VARCHAR(20) DEFAULT '暂不开通' COMMENT '关闭按钮文案',
  trigger_type TINYINT DEFAULT 1 COMMENT '1首次进入 2每次进入',
  show_duration_seconds INT DEFAULT 0 COMMENT '自动关闭时间，0为不自动关闭',
  target_plan_id BIGINT UNSIGNED DEFAULT NULL COMMENT '跳转套餐ID',
  target_page VARCHAR(200) DEFAULT NULL COMMENT '跳转页面路径',
  status TINYINT DEFAULT 1 COMMENT '0停用 1启用',
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type_status (type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='弹窗配置表';

-- 用户弹窗记录表
CREATE TABLE IF NOT EXISTS user_popup_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  popup_id BIGINT UNSIGNED NOT NULL,
  action TINYINT NOT NULL COMMENT '1展示 2点击主按钮 3点击关闭 4点击外部蒙层',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_popup (user_id, popup_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户弹窗记录表';

-- ==================== 订单表字段扩展 ====================

-- 订单表新增优惠券相关字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id BIGINT UNSIGNED DEFAULT NULL COMMENT '使用的优惠券ID' AFTER pay_amount;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_name VARCHAR(100) DEFAULT NULL COMMENT '优惠券名称' AFTER coupon_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '会员折扣金额' AFTER coupon_name;
