-- 为订单表添加宠物信息字段
ALTER TABLE orders ADD COLUMN pets JSON NULL COMMENT '宠物信息' AFTER participants;
