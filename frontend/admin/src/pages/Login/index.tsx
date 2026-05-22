import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { message, theme, Alert } from 'antd';
import { history, request, useModel } from '@umijs/max';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();
  const { initialState } = useModel('@@initialState');

  const siteName = initialState?.settings?.site_name?.value || '尾巴旅行PetWay';
  const siteLogo = initialState?.settings?.site_logo?.value || 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg';

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
        // 登录成功后刷新页面，确保 initialState 重新加载
        window.location.href = '/admin/';
        return;
      }
      message.error(res.message || '登录失败');
    } catch (err: any) {
      message.error('登录失败，请检查账号密码');
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
        logo={siteLogo}
        title={siteName}
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
          message="请输入管理员账号和密码"
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
