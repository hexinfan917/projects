-- 为路线表增加自驾优惠金额字段
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS self_drive_discount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '自驾优惠金额（从基础价中减去）' AFTER base_price;
