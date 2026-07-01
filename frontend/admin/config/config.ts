import { defineConfig } from '@umijs/max';

const routes = [
    {
      path: '/',
      redirect: '/home',
    },
    {
      name: '首页',
      path: '/home',
      component: './Home',
    },
    {
      name: '用户管理',
      path: '/users',
      routes: [
        {
          name: '用户列表',
          path: '/users/list',
          component: './Users/List',
        },
      ],
    },
    {
      name: '宠物管理',
      path: '/pets',
      component: './Pets',
    },
    {
      name: '出行人管理',
      path: '/travelers',
      component: './Travelers',
    },
    {
      name: '路线管理',
      path: '/routes',
      routes: [
        {
          name: '路线列表',
          path: '/routes/list',
          component: './Routes/List',
        },
        {
          name: '路线类型',
          path: '/routes/types',
          component: './RouteTypes',
        },
      ],
    },
    {
      name: '新建路线',
      path: '/routes/edit',
      component: './Routes/Edit',
      hideInMenu: true,
    },
    {
      name: '编辑路线',
      path: '/routes/edit/:id',
      component: './Routes/Edit',
      hideInMenu: true,
    },
    {
      name: '排期管理',
      path: '/schedules',
      component: './Schedules',
    },
    {
      name: '行程选配',
      path: '/addons',
      component: './Addons',
    },
    {
      name: '选配分类',
      path: '/addon-categories',
      component: './AddonCategories/index',
    },

    {
      name: '订单管理',
      path: '/orders',
      component: './Orders',
    },
    {
      name: '评价管理',
      path: '/evaluations',
      component: './Evaluations',
    },
    {
      name: '财务管理',
      path: '/finance',
      component: './Finance',
    },
    {
      name: '内容管理',
      path: '/articles',
      component: './Articles',
    },
    {
      name: '首页轮播',
      path: '/banners',
      component: './Banners',
    },
    {
      name: '狗狗回顾',
      path: '/reviews',
      component: './Reviews',
    },
    {
      name: '公益管理',
      path: '/charities',
      component: './Charities',
    },
    {
      name: '领养管理',
      path: '/adoption',
      routes: [
        {
          name: '狗狗档案',
          path: '/adoption/dogs',
          component: './Adoption/Dogs',
        },
        {
          name: '领养申请',
          path: '/adoption/applications',
          component: './Adoption/Applications',
        },
      ],
    },
    {
      name: '操作日志',
      path: '/logs',
      component: './Logs',
    },
    {
      name: '会员管理',
      path: '/member',
      routes: [
        {
          name: '会员订单',
          path: '/member/orders',
          component: './MemberOrders/List',
        },
        {
          name: '会员套餐',
          path: '/member/plans',
          component: './MemberPlans/List',
        },
        {
          name: '弹窗配置',
          path: '/member/popups',
          component: './PopupConfigs/List',
        },
      ],
    },
    {
      name: '优惠券管理',
      path: '/coupons',
      routes: [
        {
          path: '/coupons',
          redirect: '/coupons/list',
        },
        {
          name: '优惠券模板',
          path: '/coupons/list',
          component: './Coupons/List',
        },
        {
          name: '核销记录',
          path: '/coupons/use-records',
          component: './Coupons/UseRecords',
        },
        {
          name: '发放记录',
          path: '/coupons/grant-records',
          component: './Coupons/GrantRecords',
        },
      ],
    },
    {
      name: '协议管理',
      path: '/agreements',
      component: './Agreements',
    },
    {
      name: '个人中心',
      path: '/profile',
      component: './Profile',
      hideInMenu: true,
      layout: true,
    },
    {
      name: '系统管理',
      path: '/system',
      routes: [
        {
          name: '管理员管理',
          path: '/system/admins',
          component: './AdminUsers',
        },
        {
          name: '角色管理',
          path: '/system/roles',
          component: './Roles',
        },
        {
          name: '菜单管理',
          path: '/system/menus',
          component: './Menus',
        },
      ],
    },
    {
      name: '系统设置',
      path: '/settings',
      component: './Settings',
    },
  ];

export default defineConfig({
  publicPath: '/admin/',
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: '尾巴旅行管理后台',
    logo: '/logo.png',
  },
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
  routes: routes,
  npmClient: 'npm',
});
