-- 为 admin_users 表添加 last_login_at 字段
ALTER TABLE admin_users ADD COLUMN last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间' AFTER status;
