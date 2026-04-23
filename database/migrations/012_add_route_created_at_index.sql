-- 为路线表 created_at 添加索引，避免排序时 Out of sort memory
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at);
