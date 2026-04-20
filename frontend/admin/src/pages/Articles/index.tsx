import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { Button, Tag, Image, message, Popconfirm, Space, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const categoryMap: Record<string, { text: string; color: string }> = {
  travel: { text: '旅行', color: 'blue' },
  guide: { text: '攻略', color: 'green' },
  story: { text: '故事', color: 'purple' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '已发布', color: 'success' },
  2: { text: '已下架', color: 'error' },
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

export default function ArticleManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [content, setContent] = useState('');
  const [form] = Form.useForm();

  const openModal = (record?: any) => {
    setEditData(record || null);
    setContent(record?.content || '');
    form.setFieldsValue(record || { status: 0, is_top: 0, sort_order: 0 });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/articles/' + id, { method: 'DELETE' });
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

  const handleStatusChange = async (record: any, newStatus: number) => {
    try {
      const res = await request('/api/v1/admin/articles/' + record.id, {
        method: 'PUT',
        data: { ...record, status: newStatus },
      });
      if (res.code === 200) {
        message.success('状态更新成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData ? '/api/v1/admin/articles/' + editData.id : '/api/v1/admin/articles';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, {
        method,
        data: { ...values, content },
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
      render: (text: string, record: any) => (
        <div>
          <div>{text}</div>
          {record.is_top === 1 && <Tag color="red" size="small">置顶</Tag>}
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      valueEnum: { travel: { text: '旅行' }, guide: { text: '攻略' }, story: { text: '故事' } },
      render: (category: string) => {
        const config = categoryMap[category] || { text: category, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '作者', dataIndex: 'author_name', width: 120 },
    { title: '浏览', dataIndex: 'view_count', width: 80, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: { 0: { text: '草稿' }, 1: { text: '已发布' }, 2: { text: '已下架' } },
      render: (status: number) => {
        const config = statusMap[status] || { text: '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          {record.status !== 1 && (
            <Button type="link" size="small" icon={<VerticalAlignTopOutlined />} onClick={() => handleStatusChange(record, 1)}>
              发布
            </Button>
          )}
          {record.status === 1 && (
            <Button type="link" size="small" danger icon={<VerticalAlignBottomOutlined />} onClick={() => handleStatusChange(record, 2)}>
              下架
            </Button>
          )}
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
    <PageContainer title="内容管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/articles', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              category: params.category,
              status: params.status,
              keyword: params.title,
            },
          });
          return { data: res.data?.articles || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1300 }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建文章
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑文章' : '新建文章'}
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
            form.resetFields();
          },
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormText name="subtitle" label="副标题" />
        <ProFormText name="cover_image" label="封面图URL" />
        <ProFormSelect
          name="category"
          label="分类"
          options={[
            { label: '旅行', value: 'travel' },
            { label: '攻略', value: 'guide' },
            { label: '故事', value: 'story' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormText name="summary" label="摘要" />
        <Form.Item label="内容" required>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={quillModules}
            style={{ height: 300, marginBottom: 40 }}
          />
        </Form.Item>
        <ProFormText name="author_name" label="作者" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '草稿', value: 0 },
            { label: '已发布', value: 1 },
            { label: '已下架', value: 2 },
          ]}
        />
        <ProFormDigit name="is_top" label="置顶" min={0} max={1} />
        <ProFormDigit name="sort_order" label="排序" min={0} />
      </ModalForm>
    </PageContainer>
  );
}
