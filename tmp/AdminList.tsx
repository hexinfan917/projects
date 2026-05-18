import React, { useRef, useState } from 'react';
import { ProTable, ProColumns, ModalForm, ProFormText, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { request } from '@umijs/max';

const AdminList: React.FC = () => {
  const actionRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [roleOptions, setRoleOptions] = useState<any[]>([]);

  const fetchRoles = async () => {
    const res = await request('/api/v1/admin/roles', { params: { page_size: 100 } });
    if (res.code === 200) {
      const options = res.data.list.map((r: any) => ({ label: r.name, value: r.id }));
      setRoleOptions(options);
    }
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '真实姓名', dataIndex: 'real_name', width: 120, search: false },
    { title: '手机号', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 180, search: false },
    {
      title: '角色',
      dataIndex: 'role_name',
      width: 120,
      search: false,
      render: (text) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: {
        1: { text: '正常', status: 'Success' },
        0: { text: '禁用', status: 'Default' },
      },
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      width: 170,
      search: false,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      search: false,
      render: (_, record) => (
        <Space>
          <a
            onClick={() => {
              setEditData(record);
              setModalVisible(true);
              fetchRoles();
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="确认禁用?"
            onConfirm={async () => {
              const res = await request(`/api/v1/admin/admins/${record.id}`, { method: 'DELETE' });
              if (res.code === 200) {
                message.success('已禁用');
                actionRef.current?.reload();
              } else {
                message.error(res.message || '操作失败');
              }
            }}
          >
            <a style={{ color: '#ff4d4f' }}>禁用</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProTable
        headerTitle="账号管理"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditData(null);
              setModalVisible(true);
              fetchRoles();
            }}
          >
            新建账号
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/admins', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.username || params.phone || '',
            },
          });
          if (res.code === 200) {
            return {
              data: res.data.list,
              total: res.data.total,
              success: true,
            };
          }
          return { data: [], total: 0, success: true };
        }}
        columns={columns}
      />

      <ModalForm
        title={editData ? '编辑账号' : '新建账号'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        initialValues={editData || { status: 1, role_id: undefined }}
        onFinish={async (values) => {
          if (editData) {
            const res = await request(`/api/v1/admin/admins/${editData.id}`, {
              method: 'PUT',
              data: values,
            });
            if (res.code === 200) {
              message.success('更新成功');
              setModalVisible(false);
              actionRef.current?.reload();
            } else {
              message.error(res.message || '更新失败');
            }
          } else {
            const res = await request('/api/v1/admin/admins', {
              method: 'POST',
              data: values,
            });
            if (res.code === 200) {
              message.success('创建成功');
              setModalVisible(false);
              actionRef.current?.reload();
            } else {
              message.error(res.message || '创建失败');
            }
          }
        }}
      >
        <ProFormText name="username" label="用户名" rules={[{ required: true }]} />
        <ProFormText.Password
          name="password"
          label="密码"
          rules={editData ? [] : [{ required: true, min: 6 }]}
          placeholder={editData ? '为空则不修改' : ''}
        />
        <ProFormText name="real_name" label="真实姓名" />
        <ProFormText name="phone" label="手机号" />
        <ProFormText name="email" label="邮箱" />
        <ProFormSelect name="role_id" label="角色" options={roleOptions} />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '正常', value: 1 },
            { label: '禁用', value: 0 },
          ]}
          rules={[{ required: true }]}
        />
      </ModalForm>
    </>
  );
};

export default AdminList;
