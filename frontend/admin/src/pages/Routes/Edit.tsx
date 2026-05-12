import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Input, Select, InputNumber, Radio, Button, Space, Upload, message, Row, Col, DatePicker, TimePicker, Table, Popconfirm, Tabs, Modal } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { request, useParams, history } from '@umijs/max';
import dayjs from 'dayjs';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Option } = Select;
const { TextArea } = Input;

// 富文本编辑器配置
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'indent',
  'color', 'background',
  'link', 'image'
];

export default function RouteEdit() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [routeTypes, setRouteTypes] = useState<{ id: number; name: string }[]>([
    { id: 1, name: '山野厨房' },
    { id: 2, name: '海边度假' },
    { id: 3, name: '森林露营' },
    { id: 4, name: '主题派对' },
    { id: 5, name: '自驾路线' },
  ]);

  // 获取路线类型列表
  useEffect(() => {
    request('/api/v1/admin/route-types').then((res: any) => {
      if (res.code === 200 && res.data) {
        setRouteTypes(res.data.map((item: any) => ({ id: item.id, name: item.name })));
      }
    });
  }, []);

  // 富文本内容
  const [highlightsDetail, setHighlightsDetail] = useState('');
  const [feeDescription, setFeeDescription] = useState('');
  const [feeInclude, setFeeInclude] = useState('');
  const [feeExclude, setFeeExclude] = useState('');
  const [notice, setNotice] = useState('');
  const [contentModules, setContentModules] = useState<{ label: string; icon: string; content: string }[]>([]);

  // 获取路线详情
  useEffect(() => {
    if (isEdit) {
      fetchRouteDetail();
    }
  }, [id]);

  // 切换到营期管理标签时刷新排期
  useEffect(() => {
    if (isEdit && activeTab === 'schedules') {
      fetchSchedules();
    }
  }, [activeTab, isEdit]);

  const fetchRouteDetail = async () => {
    try {
      setLoading(true);
      const res = await request(`/api/v1/admin/routes/${id}`);
      if (res.code === 200 && res.data) {
        const data = res.data;
        form.setFieldsValue({
          ...data,
          base_price: Number(data.base_price),
          extra_person_price: Number(data.extra_person_price || 0),
          extra_pet_price: Number(data.extra_pet_price || 0),
        });
        setGallery(data.gallery || []);
        setHighlights(data.highlights || []);
        setHighlightsDetail(data.highlights_detail || '');
        setFeeDescription(data.fee_description || '');
        setFeeInclude(data.fee_include || '');
        setFeeExclude(data.fee_exclude || '');
        setNotice(data.notice || '');
        setContentModules(data.content_modules || []);
        fetchSchedules();
      }
    } catch (error) {
      message.error('获取路线详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取排期列表
  const fetchSchedules = async () => {
    try {
      const res = await request(`/api/v1/admin/routes/${id}/schedules`);
      console.log('获取排期响应:', res);
      if (res.code === 200 && res.data) {
        setSchedules(res.data.schedules || []);
        console.log('排期列表已更新:', res.data.schedules?.length || 0, '条');
      }
    } catch (error) {
      console.error('获取排期失败', error);
    }
  };

  // 保存路线
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        ...values,
        gallery,
        highlights,
        highlights_detail: highlightsDetail,
        fee_description: feeDescription,
        fee_include: feeInclude,
        fee_exclude: feeExclude,
        notice,
        content_modules: contentModules,
      };

      if (isEdit) {
        await request(`/api/v1/admin/routes/${id}`, {
          method: 'PUT',
          data,
        });
        message.success('路线更新成功');
      } else {
        const res = await request('/api/v1/admin/routes', {
          method: 'POST',
          data,
        });
        if (res.code === 200) {
          message.success('路线创建成功');
          history.push(`/routes/edit/${res.data.id}`);
        }
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加亮点
  const addHighlight = () => {
    setHighlights([...highlights, '']);
  };

  // 更新亮点
  const updateHighlight = (index: number, value: string) => {
    const newHighlights = [...highlights];
    newHighlights[index] = value;
    setHighlights(newHighlights);
  };

  // 删除亮点
  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  // 内容模块操作
  const addContentModule = () => {
    setContentModules([...contentModules, { label: '', icon: '', content: '' }]);
  };
  const updateContentModule = (index: number, field: string, value: string) => {
    const newModules = [...contentModules];
    newModules[index] = { ...newModules[index], [field]: value };
    setContentModules(newModules);
  };
  const removeContentModule = (index: number) => {
    setContentModules(contentModules.filter((_, i) => i !== index));
  };
  const moveContentModule = (index: number, direction: number) => {
    const newModules = [...contentModules];
    const target = index + direction;
    if (target < 0 || target >= newModules.length) return;
    [newModules[index], newModules[target]] = [newModules[target], newModules[index]];
    setContentModules(newModules);
  };

  // 添加图集图片
  const handleGalleryUpload = (url: string) => {
    setGallery([...gallery, url]);
  };

  // 删除图集图片
  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, i) => i !== index));
  };

  // 图片上传配置
  const uploadProps = {
    name: 'file',
    action: '/api/v1/files/upload/image',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    onChange(info: any) {
      if (info.file.status === 'done') {
        const url = info.file.response?.data?.url;
        if (url) {
          message.success(`${info.file.name} 上传成功`);
          const fullUrl = url.startsWith('http') ? url : `http://localhost:8081${url}`;
          handleGalleryUpload(fullUrl);
        }
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  // 批量添加排期
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editingStock, setEditingStock] = useState<number | null>(null);
  const handleBatchAddSchedules = async (values: any) => {
    try {
      const { start_date, end_date, start_time, end_time, price, stock, week_days } = values;
      
      const res = await request(`/api/v1/admin/routes/${id}/schedules/batch`, {
        method: 'POST',
        data: {
          start_date: start_date.format('YYYY-MM-DD'),
          end_date: end_date.format('YYYY-MM-DD'),
          start_time: start_time?.format('HH:mm') || '09:00',
          end_time: end_time?.format('HH:mm') || '17:00',
          price,
          stock,
          week_days: week_days || [1, 2, 3, 4, 5, 6, 7], // 默认每天
        },
      });
      
      if (res.code === 200) {
        message.success(`成功创建 ${res.data?.count || 0} 个排期`);
        setBatchModalVisible(false);
        await fetchSchedules();
      } else {
        message.error(res.message || '批量创建失败');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '批量创建失败';
      message.error(msg);
    }
  };

  // 添加排期
  const addSchedule = async (values: any) => {
    // 检查该日期是否已存在
    const dateStr = values.schedule_date.format('YYYY-MM-DD');
    const existingSchedule = schedules.find(s => s.schedule_date === dateStr);
    if (existingSchedule) {
      message.error(`该日期(${dateStr})已存在排期，请勿重复添加`);
      return;
    }
    
    try {
      const res = await request(`/api/v1/admin/routes/${id}/schedules`, {
        method: 'POST',
        data: {
          schedule_date: dateStr,
          start_time: values.start_time?.format('HH:mm') || '09:00',
          end_time: values.end_time?.format('HH:mm') || '17:00',
          price: values.price,
          stock: values.stock,
          status: 1,
        },
      });
      if (res.code === 200) {
        message.success('排期添加成功');
        // 立即刷新排期列表
        await fetchSchedules();
      } else if (res.code === 409) {
        message.error(res.message || '该日期已存在排期，请勿重复添加');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '添加排期失败';
      message.error(msg);
    }
  };

  // 删除排期
  const deleteSchedule = async (scheduleId: number) => {
    console.log('开始删除排期:', scheduleId);
    try {
      const res = await request(`/api/v1/admin/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      console.log('删除排期响应:', res);
      if (res.code === 200) {
        message.success('排期删除成功');
        // 立即从本地状态移除
        setSchedules(prev => {
          const newSchedules = prev.filter(s => s.id !== scheduleId);
          console.log('本地状态已更新:', newSchedules.length, '条');
          return newSchedules;
        });
        // 延迟刷新确保后端同步
        setTimeout(() => fetchSchedules(), 500);
      } else if (res.code === 409) {
        message.error(res.message || '该排期有关联订单，不可删除');
      } else {
        message.error(res.message || '删除失败');
      }
    } catch (error: any) {
      console.error('删除排期错误:', error);
      const msg = error?.response?.data?.message || error?.message || '删除排期失败';
      message.error(msg);
    }
  };

  // 更新排期价格和库存
  const updateSchedule = async (scheduleId: number, updates: { price?: number; stock?: number }) => {
    try {
      const res = await request(`/api/v1/admin/schedules/${scheduleId}`, {
        method: 'PUT',
        data: updates,
      });
      if (res.code === 200) {
        message.success('排期更新成功');
        await fetchSchedules();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch (error: any) {
      message.error(error?.message || '更新排期失败');
    }
  };

  // 排期表格列
  const scheduleColumns = [
    {
      title: '日期',
      dataIndex: 'schedule_date',
      key: 'schedule_date',
    },
    {
      title: '时间',
      key: 'time',
      render: (record: any) => `${record.start_time} - ${record.end_time}`,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number, record: any) => {
        if (editingScheduleId === record.id && editingPrice !== null) {
          return (
            <InputNumber
              autoFocus
              value={editingPrice}
              min={0}
              precision={2}
              prefix="¥"
              style={{ width: 100 }}
              onChange={(val) => setEditingPrice(val)}
              onBlur={() => {
                if (editingPrice !== price) {
                  updateSchedule(record.id, { price: editingPrice || 0 });
                }
                setEditingScheduleId(null);
                setEditingPrice(null);
              }}
              onPressEnter={() => {
                if (editingPrice !== price) {
                  updateSchedule(record.id, { price: editingPrice || 0 });
                }
                setEditingScheduleId(null);
                setEditingPrice(null);
              }}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => {
              setEditingScheduleId(record.id);
              setEditingPrice(price || 0);
            }}
          >
            {price ? `¥${price}` : '-'}
          </span>
        );
      },
    },
    {
      title: '库存',
      key: 'stock',
      render: (record: any) => {
        if (editingScheduleId === record.id && editingStock !== null) {
          return (
            <InputNumber
              autoFocus
              value={editingStock}
              min={0}
              style={{ width: 80 }}
              onChange={(val) => setEditingStock(val)}
              onBlur={() => {
                if (editingStock !== record.stock) {
                  updateSchedule(record.id, { stock: editingStock || 0 });
                }
                setEditingScheduleId(null);
                setEditingStock(null);
              }}
              onPressEnter={() => {
                if (editingStock !== record.stock) {
                  updateSchedule(record.id, { stock: editingStock || 0 });
                }
                setEditingScheduleId(null);
                setEditingStock(null);
              }}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => {
              setEditingScheduleId(record.id);
              setEditingStock(record.stock || 0);
            }}
          >
            {record.stock - record.sold}/{record.stock}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => {
        const statusMap: any = { 0: '关闭', 1: '可售', 2: '已满', 3: '已结束' };
        return statusMap[status] || '未知';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (record: any) => (
        <Popconfirm
          title="确认删除"
          onConfirm={() => deleteSchedule(record.id)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer
      title={isEdit ? '编辑路线' : '新建路线'}
      extra={
        <Space>
          <Button onClick={() => history.push('/routes/list')}>
            返回列表
          </Button>
          <Button type="primary" loading={loading} onClick={handleSave} icon={<SaveOutlined />}>
            保存
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="基本信息" key="basic">
          <Card loading={loading}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                status: 1,
                is_hot: 0,
                difficulty: 3,
                min_participants: 4,
                max_participants: 12,
                base_price: 0,
                extra_person_price: 0,
                extra_pet_price: 0,
              }}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="路线名称"
                    rules={[{ required: true, message: '请输入路线名称' }]}
                  >
                    <Input placeholder="请输入路线名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="route_no"
                    label="路线编号"
                    tooltip="留空将自动生成"
                  >
                    <Input placeholder="如：R2024031501" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="route_type"
                    label="路线类型"
                    rules={[{ required: true, message: '请选择路线类型' }]}
                  >
                    <Select placeholder="请选择">
                      {routeTypes.map(type => (
                        <Option key={type.id} value={type.id}>{type.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="duration"
                    label="活动时长"
                  >
                    <Select placeholder="请选择">
                      <Option value="半日">半日</Option>
                      <Option value="1日">1日</Option>
                      <Option value="2日">2日</Option>
                      <Option value="3日">3日</Option>
                      <Option value="多日">多日</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="difficulty"
                    label="难度等级"
                  >
                    <Radio.Group>
                      <Radio.Button value={1}>入门</Radio.Button>
                      <Radio.Button value={2}>简单</Radio.Button>
                      <Radio.Button value={3}>中等</Radio.Button>
                      <Radio.Button value={4}>困难</Radio.Button>
                      <Radio.Button value={5}>挑战</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="subtitle"
                label="副标题"
              >
                <Input placeholder="一句话描述路线特色" />
              </Form.Item>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="base_price"
                    label="基础价格(1人1宠)"
                    rules={[{ required: true, message: '请输入基础价格' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={2}
                      prefix="¥"
                      placeholder="请输入"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="extra_person_price"
                    label="增加一人价格"
                  >
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="extra_pet_price"
                    label="增加一宠价格"
                  >
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" placeholder="0" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item
                    name="min_participants"
                    label="最少成团人数"
                  >
                    <InputNumber style={{ width: '100%' }} min={1} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="max_participants"
                    label="最大人数"
                  >
                    <InputNumber style={{ width: '100%' }} min={1} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="status"
                label="状态"
              >
                <Radio.Group>
                  <Radio.Button value={1}>上架</Radio.Button>
                  <Radio.Button value={0}>下架</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="is_hot"
                label="是否热门"
                tooltip="设为热门后，该路线将在小程序首页展示"
              >
                <Radio.Group>
                  <Radio.Button value={1}>热门</Radio.Button>
                  <Radio.Button value={0}>普通</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item label="封面图片">
                <Form.Item name="cover_image" noStyle>
                  <Input placeholder="图片URL" style={{ marginBottom: 8 }} />
                </Form.Item>
                <Upload
                  name="file"
                  action="/api/v1/files/upload/image"
                  headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }}
                  onChange={(info) => {
                    if (info.file.status === 'done') {
                      const url = info.file.response?.data?.url;
                      if (url) {
                        const fullUrl = url.startsWith('http') ? url : `http://localhost:8081${url}`;
                        form.setFieldValue('cover_image', fullUrl);
                      }
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />}>上传图片</Button>
                </Upload>
              </Form.Item>

              <Form.Item label="路线图集">
                <div style={{ marginBottom: 16 }}>
                  <Upload {...uploadProps} showUploadList={false}>
                    <Button icon={<UploadOutlined />}>上传图片</Button>
                  </Upload>
                  <span style={{ marginLeft: 8, color: '#999' }}>或直接输入图片URL：</span>
                  <Input
                    style={{ width: 300, marginLeft: 8 }}
                    placeholder="输入图片URL"
                    onPressEnter={(e: any) => {
                      if (e.target.value) {
                        handleGalleryUpload(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {gallery.map((url, index) => (
                    <div key={index} style={{ position: 'relative', width: 200, height: 150 }}>
                      <img
                        src={url}
                        alt={`图集${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                      />
                      <Button
                        type="primary"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => removeGalleryImage(index)}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              </Form.Item>

              <Form.Item label="亮点标签">
                {highlights.map((item, index) => (
                  <Space key={index} style={{ marginBottom: 8, display: 'flex' }}>
                    <Input
                      value={item}
                      onChange={(e) => updateHighlight(index, e.target.value)}
                      placeholder="如：专业领队"
                    />
                    <Button type="link" danger onClick={() => removeHighlight(index)}>
                      删除
                    </Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={addHighlight} icon={<PlusOutlined />}>
                  添加亮点
                </Button>
              </Form.Item>

              <Form.Item label="详细介绍">
                <Form.Item name="description" noStyle>
                  <TextArea rows={4} placeholder="路线的详细介绍" />
                </Form.Item>
              </Form.Item>
            </Form>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="行程亮点" key="highlights">
          <Card title="行程亮点详情（富文本）">
            <ReactQuill
              theme="snow"
              value={highlightsDetail}
              onChange={setHighlightsDetail}
              modules={quillModules}
              formats={quillFormats}
              style={{ height: 400, marginBottom: 50 }}
            />
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="费用说明" key="fee">
          <Card title="费用说明">
            <Form layout="vertical">
              <Form.Item label="费用说明概述">
                <ReactQuill
                  theme="snow"
                  value={feeDescription}
                  onChange={setFeeDescription}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 200, marginBottom: 50 }}
                />
              </Form.Item>
              <Form.Item label="费用包含">
                <ReactQuill
                  theme="snow"
                  value={feeInclude}
                  onChange={setFeeInclude}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 200, marginBottom: 50 }}
                />
              </Form.Item>
              <Form.Item label="费用不包含">
                <ReactQuill
                  theme="snow"
                  value={feeExclude}
                  onChange={setFeeExclude}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 200, marginBottom: 50 }}
                />
              </Form.Item>
            </Form>
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="注意事项" key="notice">
          <Card title="注意事项">
            <ReactQuill
              theme="snow"
              value={notice}
              onChange={setNotice}
              modules={quillModules}
              formats={quillFormats}
              style={{ height: 400, marginBottom: 50 }}
            />
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="内容模块" key="content_modules">
          <Card title="内容模块（小程序标签页展示）" extra={
            <Button type="primary" onClick={addContentModule} icon={<PlusOutlined />}>
              添加模块
            </Button>
          }>
            {contentModules.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无内容模块，点击右上角添加
              </div>
            )}
            {contentModules.map((mod, index) => (
              <div key={index} style={{ marginBottom: 24, padding: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 500 }}>模块 {index + 1}</span>
                  <Space>
                    <Button size="small" disabled={index === 0} onClick={() => moveContentModule(index, -1)}>上移</Button>
                    <Button size="small" disabled={index === contentModules.length - 1} onClick={() => moveContentModule(index, 1)}>下移</Button>
                    <Button size="small" danger onClick={() => removeContentModule(index)} icon={<DeleteOutlined />}>删除</Button>
                  </Space>
                </div>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <Form.Item label="标签名称" style={{ marginBottom: 0 }}>
                      <Input
                        value={mod.label}
                        onChange={(e) => updateContentModule(index, 'label', e.target.value)}
                        placeholder="如：行程亮点"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="图标 Emoji" style={{ marginBottom: 0 }}>
                      <Input
                        value={mod.icon}
                        onChange={(e) => updateContentModule(index, 'icon', e.target.value)}
                        placeholder="如：✨"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ marginBottom: 8, color: '#666' }}>内容（富文本）</div>
                <ReactQuill
                  theme="snow"
                  value={mod.content}
                  onChange={(value) => updateContentModule(index, 'content', value)}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 300, marginBottom: 40 }}
                />
              </div>
            ))}
          </Card>
        </Tabs.TabPane>

        {isEdit && (
          <Tabs.TabPane tab="营期管理" key="schedules">
            <Card title="排期列表" extra={
              <Button onClick={() => setBatchModalVisible(true)}>
                批量添加
              </Button>
            }>
              <Form layout="inline" onFinish={addSchedule} style={{ marginBottom: 16 }}>
                <Form.Item name="schedule_date" rules={[{ required: true }]}>
                  <DatePicker 
                    placeholder="选择日期" 
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Form.Item>
                <Form.Item name="start_time">
                  <TimePicker placeholder="开始时间" format="HH:mm" />
                </Form.Item>
                <Form.Item name="end_time">
                  <TimePicker placeholder="结束时间" format="HH:mm" />
                </Form.Item>
                <Form.Item name="price">
                  <InputNumber placeholder="价格" min={0} />
                </Form.Item>
                <Form.Item name="stock" initialValue={12}>
                  <InputNumber placeholder="库存" min={1} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                    添加排期
                  </Button>
                </Form.Item>
              </Form>
              <Table
                dataSource={schedules}
                columns={scheduleColumns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </Tabs.TabPane>
        )}


      </Tabs>

      {/* 批量添加排期Modal */}
      <Modal
        title="批量添加排期"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
      >
        <Form onFinish={handleBatchAddSchedules} layout="vertical">
          <Form.Item label="开始日期" name="start_date" rules={[{ required: true }]}>
            <DatePicker 
              placeholder="选择开始日期" 
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="结束日期" name="end_date" rules={[{ required: true }]}>
            <DatePicker 
              placeholder="选择结束日期" 
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="开始时间" name="start_time">
            <TimePicker placeholder="开始时间" format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="结束时间" name="end_time">
            <TimePicker placeholder="结束时间" format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="价格" name="price">
            <InputNumber placeholder="价格" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="库存" name="stock" initialValue={12}>
            <InputNumber placeholder="库存" min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              批量创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
