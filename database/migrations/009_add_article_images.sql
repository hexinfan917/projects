-- 给 articles 表增加 images 字段，用于存储图集（JSON 数组字符串）
ALTER TABLE articles ADD COLUMN images TEXT NULL COMMENT '图集，JSON 数组存储图片 URL 列表' AFTER cover_image;
