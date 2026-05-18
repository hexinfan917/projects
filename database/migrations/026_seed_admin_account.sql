-- 插入默认超级管理员账号（id=1，与 auth.py 硬编码对应）
INSERT INTO admin_users (id, username, password, real_name, phone, email, avatar, role_id, status, last_login_at, created_at, updated_at)
VALUES (
    1,
    'admin',
    '$2b$12$abcdefghijklmnopqrstuv',  -- bcrypt hash placeholder, actual login is hardcoded in auth.py
    '系统管理员',
    '13800138000',
    'admin@petway.com',
    NULL,
    1,
    1,
    NOW(),
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    status = 1,
    role_id = 1,
    updated_at = NOW();
