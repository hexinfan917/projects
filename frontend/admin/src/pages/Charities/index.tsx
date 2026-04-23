import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { Button, Tag, Image, message, Popconfirm, Space, Form, Upload, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const typeMap: Record<string, { text: string; color: string }> = {
  volunteer: { text: '义工招募', color: 'blue' },
  rescue: { text: '流浪救助', color: 'orange' },
  donate: { text: '爱心捐赠', color: 'red' },
  adopt: { text: '宠物领养', color: 'green' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '报名中', color: 'success' },
  2: { text: '进行中', color: 'processing' },
  3: { text: '已结束', color: 'error' },
  4: { text: '已取消', color: 'warning' },
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

export default function CharityManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [form] = Form.useForm();

  const openModal = (record?: any) => {
    setEditData(record || null);
    setContent(record?.content || '');
    setCoverImageUrl(record?.cover_image || '');
    form.setFieldsValue(record || { status: 0, activity_type: 'adopt' });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/charities/activities/' + id, { method: 'DELETE' });
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

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/files/upload/image', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (data.code === 200 && data.data?.url) {
        const url = data.data.url.startsWith('http') ? data.data.url : `http://localhost:8081${data.data.url}`;
        setCoverImageUrl(url);
        form.setFieldsValue({ cover_image: url });
        message.success('上传成功');
      } else {
        message.error(data.message || '上传失败');
      }
    } catch (error) {
      message.error('上传失败');
    } finally {
      setCoverUploading(false);
    }
    return false;
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData ? '/api/v1/admin/charities/activities/' + editData.id : '/api/v1/admin/charities/activities';
      const method = editData ? 'PUT' : 'POST';
      const data = { ...values, content };
      if (data.start_date && data.start_date.format) {
        data.start_date = data.start_date.format('YYYY-MM-DD');
      }
      if (data.end_date && data.end_date.format) {
        data.end_date = data.end_date.format('YYYY-MM-DD');
      }
      const res = await request(url, {
        method,
        data,
      });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        setContent('');
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
    {
      title: '封面',
      dataIndex: 'cover_image',
      width: 100,
      search: false,
      render: (url: string) =>
        url ? <Image src={url} width={80} height={60} style={{ objectFit: 'cover' }} /> : <span style={{ color: '#999' }}>无</span>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'activity_type',
      width: 100,
      valueEnum: {
        volunteer: { text: '义工招募' },
        rescue: { text: '流浪救助' },
        donate: { text: '爱心捐赠' },
        adopt: { text: '宠物领养' },
      },
      render: (type: string) => {
        const config = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '地点',
      dataIndex: 'location',
      width: 150,
      ellipsis: true,
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      width: 120,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        0: { text: '草稿' },
        1: { text: '报名中' },
        2: { text: '进行中' },
        3: { text: '已结束' },
        4: { text: '已取消' },
      },
      render: (status: number) => {
        const config = statusMap[status] || { text: '未知', color: 'default' };
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
      width: 160,
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
    <PageContainer title="公益管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/charities/activities', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              activity_type: params.activity_type,
              status: params.status,
              keyword: params.title,
            },
          });
          return { data: res.data?.activities || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1300 }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建活动
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑公益活动' : '新建公益活动'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        form={form}
        width={900}
        modalProps={{
          destroyOnClose: true,
          afterClose: () => {
            setContent('');
            setEditData(null);
            setCoverImageUrl('');
            form.resetFields();
          },
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormText name="subtitle" label="副标题" />
        <Form.Item label="封面图">
          <Form.Item name="cover_image" noStyle>
            <Input type="hidden" />
          </Form.Item>
          <Upload
            listType="picture-card"
            showUploadList={false}
            beforeUpload={handleCoverUpload}
            accept="image/*"
          >
            {coverImageUrl ? (
              <Image src={coverImageUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} preview={false} />
            ) : (
              <div>
                {coverUploading ? <LoadingOutlined /> : <PlusOutlined />}
                <div style={{ marginTop: 8 }}>上传封面</div>
              </div>
            )}
          </Upload>
          {coverImageUrl && (
            <Button type="link" size="small" danger onClick={() => { setCoverImageUrl(''); form.setFieldsValue({ cover_image: '' }); }}>
              删除封面
            </Button>
          )}
        </Form.Item>
        <ProFormSelect
          name="activity_type"
          label="活动类型"
          options={[
            { label: '义工招募', value: 'volunteer' },
            { label: '流浪救助', value: 'rescue' },
            { label: '爱心捐赠', value: 'donate' },
            { label: '宠物领养', value: 'adopt' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormText name="location" label="活动地点" />
        <ProFormDatePicker name="start_date" label="开始日期" />
        <ProFormDatePicker name="end_date" label="结束日期" />
        <ProFormText name="contact_name" label="联系人" />
        <ProFormText name="contact_phone" label="联系电话" />
        <ProFormText name="organizer" label="主办方" />
        <Form.Item label="活动内容" required>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={quillModules}
            style={{ height: 300, marginBottom: 40 }}
          />
        </Form.Item>
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '草稿', value: 0 },
            { label: '报名中', value: 1 },
            { label: '进行中', value: 2 },
            { label: '已结束', value: 3 },
            { label: '已取消', value: 4 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
