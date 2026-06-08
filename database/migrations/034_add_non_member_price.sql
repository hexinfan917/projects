-- 添加非会员价格字段到路线表和排期表
-- 用于会员专享免费活动时，非会员需要支付的原价

ALTER TABLE routes ADD COLUMN non_member_price DECIMAL(10,2) DEFAULT 0 COMMENT '非会员价格（会员专享免费活动时使用）' AFTER person_insurance_price;

ALTER TABLE route_schedules ADD COLUMN non_member_price DECIMAL(10,2) DEFAULT NULL COMMENT '当日非会员价格（覆盖路线级别）' AFTER self_drive_extra_pet_price;
