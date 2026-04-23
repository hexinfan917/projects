-- 路线表添加动态内容模块字段
ALTER TABLE routes ADD COLUMN IF NOT EXISTS content_modules JSON DEFAULT NULL COMMENT '动态内容模块 [{label, icon, content, sort_order}]';
