-- 初始化后台菜单和角色数据
SET NAMES utf8mb4;

-- 插入超级管理员角色
INSERT INTO admin_roles (id, name, code, description, status) VALUES
(1, '超级管理员', 'super_admin', '拥有所有权限', 1)
ON DUPLICATE KEY UPDATE status = 1;

-- 插入菜单数据
DELETE FROM admin_role_menus;
DELETE FROM admin_menus;

INSERT INTO admin_menus (id, parent_id, name, path, icon, sort_order, type, permission, status) VALUES
(2, 0, '首页', '/home', NULL, 1, 2, NULL, 1),
(4, 3, '用户列表', '/users/list', NULL, 1, 2, NULL, 1),
(3, 0, '用户管理', '/users', NULL, 2, 1, NULL, 1),
(6, 5, '路线列表', '/routes/list', NULL, 1, 2, NULL, 1),
(7, 5, '路线类型', '/routes/types', NULL, 2, 2, NULL, 1),
(5, 0, '路线管理', '/routes', NULL, 3, 1, NULL, 1),
(10, 0, '订单管理', '/orders', NULL, 4, 2, NULL, 1),
(11, 0, '排期管理', '/schedules', NULL, 5, 2, NULL, 1),
(13, 0, '出行人管理', '/travelers', NULL, 6, 2, NULL, 1),
(14, 0, '财务管理', '/finance', NULL, 7, 2, NULL, 1),
(16, 15, '管理员管理', '/system/admins', NULL, 1, 2, NULL, 1),
(17, 15, '角色管理', '/system/roles', NULL, 2, 2, NULL, 1),
(18, 15, '菜单管理', '/system/menus', NULL, 3, 2, NULL, 1),
(15, 0, '系统管理', '/system', NULL, 8, 1, NULL, 1),
(20, 0, '系统设置', '/settings', NULL, 9, 2, NULL, 1),
(21, 0, '操作日志', '/logs', NULL, 10, 2, NULL, 1),
(22, 0, '内容管理', '/articles', NULL, 11, 2, NULL, 1),
(23, 0, '狗狗回顾', '/reviews', NULL, 12, 2, NULL, 1),
(24, 0, '首页轮播', '/banners', NULL, 13, 2, NULL, 1),
(25, 0, '行程选配', '/addons', NULL, 14, 2, NULL, 1),
(26, 0, '选配分类', '/addon-categories', NULL, 15, 2, NULL, 1),
(27, 0, '公益管理', '/charities', NULL, 16, 2, NULL, 1),
(29, 28, '狗狗档案', '/adoption/dogs', NULL, 1, 2, NULL, 1),
(30, 28, '领养申请', '/adoption/applications', NULL, 2, 2, NULL, 1),
(28, 0, '领养管理', '/adoption', NULL, 17, 1, NULL, 1),
(32, 31, '会员订单', '/member/orders', NULL, 1, 2, NULL, 1),
(33, 31, '会员列表', '/member/list', NULL, 2, 2, NULL, 1),
(34, 31, '会员套餐', '/member/plans', NULL, 3, 2, NULL, 1),
(35, 31, '弹窗配置', '/member/popups', NULL, 4, 2, NULL, 1),
(31, 0, '会员管理', '/member', NULL, 18, 1, NULL, 1),
(38, 36, '优惠券模板', '/coupons/list', NULL, 1, 2, NULL, 1),
(39, 36, '发放记录', '/coupons/grant-records', NULL, 2, 2, NULL, 1),
(40, 36, '用户优惠券统计', '/coupons/user-coupon-stats', NULL, 3, 2, NULL, 1),
(41, 36, '核销记录', '/coupons/use-records', NULL, 4, 2, NULL, 1),
(36, 0, '优惠券管理', '/coupons', NULL, 19, 1, NULL, 1),
(42, 0, '协议管理', '/agreements', NULL, 20, 2, NULL, 1),
(45, 43, '模块管理', '/dog-personality/modules', NULL, 1, 2, NULL, 1),
(46, 43, '题目管理', '/dog-personality/questions', NULL, 2, 2, NULL, 1),
(47, 43, '分型管理', '/dog-personality/levels', NULL, 3, 2, NULL, 1),
(48, 43, '测评记录', '/dog-personality/results', NULL, 4, 2, NULL, 1),
(49, 43, '行为画像配置', '/dog-personality/behavior-configs', NULL, 5, 2, NULL, 1),
(50, 43, 'PK 记录', '/dog-personality/pk-records', NULL, 6, 2, NULL, 1),
(43, 0, '犬格检测', '/dog-personality', NULL, 21, 1, NULL, 1);

-- 超级管理员关联所有菜单
INSERT INTO admin_role_menus (role_id, menu_id)
SELECT 1, id FROM admin_menus;