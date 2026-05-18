import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormRadio } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const typeMap: Record<string, { text: string; color: string }> = {
  risk_confirm: { text: '高风险活动确认书', color: 'red' },
  travel_notice: { text: '出行前须知', color: 'blue' },
  pet_medical: { text: '宠物医疗授权书', color: 'green' },
  other: { text: '其他', color: 'default' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean'],
  ],
};

export default function AgreementManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [content, setContent] = useState('');
  const formRef = useRef<any>(null);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setContent(record?.content || '');
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue(record || { type: 'other', status: 1, sort_order: 0 });
    }, 0);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/agreements/' + id, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('操作成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = { ...values, content };
      const url = editData ? '/api/v1/admin/agreements/' + editData.id : '/api/v1/admin/agreements';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, { method, data: payload });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        setContent('');
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
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      width: 150,
      valueEnum: {
        risk_confirm: { text: '高风险活动确认书' },
        travel_notice: { text: '出行前须知' },
        pet_medical: { text: '宠物医疗授权书' },
        other: { text: '其他' },
      },
      render: (_: any, record: any) => (
        <Tag color={typeMap[record.type]?.color}>{typeMap[record.type]?.text}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: { 0: { text: '禁用' }, 1: { text: '启用' } },
      render: (_: any, record: any) => (
        <Tag color={statusMap[record.status]?.color}>{statusMap[record.status]?.text}</Tag>
      ),
    },
    { title: '排序', dataIndex: 'sort_order', width: 80, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
          编辑
        </Button>,
        <Popconfirm key="delete" title="确认停用" description="停用后小程序端将不可见，是否继续？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>停用</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="协议管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建协议
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/agreements', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.title,
              type: params.type,
              status: params.status,
            },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 800 }}
      />

      <ModalForm
        title={editData ? '编辑协议' : '新建协议'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={800}
      >
        <ProFormText name="title" label="协议标题" rules={[{ required: true }]} placeholder="如：高风险活动确认书" />
        <ProFormSelect
          name="type"
          label="协议类型"
          rules={[{ required: true }]}
          options={[
            { label: '高风险活动确认书', value: 'risk_confirm' },
            { label: '出行前须知', value: 'travel_notice' },
            { label: '宠物医疗授权书', value: 'pet_medical' },
            { label: '其他', value: 'other' },
          ]}
        />
        <ProFormDigit name="sort_order" label="排序" min={0} initialValue={0} tooltip="越小越靠前" />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
        <div style={{ marginBottom: 8, fontWeight: 500 }}>协议内容</div>
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          modules={quillModules}
          style={{ height: 300, marginBottom: 40 }}
        />
      </ModalForm>
    </PageContainer>
  );
}
