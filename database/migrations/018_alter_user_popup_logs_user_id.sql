-- 修改 user_popup_logs 表，允许 user_id 为空（支持未登录用户记录）
ALTER TABLE user_popup_logs MODIFY COLUMN user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '用户ID';
