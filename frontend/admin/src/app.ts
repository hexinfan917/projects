// 运行时配置
import { RequestConfig, history } from '@umijs/max';

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
    },
    rightRender: () => {
      return null;
    },
    onPageChange: () => {
      const { location } = history;
      const token = localStorage.getItem('token');
      // 未登录且不在登录页，重定向到登录页
      if (!token && location.pathname !== '/login') {
        history.push('/login');
      }
    },
  };
};

export const request: RequestConfig = {
  timeout: 10000,
  errorConfig: {
    errorThrower: (res) => {
      const { success, data, errorCode, errorMessage } = res;
      if (!success) {
        const error: any = new Error(errorMessage);
        error.name = 'BizError';
        error.info = { errorCode, errorMessage, data };
        throw error;
      }
    },
    errorHandler: (error: any) => {
      console.error('Request error:', error);
      if (error.name === 'BizError') {
        return error.info;
      }
      return { success: false, errorMessage: '请求失败' };
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
    (response: any) => {
      // 统一处理 401
      if (response.status === 401) {
        localStorage.removeItem('token');
        history.push('/login');
      }
      return response;
    },
  ],
};
