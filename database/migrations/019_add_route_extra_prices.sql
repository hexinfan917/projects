-- 路线增加额外人/宠价格字段
ALTER TABLE routes ADD COLUMN extra_person_price DECIMAL(10, 2) DEFAULT 0 COMMENT '增加一人价格' AFTER base_price;
ALTER TABLE routes ADD COLUMN extra_pet_price DECIMAL(10, 2) DEFAULT 0 COMMENT '增加一宠价格' AFTER extra_person_price;
