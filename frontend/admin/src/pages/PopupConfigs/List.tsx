import { PageContainer, ProTable, ModalForm, ProFormText, ProFormRadio, ProFormTextArea, ProFormDateTimePicker, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Space, Upload, Form, Image, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '停用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

export default function PopupConfigList() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const formRef = useRef<any>(null);
  const [memberPlans, setMemberPlans] = useState<any[]>([]);

  useEffect(() => {
    request('/api/v1/admin/member-plans', { params: { page: 1, page_size: 100 } })
      .then(res => {
        if (res.code === 200) {
          setMemberPlans(res.data?.list || []);
        }
      })
      .catch(() => {});
  }, []);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      const defaultContent = {
        benefits: ['全场路线9.5折', '每月赠送¥30券包'],
        price_display: '¥29/月',
        original_price: '¥39/月',
      };
      const content = record?.content || defaultContent;
      const values = record
        ? {
            ...record,
            target_page: record.target_page || '/pages/member/center/index',
            content_benefits: content.benefits || [],
            content_price_display: content.price_display || '',
            content_original_price: content.original_price || '',
          }
        : {
            status: 1,
            trigger_type: 1,
            primary_btn_text: '立即开通',
            primary_btn_color: '#FF6B35',
            close_btn_text: '暂不开通',
            type: 'member_activity',
            target_page: '/pages/member/center/index',
            content_benefits: defaultContent.benefits,
            content_price_display: defaultContent.price_display,
            content_original_price: defaultContent.original_price,
          };
      formRef.current?.setFieldsValue(values);
    }, 100);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/popups/' + id, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('已停用');
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
      const payload = {
        ...values,
        content: {
          benefits: values.content_benefits || [],
          price_display: values.content_price_display || '',
          original_price: values.content_original_price || '',
        },
      };
      delete (payload as any).content_benefits;
      delete (payload as any).content_price_display;
      delete (payload as any).content_original_price;
      const url = editData ? '/api/v1/admin/popups/' + editData.id : '/api/v1/admin/popups';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, { method, data: payload });
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
    } catch (error: any) {
      message.error('提交失败，请检查表单内容');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '类型', dataIndex: 'type', width: 120 },
    { title: '标题', dataIndex: 'title', width: 180, ellipsis: true },
    { title: '副标题', dataIndex: 'subtitle', width: 180, ellipsis: true, search: false },
    { title: '跳转路径', dataIndex: 'target_page', width: 180, ellipsis: true, search: false },
    {
      title: '触发方式',
      dataIndex: 'trigger_type',
      width: 120,
      search: false,
      render: (v: number) => (v === 1 ? '首次进入' : '每次进入'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      search: false,
      render: (status: number) => {
        const map: Record<number, { text: string; color: string }> = {
          0: { text: '停用', color: 'default' },
          1: { text: '启用', color: 'success' },
        };
        return <Tag color={map[status]?.color}>{map[status]?.text}</Tag>;
      },
    },
    {
      title: '有效期',
      width: 200,
      search: false,
      render: (_: any, record: any) =>
        `${record.start_time ? dayjs(record.start_time).format('MM-DD HH:mm') : '-'} ~ ${record.end_time ? dayjs(record.end_time).format('MM-DD HH:mm') : '-'}`,
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
        <Popconfirm key="delete" title="确认停用" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>停用</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="弹窗配置">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建弹窗
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/popups', {
            params: { type: params.type },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.list?.length || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <ModalForm
        title={editData ? '编辑弹窗配置' : '新建弹窗配置'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={700}
      >
        <ProFormText name="type" label="弹窗类型" rules={[{ required: true }]} initialValue="member_activity" />
        <ProFormText name="title" label="标题" />
        <ProFormText name="subtitle" label="副标题" />
        <ProFormText name="image" hidden />
        <Form.Item label="主图" shouldUpdate={(prev, next) => prev.image !== next.image}>
          {({ getFieldValue, setFieldValue }) => {
            const imageUrl = getFieldValue('image');
            return (
              <Space direction="vertical" style={{ width: '100%' }}>
                {imageUrl && (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Image src={imageUrl} alt="主图预览" style={{ maxHeight: 160, borderRadius: 8 }} />
                    <CloseCircleOutlined
                      style={{ position: 'absolute', top: -8, right: -8, fontSize: 18, color: '#ff4d4f', cursor: 'pointer', background: '#fff', borderRadius: '50%' }}
                      onClick={() => setFieldValue('image', undefined)}
                    />
                  </div>
                )}
                <Upload
                  name="file"
                  action="/api/v1/files/upload/image"
                  showUploadList={false}
                  headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
                  onChange={(info) => {
                    if (info.file.status === 'done') {
                      const url = info.file.response?.data?.url || info.file.response?.url || info.file.response;
                      if (url) {
                        setFieldValue('image', typeof url === 'string' ? url : url.url || url.data);
                        message.success('上传成功');
                      }
                    } else if (info.file.status === 'error') {
                      message.error('上传失败');
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />}>{imageUrl ? '更换图片' : '上传图片'}</Button>
                </Upload>
              </Space>
            );
          }}
        </Form.Item>
        <Form.Item label="权益列表">
          <Form.List name="content_benefits">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex' }} align="baseline">
                    <Form.Item {...restField} name={[name]} noStyle>
                      <Input placeholder="如：全场路线9.5折" style={{ width: 360 }} />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)} icon={<MinusCircleOutlined />}>删除</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>添加权益</Button>
              </Space>
            )}
          </Form.List>
        </Form.Item>
        <ProFormText name="content_price_display" label="显示价格" placeholder="如：¥29/月" />
        <ProFormText name="content_original_price" label="原价" placeholder="如：¥39/月" />
        <ProFormText name="primary_btn_text" label="主按钮文案" initialValue="立即开通" />
        <ProFormText name="primary_btn_color" label="主按钮颜色" initialValue="#FF6B35" />
        <ProFormText name="close_btn_text" label="关闭按钮文案" initialValue="暂不开通" />
        <ProFormRadio.Group
          name="trigger_type"
          label="触发方式"
          options={[
            { label: '首次进入', value: 1 },
            { label: '每次进入', value: 2 },
          ]}
        />
        <ProFormDigit name="show_duration_seconds" label="自动关闭时间(秒)" min={0} initialValue={0} tooltip="0表示不自动关闭" />
        <ProFormSelect
          name="target_plan_id"
          label="跳转套餐"
          placeholder="请选择会员套餐"
          tooltip="点击主按钮跳转的会员套餐"
          options={memberPlans.map((p: any) => ({ label: `${p.name}（¥${p.sale_price}）`, value: p.id }))}
          allowClear
        />
        <ProFormText name="target_page" label="跳转页面路径" placeholder="如：/pages/member/center/index" initialValue="/pages/member/center/index" />
        <ProFormDateTimePicker name="start_time" label="开始时间" />
        <ProFormDateTimePicker name="end_time" label="结束时间" />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
