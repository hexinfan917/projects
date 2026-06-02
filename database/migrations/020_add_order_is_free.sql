-- 订单表添加 is_free 字段（标识免费路线订单）
ALTER TABLE orders ADD COLUMN is_free TINYINT NOT NULL DEFAULT 0 COMMENT '0付费 1免费' AFTER route_id;

-- 已有数据：根据 pay_amount = 0 更新为免费订单（保守处理，只更新确定免费的）
-- UPDATE orders SET is_free = 1 WHERE pay_amount = 0 AND status IN (20, 60, 70);
