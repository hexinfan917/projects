-- 添加路线表缺失的会员/保险相关字段

ALTER TABLE routes
ADD COLUMN is_member_only TINYINT NOT NULL DEFAULT 0 COMMENT '0所有人可免费 1仅限会员免费' AFTER is_free,
ADD COLUMN is_insurance_required TINYINT NOT NULL DEFAULT 0 COMMENT '0非强制 1强制购买保险' AFTER is_member_only,
ADD COLUMN pet_insurance_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '宠物保险价格' AFTER is_insurance_required,
ADD COLUMN person_insurance_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '人身意外险价格' AFTER pet_insurance_price,
ADD COLUMN non_member_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '非会员价格' AFTER person_insurance_price;
