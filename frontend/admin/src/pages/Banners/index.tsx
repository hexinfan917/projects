import { PageContainer, ProTable, ModalForm, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Tag, Image, message, Popconfirm, Space, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

export default function BannerManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const formRef = useRef<any>(null);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setImageUrl(record?.image_url || '');
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue(record || { status: 1, sort_order: 0 });
    }, 0);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/banners/' + id, { method: 'DELETE' });
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
      const res = await request('/api/v1/admin/banners/' + record.id, {
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
      if (!imageUrl) {
        message.error('请上传轮播图片');
        return false;
      }
      const submitData = { ...values, image_url: imageUrl };
      const url = editData ? '/api/v1/admin/banners/' + editData.id : '/api/v1/admin/banners';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, {
        method,
        data: submitData,
      });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        setImageUrl('');
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

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await request('/api/v1/files/upload/image', {
        method: 'POST',
        data: formData,
        requestType: 'form',
      });
      if (res.code === 200 && res.data?.url) {
        const url = res.data.url.startsWith('http') ? res.data.url : `http://localhost:8081${res.data.url}`;
        setImageUrl(url);
        message.success('上传成功');
      } else {
        message.error(res.message || '上传失败');
      }
    } catch (error) {
      message.error('上传失败');
    }
    return false;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '图片',
      dataIndex: 'image_url',
      width: 160,
      search: false,
      render: (url: string) =>
        url ? <Image src={url} width={140} height={70} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ color: '#999' }}>无</span>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: '链接',
      dataIndex: 'link_url',
      width: 250,
      ellipsis: true,
      search: false,
      render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-',
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
      width: 100,
      valueEnum: { 0: { text: '禁用' }, 1: { text: '启用' } },
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
      width: 220,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          {record.status !== 1 && (
            <Button type="link" size="small" onClick={() => handleStatusChange(record, 1)}>
              启用
            </Button>
          )}
          {record.status === 1 && (
            <Button type="link" size="small" danger onClick={() => handleStatusChange(record, 0)}>
              禁用
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
    <PageContainer title="首页轮播管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/banners', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
              keyword: params.title,
            },
          });
          return { data: res.data?.banners || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1100 }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建轮播图
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑轮播图' : '新建轮播图'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={700}
        modalProps={{
          destroyOnClose: true,
          afterClose: () => {
            setImageUrl('');
            setEditData(null);
          },
        }}
      >
        <ProFormText name="title" label="标题" />
        <ProFormText name="link_url" label="跳转链接" placeholder="可选，填写后点击轮播图可跳转" />
        <ProFormDigit name="sort_order" label="排序" min={0} max={9999} initialValue={0} tooltip="数字越大越靠前" />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.88)', fontWeight: 500 }}>轮播图片 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleUpload}
          >
            {imageUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Image src={imageUrl} width={300} height={150} style={{ objectFit: 'cover', borderRadius: 4 }} preview={false} />
                <div style={{ marginTop: 8, color: '#1890ff', cursor: 'pointer' }}>点击更换图片</div>
              </div>
            ) : (
              <div style={{ width: 300, height: 150, border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <PlusOutlined style={{ fontSize: 28, color: '#999' }} />
                <div style={{ marginTop: 8, color: '#999' }}>点击上传图片</div>
              </div>
            )}
          </Upload>
        </div>
      </ModalForm>
    </PageContainer>
  );
}
