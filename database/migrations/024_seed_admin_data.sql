-- 初始化后台菜单和角色数据
SET NAMES utf8mb4;

-- 插入超级管理员角色
INSERT INTO admin_roles (id, name, code, description, status) VALUES
(1, '超级管理员', 'super_admin', '拥有所有权限', 1)
ON DUPLICATE KEY UPDATE status = 1;

-- 插入菜单数据
-- 先清空旧数据，避免重复
DELETE FROM admin_role_menus;
DELETE FROM admin_menus;

INSERT INTO admin_menus (id, parent_id, name, path, icon, sort_order, type, permission, status) VALUES
-- 仪表盘
(1, 0, '仪表盘', '/dashboard', 'DashboardOutlined', 1, 2, 'dashboard', 1),
-- 用户管理
(10, 0, '用户管理', '/users', 'UserOutlined', 10, 1, NULL, 1),
(11, 10, '用户列表', '/users/list', NULL, 1, 2, 'users:list', 1),
(12, 10, '宠物档案', '/users/pets', NULL, 2, 2, 'users:pets', 1),
(13, 10, '出行人管理', '/users/travelers', NULL, 3, 2, 'users:travelers', 1),
-- 路线管理
(20, 0, '路线管理', '/routes', 'RouteOutlined', 20, 1, NULL, 1),
(21, 20, '路线列表', '/routes/list', NULL, 1, 2, 'routes:list', 1),
(22, 20, '路线分类', '/routes/categories', NULL, 2, 2, 'routes:categories', 1),
-- 订单管理
(30, 0, '订单管理', '/orders', 'ShoppingOutlined', 30, 1, NULL, 1),
(31, 30, '订单列表', '/orders/list', NULL, 1, 2, 'orders:list', 1),
(32, 30, '退款管理', '/orders/refunds', NULL, 2, 2, 'orders:refunds', 1),
-- 内容管理
(40, 0, '内容管理', '/content', 'FileTextOutlined', 40, 1, NULL, 1),
(41, 40, '文章管理', '/content/articles', NULL, 1, 2, 'content:articles', 1),
(42, 40, 'Banner管理', '/content/banners', NULL, 2, 2, 'content:banners', 1),
-- 会员管理
(50, 0, '会员管理', '/members', 'CrownOutlined', 50, 1, NULL, 1),
(51, 50, '会员套餐', '/members/plans', NULL, 1, 2, 'members:plans', 1),
(52, 50, '会员订单', '/members/orders', NULL, 2, 2, 'members:orders', 1),
-- 营销管理
(60, 0, '营销管理', '/marketing', 'GiftOutlined', 60, 1, NULL, 1),
(61, 60, '优惠券', '/marketing/coupons', NULL, 1, 2, 'marketing:coupons', 1),
-- 公益管理
(70, 0, '公益管理', '/charity', 'HeartOutlined', 70, 1, NULL, 1),
(71, 70, '公益活动', '/charity/activities', NULL, 1, 2, 'charity:activities', 1),
(72, 70, '捐款记录', '/charity/donations', NULL, 2, 2, 'charity:donations', 1),
-- 系统设置
(80, 0, '系统设置', '/system', 'SettingOutlined', 80, 1, NULL, 1),
(81, 80, '管理员账号', '/system/admins', NULL, 1, 2, 'system:admins', 1),
(82, 80, '角色权限', '/system/roles', NULL, 2, 2, 'system:roles', 1),
(83, 80, '菜单管理', '/system/menus', NULL, 3, 2, 'system:menus', 1),
(84, 80, '系统参数', '/system/settings', NULL, 4, 2, 'system:settings', 1),
(85, 80, '操作日志', '/system/logs', NULL, 5, 2, 'system:logs', 1);

-- 超级管理员关联所有菜单
INSERT INTO admin_role_menus (role_id, menu_id)
SELECT 1, id FROM admin_menus;
