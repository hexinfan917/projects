import {
  PageContainer,
  ProTable,
  ModalForm,
  ProFormText,
  ProFormDigit,
  ProFormRadio,
} from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

export default function AddonCategoryManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/addon-categories/' + id, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('删除成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData
        ? '/api/v1/admin/addon-categories/' + editData.id
        : '/api/v1/admin/addon-categories';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, { method, data: values });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        tableRef.current?.reload();
        return true;
      }
      message.error(res.message || (editData ? '更新失败' : '创建失败'));
      return false;
    } catch {
      message.error(editData ? '更新失败' : '创建失败');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '标识码',
      dataIndex: 'code',
      width: 120,
    },
    {
      title: '分类名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueEnum: {
        0: { text: '禁用' },
        1: { text: '启用' },
      },
      render: (_: any, record: any) => {
        const config = statusMap[record.status] || { text: '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后无法恢复，是否继续？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="行程选配分类">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/addon-categories', {
            params: { status: params.status },
          });
          return {
            data: res.data?.categories || [],
            success: res.code === 200,
            total: res.data?.categories?.length || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建分类
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑分类' : '新建分类'}
        open={modalVisible}
        onOpenChange={(open) => {
          setModalVisible(open);
          if (!open) setEditData(null);
        }}
        onFinish={handleSubmit}
        width={520}
        modalProps={{ destroyOnClose: true }}
        initialValues={editData || { status: 1, sort_order: 0 }}
      >
        <ProFormText
          name="code"
          label="标识码"
          rules={[{ required: true, message: '请输入标识码' }]}
          placeholder="如 dog_ticket、hotel"
          extra="唯一标识，创建后不建议修改。特殊标识 dog_ticket 和 hotel 会启用对应的特殊表单。"
          disabled={!!editData}
        />
        <ProFormText
          name="name"
          label="分类名称"
          rules={[{ required: true, message: '请输入分类名称' }]}
          placeholder="如 狗狗票、酒店"
        />
        <ProFormDigit name="sort_order" label="排序" min={0} />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '禁用', value: 0 },
            { label: '启用', value: 1 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
