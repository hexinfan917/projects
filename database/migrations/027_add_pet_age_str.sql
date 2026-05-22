-- 宠物档案新增 age_str 字段，支持小数和文本年龄
ALTER TABLE pet_profiles ADD COLUMN age_str VARCHAR(20) NULL COMMENT '年龄文本（支持小数和描述，如1.5、1岁半）' AFTER birth_date;
