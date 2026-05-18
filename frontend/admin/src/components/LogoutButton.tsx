import React from 'react';
import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';

const LogoutButton: React.FC = () => {
  return (
    <div style={{ padding: '16px', textAlign: 'center' }}>
      <Button
        type="primary"
        danger
        block
        icon={<LogoutOutlined />}
        onClick={() => {
          localStorage.removeItem('token');
          history.push('/login');
        }}
      >
        退出登录
      </Button>
    </div>
  );
};

export default LogoutButton;
