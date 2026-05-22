// 运行时配置
import { RequestConfig, history } from '@umijs/max';
import React from 'react';
import LogoutButton from '@/components/LogoutButton';
import { UserOutlined, SettingOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { Dropdown, Avatar, Space } from 'antd';

function parseJwt(token: string) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = 4 - (base64.length % 4);
    const paddedBase64 = pad === 4 ? base64 : base64 + '='.repeat(pad);
    const json = decodeURIComponent(
      escape(window.atob(paddedBase64))
    );
    return JSON.parse(json);
  } catch (e) {
    console.error('parseJwt error:', e);
    return null;
  }
}

// 全局初始化数据配置
export async function getInitialState(): Promise<{
  name?: string;
  role?: string;
  token?: string;
  isLogin?: boolean;
  settings?: Record<string, any>;
}> {
  const token = localStorage.getItem('token');
  const baseState: any = { isLogin: false };

  // 获取公开系统设置（无需登录）
  try {
    const res = await fetch('/api/v1/settings/public');
    const data = await res.json();
    if (data.code === 200 && data.data) {
      baseState.settings = data.data;
    }
  } catch (e) {
    console.error('Failed to load public settings:', e);
  }

  if (!token) {
    return baseState;
  }

  const payload = parseJwt(token);
  baseState.name = payload?.username || payload?.openid || '管理员';
  baseState.role = payload?.role || 'admin';
  baseState.token = token;
  baseState.isLogin = true;

  return baseState;
}

export const layout = ({ initialState, setInitialState }: { initialState: any; setInitialState: any }) => {
  return {
    logo: initialState?.settings?.site_logo?.value || '/logo.png',
    title: initialState?.settings?.site_name?.value || '尾巴旅行管理后台',
    menu: {
      locale: false,
    },
    rightRender: (initState: any) => {
      if (!initState?.isLogin) return null;
      const handleMenuClick = ({ key }: { key: string }) => {
        if (key === 'profile') history.push('/profile');
        else if (key === 'settings') history.push('/settings');
        else if (key === 'logout') {
          localStorage.removeItem('token');
          history.push('/login');
        }
      };
      const items = [
        {
          key: 'profile',
          icon: React.createElement(UserOutlined),
          label: '个人中心',
        },
        {
          key: 'settings',
          icon: React.createElement(SettingOutlined),
          label: '系统设置',
        },
        {
          key: 'logout',
          icon: React.createElement(LogoutOutlined),
          label: '退出登录',
        },
      ];
      return React.createElement(
        Dropdown,
        { menu: { items, onClick: handleMenuClick }, placement: 'bottomRight' },
        React.createElement(
          Space,
          { style: { cursor: 'pointer' } },
          React.createElement(Avatar, { size: 'small', icon: React.createElement(UserOutlined) }),
          React.createElement('span', null, initState?.name || '管理员'),
          React.createElement(DownOutlined, { style: { fontSize: 12 } })
        )
      );
    },
    avatarProps: false,
    menuFooterRender: false,
    onPageChange: () => {
      const { location } = history;
      const token = localStorage.getItem('token');
      // 未登录且不在登录页，重定向到登录页
      if (!token && location.pathname !== '/login') {
        history.push('/login');
        return;
      }
      // token 变化时更新 initialState（解决切换账号后显示不一致）
      if (token && initialState?.token !== token) {
        const payload = parseJwt(token);
        setInitialState({
          name: payload?.username || payload?.openid || '管理员',
          role: payload?.role || 'admin',
          token,
          isLogin: true,
        });
      }
    },
  };
};

export const request: RequestConfig = {
  timeout: 10000,
  errorConfig: {
    errorThrower: (res) => {
      const { code, data, message } = res;
      if (code !== 200) {
        const error: any = new Error(message);
        error.name = 'BizError';
        error.info = { errorCode: code, errorMessage: message, data };
        throw error;
      }
    },
    errorHandler: (error: any) => {
      console.error('Request error:', error);
      // 处理 HTTP 401（token 无效或过期）
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        history.push('/login');
        return;
      }
      if (error.name === 'BizError') {
        return error.info;
      }
      return { code: 500, message: '请求失败', data: null };
    },
  },
  requestInterceptors: [
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers!.Authorization = `Bearer ${token}`;
      }
      return config;
    },
  ],
  responseInterceptors: [
    [
      (response: any) => {
        return response;
      },
      (error: any) => {
        // 统一处理 401（axios 将非 2xx 视为错误，需在 rejected 回调中捕获）
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          history.push('/login');
        }
        return Promise.reject(error);
      },
    ],
  ],
};
