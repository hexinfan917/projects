import { PageContainer, ProTable, ModalForm, ProFormText, ProFormDigit, ProFormTextArea, ProFormRadio, ProFormSelect } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

const dimensionOptions = [
  { label: 'E/I 社交倾向', value: 'E/I' },
  { label: 'S/N 感官敏感', value: 'S/N' },
  { label: 'F/T 情感需求', value: 'F/T' },
  { label: 'P/J 生活规律', value: 'P/J' },
];

export default function DogPersonalityModules() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const formRef = useRef<any>(null);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue(record || { is_active: 1 });
    }, 0);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/dog-personality/modules/' + id, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('删除成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData ? '/api/v1/admin/dog-personality/modules/' + editData.id : '/api/v1/admin/dog-personality/modules';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, { method, data: values });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        formRef.current?.resetFields();
        tableRef.current?.reload();
        return true;
      }
      message.error(res.message || (editData ? '更新失败' : '创建失败'));
      return false;
    } catch (error) {
      message.error(editData ? '更新失败' : '创建失败');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '排序', dataIndex: 'module_order', width: 80, search: false },
    { title: '模块名称', dataIndex: 'name', width: 180 },
    {
      title: '绑定四维维度',
      dataIndex: 'bind_dimension',
      width: 140,
      valueType: 'select',
      valueEnum: {
        'E/I': { text: 'E/I 社交倾向' },
        'S/N': { text: 'S/N 感官敏感' },
        'F/T': { text: 'F/T 情感需求' },
        'P/J': { text: 'P/J 生活规律' },
      },
    },
    { title: '描述', dataIndex: 'description', width: 400, ellipsis: true, search: false },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueEnum: { 0: { text: '禁用' }, 1: { text: '启用' } },
      render: (_: any, record: any) => (
        <Tag color={statusMap[record.is_active]?.color}>{statusMap[record.is_active]?.text}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
          编辑
        </Button>,
        <Popconfirm key="delete" title="确认删除" description="删除后不可恢复，是否继续？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="模块管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建模块
          </Button>,
        ]}
        request={async () => {
          const res = await request('/api/v1/admin/dog-personality/modules');
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.list?.length || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <ModalForm
        title={editData ? '编辑模块' : '新建模块'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={600}
      >
        <ProFormText name="name" label="模块名称" rules={[{ required: true }]} />
        <ProFormDigit name="module_order" label="排序" rules={[{ required: true }]} min={1} />
        <ProFormSelect
          name="bind_dimension"
          label="绑定四维维度"
          rules={[{ required: true, message: '请选择绑定维度' }]}
          options={dimensionOptions}
          placeholder="请选择维度"
        />
        <ProFormTextArea name="description" label="模块描述" />
        <ProFormRadio.Group
          name="is_active"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
