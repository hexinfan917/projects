import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: '犬兜行管理后台',
    logo: '/logo.png',
  },
  proxy: {
    '/api': {
      target: 'http://localhost:8081',
      changeOrigin: true,
    },
  },
  routes: [
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
      name: '操作日志',
      path: '/logs',
      component: './Logs',
    },
    {
      name: '系统设置',
      path: '/settings',
      component: './Settings',
    },
  ],
  npmClient: 'npm',
});
