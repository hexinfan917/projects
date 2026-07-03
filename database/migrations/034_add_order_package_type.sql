-- 为 orders 表添加 package_type 字段
ALTER TABLE orders
ADD COLUMN package_type VARCHAR(50) NULL COMMENT '套餐类型: couple-一人一宠, single_person-单人轻旅, single_pet-毛孩专属接送' AFTER travel_type;
