-- 为路线表添加是否热门字段
ALTER TABLE routes ADD COLUMN is_hot TINYINT NOT NULL DEFAULT 0 COMMENT '0非热门 1热门' AFTER is_safety_required;

-- 创建索引加速热门路线查询
CREATE INDEX idx_routes_is_hot ON routes(is_hot);
