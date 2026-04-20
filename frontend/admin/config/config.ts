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
      target: 'http://localhost:8080',
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
      name: '路线管理',
      path: '/routes',
      routes: [
        {
          name: '路线列表',
          path: '/routes/list',
          component: './Routes/List',
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
      name: '订单管理',
      path: '/orders',
      component: './Orders',
    },
  ],
  npmClient: 'npm',
});
