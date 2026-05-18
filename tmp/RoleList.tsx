import React, { useRef, useState } from 'react';
import { ProTable, ProColumns, ModalForm, ProFormText, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tree } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { request } from '@umijs/max';

const RoleList: React.FC = () => {
  const actionRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [menuTree, setMenuTree] = useState<any[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  const fetchMenus = async () => {
    const res = await request('/api/v1/admin/menus/tree');
    if (res.code === 200) {
      const formatTree = (nodes: any[]): any[] =>
        nodes.map((n) => ({
          title: n.name,
          key: String(n.id),
          children: n.children && n.children.length > 0 ? formatTree(n.children) : undefined,
        }));
      setMenuTree(formatTree(res.data));
    }
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '角色名称', dataIndex: 'name', width: 150 },
    { title: '角色编码', dataIndex: 'code', width: 150 },
    { title: '描述', dataIndex: 'description', ellipsis: true, search: false },
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
      title: '操作',
      width: 160,
      fixed: 'right',
      search: false,
      render: (_, record) => (
        <Space>
          <a
            onClick={async () => {
              setEditData(record);
              await fetchMenus();
              setCheckedKeys(record.menu_ids ? record.menu_ids.map(String) : []);
              setModalVisible(true);
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="确认禁用?"
            onConfirm={async () => {
              const res = await request(`/api/v1/admin/roles/${record.id}`, { method: 'DELETE' });
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
        headerTitle="角色管理"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={async () => {
              setEditData(null);
              setCheckedKeys([]);
              await fetchMenus();
              setModalVisible(true);
            }}
          >
            新建角色
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/roles', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.name || params.code || '',
            },
          });
          if (res.code === 200) {
            return { data: res.data.list, total: res.data.total, success: true };
          }
          return { data: [], total: 0, success: true };
        }}
        columns={columns}
      />

      <ModalForm
        title={editData ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        initialValues={editData || { status: 1 }}
        onFinish={async (values) => {
          const payload = { ...values, menu_ids: checkedKeys.map(Number) };
          if (editData) {
            const res = await request(`/api/v1/admin/roles/${editData.id}`, {
              method: 'PUT',
              data: payload,
            });
            if (res.code === 200) {
              message.success('更新成功');
              setModalVisible(false);
              actionRef.current?.reload();
            } else {
              message.error(res.message || '更新失败');
            }
          } else {
            const res = await request('/api/v1/admin/roles', {
              method: 'POST',
              data: payload,
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
        <ProFormText name="name" label="角色名称" rules={[{ required: true }]} />
        <ProFormText name="code" label="角色编码" rules={[{ required: true }]} />
        <ProFormTextArea name="description" label="描述" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '正常', value: 1 },
            { label: '禁用', value: 0 },
          ]}
          rules={[{ required: true }]}
        />
        <div style={{ marginBottom: 8 }}>菜单权限</div>
        <Tree
          checkable
          treeData={menuTree}
          checkedKeys={checkedKeys}
          onCheck={(keys: any) => setCheckedKeys(keys.checked || keys)}
        />
      </ModalForm>
    </>
  );
};

export default RoleList;
