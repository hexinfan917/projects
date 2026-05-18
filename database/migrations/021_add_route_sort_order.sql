-- 给 routes 表添加排序字段
ALTER TABLE routes ADD COLUMN sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前' AFTER status;

-- 为现有数据设置默认排序（按创建时间倒序）
-- 先获取所有路线按 created_at 倒序的 ID，然后分配 sort_order
SET @row_num = 0;
UPDATE routes r
JOIN (
    SELECT id, (@row_num := @row_num + 10) AS new_order
    FROM routes
    WHERE status = 1
    ORDER BY created_at DESC
) t ON r.id = t.id
SET r.sort_order = t.new_order;
