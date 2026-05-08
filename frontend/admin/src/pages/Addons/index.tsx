import {
  PageContainer,
  ProTable,
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormDigit,
  ProFormTextArea,
  ProFormRadio,
} from '@ant-design/pro-components';
import {
  Button,
  Tag,
  message,
  Popconfirm,
  Space,
  Form,
  Input,
  Upload,
  Image,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const categoryMap: Record<string, { text: string; color: string }> = {
  dog_ticket: { text: '狗狗票', color: 'blue' },
  hotel: { text: '酒店', color: 'green' },
  amusement: { text: '游乐项目', color: 'purple' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '下架', color: 'default' },
  1: { text: '上架', color: 'success' },
};

/* ---------- 酒店房型图片上传组件 ---------- */
function RoomImageUploader({ value = [], onChange }: any) {
  const images: string[] = value || [];
  const handleUpload = (info: any) => {
    if (info.file.status === 'done') {
      const url = info.file.response?.data?.url;
      if (url) {
        const fullUrl = url.startsWith('http') ? url : `http://localhost:8081${url}`;
        onChange?.([...images, fullUrl]);
      }
    }
  };
  const removeImage = (idx: number) => {
    onChange?.(images.filter((_, i) => i !== idx));
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {images.map((url: string, idx: number) => (
          <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
            <Image
              src={url}
              width={80}
              height={80}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={{ mask: '查看' }}
            />
            <Button
              type="primary"
              danger
              size="small"
              style={{ position: 'absolute', top: 0, right: 0, padding: '0 4px', minWidth: 20, height: 20 }}
              onClick={() => removeImage(idx)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Upload
        name="file"
        action="/api/v1/files/upload/image"
        headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
        onChange={handleUpload}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} size="small">
          上传图片
        </Button>
      </Upload>
    </div>
  );
}

/* ---------- 标签输入组件（逗号/回车分隔） ---------- */
function TagInput({ value = [], onChange }: any) {
  const [inputValue, setInputValue] = useState('');
  const tags: string[] = value || [];
  const addTag = () => {
    const v = inputValue.trim();
    if (v && !tags.includes(v)) {
      onChange?.([...tags, v]);
      setInputValue('');
    }
  };
  const removeTag = (tag: string) => {
    onChange?.(tags.filter((t) => t !== tag));
  };
  return (
    <div>
      <Space wrap style={{ marginBottom: 4 }}>
        {tags.map((tag) => (
          <Tag key={tag} closable onClose={() => removeTag(tag)}>
            {tag}
          </Tag>
        ))}
      </Space>
      <Input
        size="small"
        placeholder="输入后回车添加"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={addTag}
        onBlur={addTag}
      />
    </div>
  );
}

export default function AddonManage() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const editDataRef = useRef<any>(null);
  const [form] = Form.useForm();
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const res = await request('/api/v1/admin/routes', { params: { page: 1, page_size: 100 } });
      const list = res.data?.routes || [];
      setRoutes(list.map((r: any) => ({ label: r.name, value: r.id })));
    } catch (err) {
      console.error('加载路线列表失败:', err);
    }
  };

  const openModal = (record?: any) => {
    setEditData(record || null);
    editDataRef.current = record || null;
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/addons/' + id, { method: 'DELETE' });
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

  const handleStatusChange = async (record: any, newStatus: number) => {
    try {
      const res = await request('/api/v1/admin/addons/' + record.id, {
        method: 'PUT',
        data: { ...record, status: newStatus },
      });
      if (res.code === 200) {
        message.success('状态更新成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch {
      message.error('更新失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData ? '/api/v1/admin/addons/' + editData.id : '/api/v1/admin/addons';
      const method = editData ? 'PUT' : 'POST';
      const data = { ...values };

      // 处理狗狗票选项
      if (data.category === 'dog_ticket' && data.dog_ticket_options?.length > 0) {
        data.extra_config = {
          ...(data.extra_config || {}),
          options: data.dog_ticket_options.filter((o: any) => o.name && o.price !== undefined),
        };
      }
      delete data.dog_ticket_options;

      // 处理酒店房型
      if (data.category === 'hotel' && data.hotel_rooms?.length > 0) {
        data.extra_config = {
          ...(data.extra_config || {}),
          rooms: data.hotel_rooms.filter((r: any) => r.name && r.price !== undefined),
        };
      }
      delete data.hotel_rooms;

      const res = await request(url, {
        method,
        data,
      });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        editDataRef.current = null;
        form.resetFields();
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
      title: '名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      valueEnum: {
        dog_ticket: { text: '狗狗票' },
        hotel: { text: '酒店' },
        amusement: { text: '游乐项目' },
      },
      render: (category: string) => {
        const config = categoryMap[category] || { text: category, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '关联线路',
      dataIndex: 'route_id',
      width: 150,
      search: false,
      render: (routeId: number) => {
        const route = routes.find((r: any) => r.value === routeId);
        return route?.label || routeId;
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      search: false,
      render: (price: number) => `¥${price}`,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 80,
      search: false,
    },
    {
      title: '已售',
      dataIndex: 'sold',
      width: 80,
      search: false,
    },
    {
      title: '限购',
      dataIndex: 'limit_per_order',
      width: 80,
      search: false,
      render: (v: number) => (v > 0 ? v : '不限'),
    },
    {
      title: '必选',
      dataIndex: 'is_required',
      width: 80,
      search: false,
      render: (v: number) => (v === 1 ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
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
      width: 200,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          {record.status !== 1 ? (
            <Button type="link" size="small" onClick={() => handleStatusChange(record, 1)}>
              上架
            </Button>
          ) : (
            <Button type="link" size="small" danger onClick={() => handleStatusChange(record, 0)}>
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
    <PageContainer title="行程选配管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/addons', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              category: params.category,
              status: params.status,
              keyword: params.name,
            },
          });
          return { data: res.data?.addons || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1300 }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建选配
          </Button>,
        ]}
      />
      <ModalForm
        title={editData ? '编辑行程选配' : '新建行程选配'}
        open={modalVisible}
        onOpenChange={(open) => {
          setModalVisible(open);
          if (open) {
            setTimeout(() => {
              const record = editDataRef.current;
              if (record) {
                const values: any = { ...record };
                if (record.extra_config?.options) {
                  values.dog_ticket_options = record.extra_config.options;
                }
                if (record.extra_config?.rooms) {
                  values.hotel_rooms = record.extra_config.rooms;
                }
                form.setFieldsValue(values);
              } else {
                form.setFieldsValue({
                  category: 'dog_ticket',
                  status: 1,
                  sort_order: 0,
                  stock: 999,
                  limit_per_order: 0,
                  is_required: 0,
                  need_info: 0,
                  unit: '份',
                });
              }
            }, 50);
          }
        }}
        onFinish={handleSubmit}
        form={form}
        width={900}
        modalProps={{
          destroyOnClose: true,
          afterClose: () => {
            setEditData(null);
            editDataRef.current = null;
            form.resetFields();
          },
        }}
      >
        <ProFormSelect
          name="route_id"
          label="关联线路"
          options={routes}
          rules={[{ required: true, message: '请选择线路' }]}
        />
        <ProFormSelect
          name="category"
          label="分类"
          options={[
            { label: '狗狗票', value: 'dog_ticket' },
            { label: '酒店', value: 'hotel' },
            { label: '游乐项目', value: 'amusement' },
          ]}
          rules={[{ required: true }]}
        />

        {/* 狗狗票选项规格 */}
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const category = getFieldValue('category');
            if (category !== 'dog_ticket') return null;
            return (
              <Form.Item label="狗狗票选项规格">
                <Form.List name="dog_ticket_options">
                  {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fields.map(({ key, name, ...restField }) => (
                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                          <Form.Item
                            {...restField}
                            name={[name, 'name']}
                            rules={[{ required: true, message: '请输入选项名称' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="选项名称" style={{ width: 160 }} />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'price']}
                            rules={[{ required: true, message: '请输入价格' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input type="number" placeholder="价格" style={{ width: 100 }} prefix="¥" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'description']}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="说明（如适用犬型）" style={{ width: 220 }} />
                          </Form.Item>
                          <Button type="link" danger onClick={() => remove(name)}>
                            删除
                          </Button>
                        </Space>
                      ))}
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        添加选项规格
                      </Button>
                    </div>
                  )}
                </Form.List>
              </Form.Item>
            );
          }}
        </Form.Item>

        {/* 酒店房型配置 */}
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const category = getFieldValue('category');
            if (category !== 'hotel') return null;
            return (
              <Form.Item label="酒店房型">
                <Form.List name="hotel_rooms">
                  {(fields, { add, remove }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {fields.map(({ key, name, ...restField }) => (
                        <Card
                          key={key}
                          size="small"
                          title={`房型 ${name + 1}`}
                          extra={
                            <Button type="link" danger size="small" onClick={() => remove(name)}>
                              删除
                            </Button>
                          }
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item
                                {...restField}
                                name={[name, 'name']}
                                label="房型名称"
                                rules={[{ required: true, message: '请输入房型名称' }]}
                              >
                                <Input placeholder="如：涵香·私汤温馨大床房" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'area']} label="面积">
                                <Input placeholder="如：35㎡" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={8}>
                              <Form.Item {...restField} name={[name, 'window']} label="窗户">
                                <Input placeholder="如：有窗" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...restField} name={[name, 'max_guests']} label="最多入住人数">
                                <Input type="number" placeholder="如：2" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...restField} name={[name, 'max_pets']} label="最多携宠数量">
                                <Input type="number" placeholder="如：2" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'bed_type']} label="床型">
                                <Input placeholder="如：2张单人床（2×1.5米）" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'breakfast']} label="早餐">
                                <Input placeholder="如：含2份早餐" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'pet_weight_limit']} label="携宠体重限制">
                                <Input placeholder="如：体重无限制" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                {...restField}
                                name={[name, 'stock']}
                                label="库存"
                                rules={[{ required: true }]}
                              >
                                <Input type="number" placeholder="如：2" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={8}>
                              <Form.Item
                                {...restField}
                                name={[name, 'price']}
                                label="售价"
                                rules={[{ required: true }]}
                              >
                                <Input type="number" placeholder="如：382" prefix="¥" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...restField} name={[name, 'original_price']} label="原价">
                                <Input type="number" placeholder="如：442" prefix="¥" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item {...restField} name={[name, 'filters']} label="过滤标签">
                                <TagInput />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'tags']} label="房型标签">
                                <TagInput />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} name={[name, 'images']} label="房型图片">
                                <RoomImageUploader />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item {...restField} name={[name, 'cancel_policy']} label="退订政策">
                            <Input.TextArea rows={2} placeholder="如：节假日不可取消，非节假日入住日前2天23:59点前可免费取消..." />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'checkin_notes']} label="入住必读">
                            <Input.TextArea rows={2} placeholder="如：订单需等酒店或供应商确认后生效..." />
                          </Form.Item>
                        </Card>
                      ))}
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        添加房型
                      </Button>
                    </div>
                  )}
                </Form.List>
              </Form.Item>
            );
          }}
        </Form.Item>

        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormDigit name="price" label="售价" min={0} precision={2} rules={[{ required: true }]} />
        <ProFormText name="unit" label="计价单位" />
        <ProFormTextArea name="description" label="详细介绍" />
        <ProFormDigit name="stock" label="库存" min={0} />
        <ProFormDigit name="limit_per_order" label="单订单限购（0=不限）" min={0} />
        <ProFormDigit name="sort_order" label="排序" min={0} />
        <ProFormRadio.Group
          name="is_required"
          label="是否必选"
          options={[
            { label: '否', value: 0 },
            { label: '是', value: 1 },
          ]}
        />
        <ProFormRadio.Group
          name="need_info"
          label="是否需要填写资料"
          options={[
            { label: '否', value: 0 },
            { label: '是', value: 1 },
          ]}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '下架', value: 0 },
            { label: '上架', value: 1 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
}
