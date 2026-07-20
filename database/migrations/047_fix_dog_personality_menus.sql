-- 047: 补齐犬格检测管理后台菜单
-- 背景：046 按 seed 的固定 parent_id=43 插入「行为画像配置」，但线上 admin_menus
-- 并非由 024 seed 重建，id=43 不存在，导致孤儿菜单。本迁移按 path 判重补齐
-- 父菜单与 6 个子菜单，并关联超级管理员角色（role_id=1）。

-- 1. 父菜单（不存在才插入）
INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT 0, '犬格检测', '/dog-personality', NULL, 21, 1, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality' AND parent_id = 0);

SET @dp_parent := (SELECT id FROM admin_menus WHERE path = '/dog-personality' AND parent_id = 0 LIMIT 1);

-- 2. 046 可能插入的孤儿「行为画像配置」（parent_id=43 且 43 不存在）：挂到正确父菜单下
UPDATE admin_menus
SET parent_id = @dp_parent, sort_order = 5, icon = NULL
WHERE path = '/dog-personality/behavior-configs'
  AND parent_id = 43
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM admin_menus WHERE id = 43) AS t);

-- 3. 子菜单（按 path 判重补齐）
INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, '模块管理', '/dog-personality/modules', NULL, 1, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/modules');

INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, '题目管理', '/dog-personality/questions', NULL, 2, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/questions');

INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, '分型管理', '/dog-personality/levels', NULL, 3, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/levels');

INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, '测评记录', '/dog-personality/results', NULL, 4, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/results');

INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, '行为画像配置', '/dog-personality/behavior-configs', NULL, 5, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/behavior-configs');

INSERT INTO admin_menus (parent_id, name, path, icon, sort_order, type, permission, status)
SELECT @dp_parent, 'PK 记录', '/dog-personality/pk-records', NULL, 6, 2, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_menus WHERE path = '/dog-personality/pk-records');

-- 4. 关联超级管理员角色（role_id=1，按 role_id+menu_id 判重）
INSERT INTO admin_role_menus (role_id, menu_id)
SELECT 1, m.id FROM admin_menus m
WHERE m.path LIKE '/dog-personality%'
  AND NOT EXISTS (
    SELECT 1 FROM admin_role_menus rm WHERE rm.role_id = 1 AND rm.menu_id = m.id
  );
