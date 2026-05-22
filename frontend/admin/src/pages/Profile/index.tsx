import { PageContainer } from '@ant-design/pro-components';
import { Card, Descriptions, Tag, Avatar, Spin, message, Button, Form, Input, Divider, Modal, Space } from 'antd';
import { UserOutlined, EditOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { request } from '@umijs/max';

export default function Profile() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/me');
      if (res.code === 200 && res.data) {
        setUserInfo(res.data);
        form.setFieldsValue({
          real_name: res.data.real_name,
          phone: res.data.phone,
          email: res.data.email,
        });
      } else {
        message.error(res.message || '获取个人信息失败');
      }
    } catch (error) {
      message.error('获取个人信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const res = await request('/api/v1/admin/me', {
        method: 'PUT',
        data: values,
      });
      if (res.code === 200) {
        message.success('保存成功');
        setUserInfo(res.data);
        setIsEditing(false);
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (values: any) => {
    try {
      const res = await request('/api/v1/admin/me', {
        method: 'PUT',
        data: {
          old_password: values.old_password,
          new_password: values.new_password,
        },
      });
      if (res.code === 200) {
        message.success('密码修改成功，请重新登录');
        setIsPasswordModalOpen(false);
        passwordForm.resetFields();
        setTimeout(() => {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }, 1500);
      } else {
        message.error(res.message || '密码修改失败');
      }
    } catch (error) {
      message.error('密码修改失败');
    }
  };

  if (loading) {
    return (
      <PageContainer title="个人中心">
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="个人中心"
      extra={
        <Button
          type="primary"
          icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
          loading={saving}
          onClick={() => {
            if (isEditing) {
              form.submit();
            } else {
              setIsEditing(true);
            }
          }}
        >
          {isEditing ? '保存' : '编辑资料'}
        </Button>
      }
    >
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={userInfo?.avatar}
            style={{ marginRight: 24 }}
          />
          <div>
            <h2 style={{ margin: 0 }}>
              {userInfo?.real_name || userInfo?.username || '管理员'}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#666' }}>
              {userInfo?.role_name ? <Tag color="blue">{userInfo.role_name}</Tag> : null}
              {userInfo?.status === 1 ? <Tag color="success">正常</Tag> : <Tag color="error">禁用</Tag>}
            </p>
          </div>
        </div>

        {isEditing ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              real_name: userInfo?.real_name,
              phone: userInfo?.phone,
              email: userInfo?.email,
            }}
          >
            <Form.Item
              label="真实姓名"
              name="real_name"
              rules={[{ max: 50, message: '最多50个字符' }]}
            >
              <Input placeholder="请输入真实姓名" />
            </Form.Item>
            <Form.Item
              label="手机号"
              name="phone"
              rules={[
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ type: 'email', message: '请输入正确的邮箱' }]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存
                </Button>
                <Button onClick={() => setIsEditing(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="用户ID">{userInfo?.id || '-'}</Descriptions.Item>
            <Descriptions.Item label="用户名">{userInfo?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="真实姓名">{userInfo?.real_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{userInfo?.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{userInfo?.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">{userInfo?.role_name || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        <Divider />

        <Button
          icon={<LockOutlined />}
          onClick={() => setIsPasswordModalOpen(true)}
        >
          修改密码
        </Button>
      </Card>

      <Modal
        title="修改密码"
        open={isPasswordModalOpen}
        onCancel={() => {
          setIsPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="旧密码"
            name="old_password"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password placeholder="请输入旧密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不能少于6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirm_password"
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
