-- 路线套餐价格字段
ALTER TABLE routes
    ADD COLUMN single_person_price DECIMAL(10,2) DEFAULT NULL COMMENT '单独人出行价格(1人0宠)',
    ADD COLUMN two_person_one_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT '2人1宠价格',
    ADD COLUMN one_person_two_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT '1人2宠价格',
    ADD COLUMN single_pet_price DECIMAL(10,2) DEFAULT NULL COMMENT '单独宠物价格(0人1宠)';
