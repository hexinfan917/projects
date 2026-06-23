import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Tag, Image, message, Popconfirm, Space, Form, Upload, Input, Select } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { PlusOutlined, EditOutlined, DeleteOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '未开放', color: 'default' },
  1: { text: '可申请', color: 'success' },
  2: { text: '已领养', color: 'processing' },
  3: { text: '已下架', color: 'error' },
};

const genderOptions = [
  { label: '公', value: '公' },
  { label: '母', value: '母' },
];

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

const healthTagOptions = [
  '已疫苗',
  '已驱虫',
  '已绝育',
  '健康体检',
  '性格温顺',
  '适合新手',
].map((t) => ({ label: t, value: t }));

export default function AdoptionDogsManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [adoptionRequirements, setAdoptionRequirements] = useState('');
  const quillRef = useRef<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (modalVisible && editData) {
      const value = editData.adoption_requirements || '';
      setAdoptionRequirements(value);
      // 延迟确保 ReactQuill 已挂载，再用 Quill API 直接写入 HTML，避免受控模式下初始化不同步
      const timer = setTimeout(() => {
        if (quillRef.current && value) {
          try {
            const editor = quillRef.current.getEditor();
            if (editor) {
              editor.setContents([]);
              editor.clipboard.dangerouslyPasteHTML(value);
            }
          } catch (e) {
            console.error('ReactQuill set contents error', e);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [modalVisible, editData]);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setCoverImageUrl(record?.cover_image || '');
    setGallery(record?.images || []);
    const { adoption_requirements: _ar, ...formRecord } = record || {};
    form.setFieldsValue({
      ...formRecord,
      status: record?.status ?? 1,
      health_tags: record?.health_tags || [],
      images: record?.images || [],
    });
    setAdoptionRequirements(record?.adoption_requirements || '');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/adoption/dogs/' + id, { method: 'DELETE' });
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
      const res = await fetch('/api/v1/files/upload/image?crop_ratio=0.8824', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (data.code === 200 && data.data?.url) {
        const url = data.data.url;
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
      const url = editData ? '/api/v1/admin/adoption/dogs/' + editData.id : '/api/v1/admin/adoption/dogs';
      const method = editData ? 'PUT' : 'POST';
      const submitRequirements = adoptionRequirements && adoptionRequirements.trim() !== '<p><br></p>' ? adoptionRequirements : '';
      const data = { ...values, adoption_requirements: submitRequirements };
      const res = await request(url, { method, data });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        setCoverImageUrl('');
        setGallery([]);
        setAdoptionRequirements('');
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
    { title: '名字', dataIndex: 'name', width: 120 },
    { title: '品种', dataIndex: 'breed', width: 120, render: (v: string) => v || '-' },
    { title: '性别', dataIndex: 'gender', width: 80, search: false, render: (v: string) => v || '-' },
    { title: '年龄', dataIndex: 'age', width: 100, search: false, render: (v: string) => v || '-' },
    {
      title: '所在地',
      dataIndex: 'location',
      width: 150,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        0: { text: '未开放' },
        1: { text: '可申请' },
        2: { text: '已领养' },
        3: { text: '已下架' },
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
      width: 180,
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
    <PageContainer title="狗狗档案">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/adoption/dogs', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
              keyword: params.name,
            },
          });
          return { data: res.data?.dogs || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增狗狗
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑狗狗档案' : '新增狗狗档案'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        form={form}
        width={800}
        modalProps={{
          destroyOnClose: true,
          afterClose: () => {
            setEditData(null);
            setCoverImageUrl('');
            setGallery([]);
            setAdoptionRequirements('');
            form.resetFields();
          },
        }}
      >
        <ProFormText name="name" label="名字" rules={[{ required: true }]} />
        <ProFormText name="breed" label="品种" />
        <ProFormSelect name="gender" label="性别" options={genderOptions} />
        <ProFormText name="age" label="年龄" placeholder="如：1岁2个月" />
        <ProFormText name="weight" label="体重" placeholder="如：12kg" />
        <ProFormText name="location" label="所在地" placeholder="如：上海" />
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
          <div style={{ marginTop: 8, padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, color: '#389e0d', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>封面图尺寸建议</div>
            <div>建议尺寸：宽 750px，高 850px（比例约 1:1.13）</div>
            <div>文件格式：JPG / PNG，建议控制在 500KB 以内</div>
            <div>上传后系统将自动按 750:850 比例中心裁剪。封面图用于小程序首页「狗狗领养」卡片和领养列表。</div>
          </div>
        </Form.Item>
        <Form.Item label="狗狗图集">
          <Form.Item name="images" noStyle>
            <Input type="hidden" />
          </Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
            {gallery.map((url, index) => (
              <div key={index} style={{ position: 'relative', width: 120, height: 120 }}>
                <Image
                  src={url}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                  preview={false}
                />
                <Button
                  type="primary"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={() => {
                    const newGallery = gallery.filter((_, i) => i !== index);
                    setGallery(newGallery);
                    form.setFieldsValue({ images: newGallery });
                  }}
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
          <Upload
            name="file"
            action="/api/v1/files/upload/image"
            data={{ crop_ratio: 0.9375 }}
            headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
            showUploadList={false}
            onChange={(info: any) => {
              if (info.file.status === 'done') {
                const url = info.file.response?.data?.url;
                if (url) {
                  const newGallery = [...gallery, url];
                  setGallery(newGallery);
                  form.setFieldsValue({ images: newGallery });
                  message.success(`${info.file.name} 上传成功`);
                }
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name} 上传失败`);
              }
            }}
          >
            <Button icon={<UploadOutlined />}>上传图集</Button>
          </Upload>
          <div style={{ marginTop: 8, padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, color: '#389e0d', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>狗狗图集尺寸建议</div>
            <div>建议尺寸：宽 750px，高 800px（比例约 1:1.07）</div>
            <div>文件格式：JPG / PNG，建议控制在 500KB 以内</div>
            <div>上传后系统将自动按 750:800 比例中心裁剪。图集用于小程序领养详情页顶部轮播。</div>
          </div>
        </Form.Item>
        <Form.Item name="health_tags" label="健康标签">
          <Select
            mode="tags"
            placeholder="可选择或输入自定义标签"
            options={healthTagOptions}
            style={{ width: '100%' }}
            allowClear
          />
        </Form.Item>
        <ProFormTextArea
          name="story"
          label="救助故事 / 性格描述"
          fieldProps={{ rows: 5 }}
        />
        <Form.Item label="领养要求">
          <ReactQuill
            ref={quillRef}
            key={`quill-${editData?.id || 'new'}-${modalVisible ? 'open' : 'closed'}`}
            theme="snow"
            value={adoptionRequirements}
            onChange={setAdoptionRequirements}
            modules={quillModules}
            style={{ height: 200, marginBottom: 40 }}
          />
        </Form.Item>
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '未开放', value: 0 },
            { label: '可申请', value: 1 },
            { label: '已领养', value: 2 },
            { label: '已下架', value: 3 },
          ]}
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
