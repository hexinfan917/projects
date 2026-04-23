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
