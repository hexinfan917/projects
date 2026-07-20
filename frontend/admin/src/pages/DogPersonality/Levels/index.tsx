import { PageContainer, ProTable, ModalForm, ProFormText, ProFormTextArea, ProFormRadio } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

export default function DogPersonalityLevels() {
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
      const res = await request('/api/v1/admin/dog-personality/levels/' + id, { method: 'DELETE' });
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
      const url = editData ? '/api/v1/admin/dog-personality/levels/' + editData.id : '/api/v1/admin/dog-personality/levels';
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
    { title: '犬格编码', dataIndex: 'code', width: 90 },
    { title: '分型名称', dataIndex: 'title', width: 160 },
    { title: '性格解读', dataIndex: 'description', width: 220, ellipsis: true, search: false },
    { title: '饲养训练指南', dataIndex: 'guide', width: 220, ellipsis: true, search: false },
    { title: '业务推荐', dataIndex: 'recommendation', width: 160, ellipsis: true, search: false },
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
    <PageContainer title="分型管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建分型
          </Button>,
        ]}
        request={async () => {
          const res = await request('/api/v1/admin/dog-personality/levels');
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.list?.length || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <ModalForm
        title={editData ? '编辑分型' : '新建分型'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={720}
      >
        <ProFormText
          name="code"
          label="犬格编码"
          disabled={!!editData}
          tooltip={editData ? '犬格编码创建后不可修改' : undefined}
          rules={[{ required: true }, { pattern: /^[EI][SN][FT][PJ]$/, message: '请输入 4 位有效编码，按位对应 E/I、S/N、F/T、P/J' }]}
          placeholder="如：ESFP"
        />
        <ProFormText name="title" label="分型名称" rules={[{ required: true }]} placeholder="如：快乐社交家" />
        <ProFormTextArea name="description" label="性格解读" rules={[{ required: true }]} fieldProps={{ rows: 4 }} />
        <ProFormTextArea name="guide" label="饲养 & 训练指南" rules={[{ required: true }]} fieldProps={{ rows: 4 }} />
        <ProFormTextArea name="recommendation" label="业务推荐" rules={[{ required: true }]} fieldProps={{ rows: 3 }} />
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
