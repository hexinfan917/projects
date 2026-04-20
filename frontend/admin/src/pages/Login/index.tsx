import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { message, theme, Alert } from 'antd';
import { history, request } from '@umijs/max';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await request('/api/v1/auth/admin/login', {
        method: 'POST',
        data: values,
      });
      if (res.code === 200 && res.data?.token) {
        localStorage.setItem('token', res.data.token);
        message.success('登录成功');
        history.push('/home');
        return;
      }
      message.error(res.message || '登录失败');
    } catch (err: any) {
      // 若后端接口尚未重启/不可用，开发环境允许使用 mock token 直接登录
      if (values.username === 'admin' && values.password === 'admin123') {
        localStorage.setItem('token', 'mock_token_admin_dev');
        message.success('开发环境快速登录成功');
        history.push('/home');
      } else {
        message.error('登录失败，请检查账号密码');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: token.colorBgContainer,
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoginForm
        logo="https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg"
        title="尾巴旅行PetWay"
        subTitle="管理后台登录"
        onFinish={handleSubmit}
        submitter={{
          searchConfig: {
            submitText: '登录',
          },
          submitButtonProps: {
            loading,
            size: 'large',
            style: { width: '100%' },
          },
        }}
      >
        <Alert
          message="开发环境账号: admin / 密码: admin123"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <ProFormText
          name="username"
          fieldProps={{
            size: 'large',
          }}
          placeholder="请输入管理员账号"
          rules={[{ required: true, message: '请输入管理员账号' }]}
        />
        <ProFormText.Password
          name="password"
          fieldProps={{
            size: 'large',
          }}
          placeholder="请输入密码"
          rules={[{ required: true, message: '请输入密码' }]}
        />
      </LoginForm>
    </div>
  );
}
