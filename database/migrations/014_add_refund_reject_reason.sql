-- 添加退款拒绝原因字段
ALTER TABLE orders ADD COLUMN refund_reject_reason VARCHAR(500) NULL COMMENT '退款拒绝原因' AFTER refund_reason;
