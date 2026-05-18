// 运行时配置
import React from 'react';
import { RequestConfig, history, request as umiRequest } from '@umijs/max';
import { Avatar, Dropdown, Space } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';

// 全局初始化数据配置
export async function getInitialState(): Promise<{
  name?: string;
  role?: string;
  token?: string;
  isLogin?: boolean;
}> {
  const token = localStorage.getItem('token');
  if (!token) {
    return { isLogin: false };
  }
  // 尝试从后端获取当前管理员信息
  try {
    const res = await umiRequest('/api/v1/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.code === 200 && res.data) {
      return {
        name: res.data.real_name || res.data.username,
        role: res.data.role_name || 'admin',
        token,
        isLogin: true,
      };
    }
  } catch (e) {
    // 静默失败，使用默认值
  }
  return {
    name: '管理员',
    role: 'admin',
    token,
    isLogin: true,
  };
}

export const layout = () => {
  return {
    logo: 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg',
    menu: {
      locale: false,
      request: async () => {
        const token = localStorage.getItem('token');
        if (!token) return [];
        try {
          const res = await umiRequest('/api/v1/admin/my-menus', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.code === 200 && res.data) {
            // 将后端菜单树转换为 UmiJS 菜单格式
            const transformMenu = (menus: any[]): any[] => {
              return menus.map((item) => ({
                name: item.name,
                path: item.path,
                icon: item.icon || undefined,
                routes: item.children && item.children.length > 0 ? transformMenu(item.children) : undefined,
              }));
            };
            return transformMenu(res.data);
          }
        } catch (e) {
          console.error('获取菜单失败:', e);
        }
        return [];
      },
    },
    rightRender: (initialState: any) => {
      if (!initialState?.isLogin) {
        return null;
      }
      return (
        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: () => {
                  localStorage.removeItem('token');
                  history.push('/login');
                },
              },
            ],
          }}
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{initialState?.name || '管理员'}</span>
          </Space>
        </Dropdown>
      );
    },
    onPageChange: () => {
      const { location } = history;
      const token = localStorage.getItem('token');
      // 未登录且不在登录页，重定向到登录页
      if (!token && location.pathname !== '/login') {
        setTimeout(() => {
          history.push('/login');
        }, 100);
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
