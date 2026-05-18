-- 增加礼品券类型支持
-- 2025-05-15

-- 更新优惠券模板表 type 字段注释
ALTER TABLE coupon_templates MODIFY COLUMN type TINYINT NOT NULL COMMENT '1满减券 2折扣券 3立减券(无门槛) 4礼品券';

-- 更新用户优惠券表 type 字段注释
ALTER TABLE user_coupons MODIFY COLUMN type TINYINT NOT NULL COMMENT '1满减券 2折扣券 3立减券 4礼品券';

-- 用户优惠券表增加 description 字段（用于存储礼品券内容说明）
ALTER TABLE user_coupons ADD COLUMN description VARCHAR(500) DEFAULT NULL COMMENT '使用说明（冗余模板描述）' AFTER source_id;
