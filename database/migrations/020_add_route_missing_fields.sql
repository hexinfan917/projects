-- 补充路线表缺失字段（MySQL 不支持单条 ALTER 多个 ADD COLUMN IF NOT EXISTS，拆分为多条）
-- 如果字段已存在会报错，请根据实际缺失字段选择性执行

ALTER TABLE routes ADD COLUMN subtitle VARCHAR(200) COMMENT '副标题' AFTER title;
ALTER TABLE routes ADD COLUMN highlights_detail TEXT COMMENT '行程亮点详情(富文本)' AFTER highlights;
ALTER TABLE routes ADD COLUMN fee_description TEXT COMMENT '费用说明(富文本)' AFTER highlights_detail;
ALTER TABLE routes ADD COLUMN fee_include TEXT COMMENT '费用包含(富文本)' AFTER fee_description;
ALTER TABLE routes ADD COLUMN fee_exclude TEXT COMMENT '费用不包含(富文本)' AFTER fee_include;
ALTER TABLE routes ADD COLUMN notice TEXT COMMENT '注意事项(富文本)' AFTER fee_exclude;
ALTER TABLE routes ADD COLUMN content_modules JSON DEFAULT NULL COMMENT '动态内容模块 [{label, icon, content, sort_order}]' AFTER notice;
ALTER TABLE routes ADD COLUMN is_hot TINYINT NOT NULL DEFAULT 0 COMMENT '0非热门 1热门' AFTER is_safety_required;
ALTER TABLE routes ADD COLUMN extra_person_price DECIMAL(10, 2) DEFAULT 0 COMMENT '增加一人价格' AFTER base_price;
ALTER TABLE routes ADD COLUMN extra_pet_price DECIMAL(10, 2) DEFAULT 0 COMMENT '增加一宠价格' AFTER extra_person_price;
