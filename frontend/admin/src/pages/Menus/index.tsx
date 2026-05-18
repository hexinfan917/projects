import React, { useRef, useState } from 'react';
import { ProTable, ProColumns, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormTreeSelect } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { request } from '@umijs/max';

const MenuList: React.FC = () => {
  const actionRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [menuOptions, setMenuOptions] = useState<any[]>([]);

  const fetchMenuTree = async () => {
    const res = await request('/api/v1/admin/menus/tree');
    if (res.code === 200) {
      const format = (nodes: any[]): any[] =>
        nodes.map((n) => ({
          title: n.name,
          value: n.id,
          key: n.id,
          children: n.children && n.children.length > 0 ? format(n.children) : undefined,
        }));
      setMenuOptions([{ title: '顶级菜单', value: 0, key: 0 }, ...format(res.data)]);
    }
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '菜单名称',
      dataIndex: 'name',
      render: (text, record) => (
        <Space>
          {record.icon && <span>{record.icon}</span>}
          <span>{text}</span>
        </Space>
      ),
    },
    { title: '路径', dataIndex: 'path', search: false },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      search: false,
      valueEnum: {
        1: { text: '目录', status: 'Default' },
        2: { text: '菜单', status: 'Processing' },
        3: { text: '按钮', status: 'Warning' },
      },
    },
    { title: '排序', dataIndex: 'sort_order', width: 70, search: false },
    { title: '权限标识', dataIndex: 'permission', width: 140, search: false },
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
              await fetchMenuTree();
              setModalVisible(true);
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="确认禁用?"
            onConfirm={async () => {
              const res = await request(`/api/v1/admin/menus/${record.id}`, { method: 'DELETE' });
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
        headerTitle="菜单管理"
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
              await fetchMenuTree();
              setModalVisible(true);
            }}
          >
            新建菜单
          </Button>,
        ]}
        request={async () => {
          const res = await request('/api/v1/admin/menus');
          if (res.code === 200) {
            return { data: res.data.list, total: res.data.list.length, success: true };
          }
          return { data: [], total: 0, success: true };
        }}
        columns={columns}
      />

      <ModalForm
        title={editData ? '编辑菜单' : '新建菜单'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        initialValues={editData || { parent_id: 0, type: 2, sort_order: 0, status: 1 }}
        onFinish={async (values) => {
          if (editData) {
            const res = await request(`/api/v1/admin/menus/${editData.id}`, {
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
            const res = await request('/api/v1/admin/menus', {
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
        <ProFormTreeSelect
          name="parent_id"
          label="父菜单"
          treeData={menuOptions}
          rules={[{ required: true }]}
        />
        <ProFormText name="name" label="菜单名称" rules={[{ required: true }]} />
        <ProFormText name="path" label="路由路径" />
        <ProFormText name="icon" label="图标" />
        <ProFormDigit name="sort_order" label="排序" min={0} />
        <ProFormSelect
          name="type"
          label="类型"
          options={[
            { label: '目录', value: 1 },
            { label: '菜单', value: 2 },
            { label: '按钮', value: 3 },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormText name="permission" label="权限标识" />
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

export default MenuList;
