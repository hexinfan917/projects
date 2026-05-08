-- 为订单表增加行程选配字段
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS addons JSON COMMENT '行程选配列表',
    ADD COLUMN IF NOT EXISTS addon_amount DECIMAL(10,2) DEFAULT 0 COMMENT '行程选配合计金额';
