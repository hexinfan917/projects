import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Input, Select, InputNumber, Radio, Button, Space, Upload, message, Row, Col, DatePicker, TimePicker, Table, Popconfirm, Tabs, Modal, Spin, Divider } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined } from '@ant-design/icons';
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
  const [scheduleAddons, setScheduleAddons] = useState<any[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [isFree, setIsFree] = useState(false);
  const [isMemberOnly, setIsMemberOnly] = useState(false);
  const [isInsuranceRequired, setIsInsuranceRequired] = useState(true);
  const [newScheduleDate, setNewScheduleDate] = useState<dayjs.Dayjs | null>(null);
  const [newStartTime, setNewStartTime] = useState<dayjs.Dayjs | null>(null);
  const [newEndTime, setNewEndTime] = useState<dayjs.Dayjs | null>(null);
  const [newStock, setNewStock] = useState<number>(12);
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
  const [description, setDescription] = useState('');
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
        });
        setGallery(data.gallery || []);
        setHighlights(data.highlights || []);
        setDescription(data.description || '');
        setHighlightsDetail(data.highlights_detail || '');
        setFeeDescription(data.fee_description || '');
        setFeeInclude(data.fee_include || '');
        setFeeExclude(data.fee_exclude || '');
        setNotice(data.notice || '');
        setContentModules(data.content_modules || []);
        setIsFree(data.is_free === 1);
        setIsMemberOnly(data.is_member_only === 1);
        setIsInsuranceRequired(data.is_insurance_required !== 0);
        fetchSchedules();
      }
    } catch (error) {
      message.error('获取路线详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取排期列表和行程选配
  const fetchSchedules = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        request(`/api/v1/admin/routes/${id}/schedules`),
        request(`/api/v1/routes/${id}/addons`),
      ]);
      if (sRes.code === 200 && sRes.data) {
        setSchedules(sRes.data.schedules || []);
      }
      if (aRes.code === 200 && aRes.data) {
        setScheduleAddons(aRes.data.addons || []);
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
        description,
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
          const fullUrl = url;
          handleGalleryUpload(fullUrl);
        }
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  // 批量添加排期
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editScheduleModalVisible, setEditScheduleModalVisible] = useState(false);
  const [currentEditingSchedule, setCurrentEditingSchedule] = useState<any>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editingStock, setEditingStock] = useState<number | null>(null);
  const [editTravelType, setEditTravelType] = useState<number>(0);
  const [batchTravelType, setBatchTravelType] = useState<number>(0);
  const handleBatchAddSchedules = async (values: any) => {
    try {
      const { start_date, end_date, start_time, end_time, price, self_drive_price, stock, week_days,
        single_person_price, two_person_one_pet_price, one_person_two_pet_price, single_pet_price,
        extra_person_price, extra_pet_price,
        self_drive_single_person_price, self_drive_two_person_one_pet_price, self_drive_one_person_two_pet_price,
        self_drive_single_pet_price, self_drive_extra_person_price, self_drive_extra_pet_price,
        member_price, member_single_person_price, member_two_person_one_pet_price, member_one_person_two_pet_price,
        member_single_pet_price, member_extra_person_price, member_extra_pet_price,
        member_self_drive_price, member_self_drive_single_person_price, member_self_drive_two_person_one_pet_price,
        member_self_drive_one_person_two_pet_price, member_self_drive_single_pet_price,
        member_self_drive_extra_person_price, member_self_drive_extra_pet_price
      } = values;
      
      const res = await request(`/api/v1/admin/routes/${id}/schedules/batch`, {
        method: 'POST',
        data: {
          start_date: start_date.format('YYYY-MM-DD'),
          end_date: end_date.format('YYYY-MM-DD'),
          start_time: start_time?.format('HH:mm') || '09:00',
          end_time: end_time?.format('HH:mm') || '17:00',
          price,
          self_drive_price,
          stock,
          week_days: week_days || [1, 2, 3, 4, 5, 6, 7], // 默认每天
          single_person_price,
          two_person_one_pet_price,
          one_person_two_pet_price,
          single_pet_price,
          extra_person_price,
          extra_pet_price,
          self_drive_single_person_price,
          self_drive_two_person_one_pet_price,
          self_drive_one_person_two_pet_price,
          self_drive_single_pet_price,
          self_drive_extra_person_price,
          self_drive_extra_pet_price,
          member_price,
          member_single_person_price,
          member_two_person_one_pet_price,
          member_one_person_two_pet_price,
          member_single_pet_price,
          member_extra_person_price,
          member_extra_pet_price,
          member_self_drive_price,
          member_self_drive_single_person_price,
          member_self_drive_two_person_one_pet_price,
          member_self_drive_one_person_two_pet_price,
          member_self_drive_single_pet_price,
          member_self_drive_extra_person_price,
          member_self_drive_extra_pet_price,
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
  const handleAddSchedule = async () => {
    if (!newScheduleDate) {
      message.error('请选择日期');
      return;
    }
    const dateStr = newScheduleDate.format('YYYY-MM-DD');
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
          start_time: newStartTime?.format('HH:mm') || '09:00',
          end_time: newEndTime?.format('HH:mm') || '17:00',
          stock: newStock,
          status: 1,
        },
      });
      if (res.code === 200) {
        message.success('排期添加成功');
        setNewScheduleDate(null);
        setNewStartTime(null);
        setNewEndTime(null);
        setNewStock(12);
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
    try {
      const res = await request(`/api/v1/admin/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      if (res.code === 200) {
        message.success('排期删除成功');
        // 立即从本地状态移除
        setSchedules(prev => {
          const newSchedules = prev.filter(s => s.id !== scheduleId);
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

  // 排期表格列（根据是否免费动态生成）
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
    ...(!isFree ? [{
      title: '价格',
      key: 'price',
      render: (_: any, record: any) => {
        const isSelfDriveOnly = record.travel_type === 2;
        const displayPrice = isSelfDriveOnly ? record.self_drive_price : record.price;
        if (editingScheduleId === record.id && editingField === 'price') {
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
                if (editingPrice !== displayPrice) {
                  updateSchedule(record.id, { price: editingPrice || 0 });
                }
                setEditingScheduleId(null);
                setEditingField(null);
                setEditingPrice(null);
              }}
              onPressEnter={() => {
                if (editingPrice !== displayPrice) {
                  updateSchedule(record.id, { price: editingPrice || 0 });
                }
                setEditingScheduleId(null);
                setEditingField(null);
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
              setEditingField('price');
              setEditingPrice(displayPrice || 0);
            }}
          >
            {displayPrice ? `¥${displayPrice}` : '-'}
          </span>
        );
      },
    }] : []),
    {
      title: '库存',
      key: 'stock',
      render: (record: any) => {
        if (editingScheduleId === record.id && editingField === 'stock') {
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
                setEditingField(null);
                setEditingStock(null);
              }}
              onPressEnter={() => {
                if (editingStock !== record.stock) {
                  updateSchedule(record.id, { stock: editingStock || 0 });
                }
                setEditingScheduleId(null);
                setEditingField(null);
                setEditingStock(null);
              }}
            />
          );
        }
        const stock = record.stock || 0;
        const sold = record.sold || 0;
        const total = stock + sold;
        const isLow = stock <= 10 && total > 0;
        const isSoldOut = stock <= 0;
        return (
          <span
            style={{ cursor: 'pointer', color: isSoldOut ? '#999' : (isLow ? '#ff4d4f' : '#1890ff') }}
            onClick={() => {
              setEditingScheduleId(record.id);
              setEditingField('stock');
              setEditingStock(record.stock || 0);
            }}
          >
            {record.stock !== undefined && record.stock !== null
              ? (
                <span>
                  <span style={{ fontWeight: 600 }}>{stock}</span>
                  <span style={{ color: '#999', fontSize: 12 }}> 余 / </span>
                  <span>{total}</span>
                  <span style={{ color: '#999', fontSize: 12 }}> 总 / </span>
                  <span style={{ color: '#52c41a' }}>{sold}</span>
                  <span style={{ color: '#999', fontSize: 12 }}> 已售</span>
                </span>
              )
              : '-'}
            {isSoldOut && <span style={{ marginLeft: 4, color: '#999', fontWeight: 600 }}>(已售罄)</span>}
            {isLow && !isSoldOut && <span style={{ marginLeft: 4, color: '#ff4d4f', fontWeight: 600 }}>(库存紧张)</span>}
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
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentEditingSchedule(record);
              setEditScheduleModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            onConfirm={() => deleteSchedule(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
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
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          status: 1,
          is_free: 0,
          is_member_only: 0,
          is_insurance_required: 1,
          pet_insurance_price: 15.00,
          person_insurance_price: 10.00,
          pet_insurance_title: '宠物意外险',
          pet_insurance_unit: '狗',
          pet_insurance_desc: '保障宠物活动中突发意外医疗费用，最高保额¥5000',
          person_insurance_title: '人身意外险',
          person_insurance_unit: '人',
          person_insurance_desc: '保障出行人意外伤害及医疗，最高保额¥200,000',
          non_member_price: 0,
          is_hot: 0,
          difficulty: 3,
          min_participants: 4,
          max_participants: 12,
          base_price: 0,
          single_person_price: undefined,
          two_person_one_pet_price: undefined,
          one_person_two_pet_price: undefined,
          single_pet_price: undefined,
          extra_person_price: 0,
          extra_pet_price: 0,
          self_drive_base_price: undefined,
          self_drive_single_person_price: undefined,
          self_drive_two_person_one_pet_price: undefined,
          self_drive_one_person_two_pet_price: undefined,
          self_drive_single_pet_price: undefined,
          self_drive_extra_person_price: undefined,
          self_drive_extra_pet_price: undefined,
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="基本信息" key="basic">
            <Card>
              <Spin spinning={loading}>
              <Form.Item
                name="is_free"
                label="是否免费活动"
                tooltip="免费活动将简化表单，不展示价格相关信息"
              >
                <Radio.Group onChange={(e) => {
                  const free = e.target.value === 1;
                  setIsFree(free);
                  // 切换到免费时，如果当前在已隐藏的Tab，自动回到基本信息
                  if (free && ['highlights', 'fee', 'notice', 'content_modules'].includes(activeTab)) {
                    setActiveTab('basic');
                  }
                }}>
                  <Radio.Button value={0}>付费路线</Radio.Button>
                  <Radio.Button value={1}>免费活动</Radio.Button>
                </Radio.Group>
              </Form.Item>

              {isFree && (
                <>
                  <Form.Item
                    name="is_member_only"
                    label="仅限会员免费"
                    tooltip="开启后，非会员需按正常价格支付路线费用"
                  >
                    <Radio.Group onChange={(e) => setIsMemberOnly(e.target.value === 1)}>
                      <Radio.Button value={0}>所有人可免费</Radio.Button>
                      <Radio.Button value={1}>仅限会员免费</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  {isMemberOnly && (
                    <Form.Item
                      name="non_member_price"
                      label="非会员价格（元）"
                      tooltip="会员专享免费活动时，非会员需要支付的价格"
                      rules={[{ required: true, message: '请输入非会员价格' }]}
                    >
                      <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                  )}
                </>
              )}


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
                {!isFree && (
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
                )}
              </Row>

              <Form.Item
                name="subtitle"
                label="副标题"
              >
                <Input placeholder="一句话描述路线特色" />
              </Form.Item>

              <Form.Item
                name="display_price"
                label="详情页价格文案"
                extra="如：￥299起/人、限时特惠价、免费。填写后将直接显示在小程序详情页，不填则显示排期最低价格"
              >
                <Input placeholder="填写后优先显示此文案，如：￥299起/人" />
              </Form.Item>

              {!isFree && (
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
              )}

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

              <Form.Item
                name="sort_order"
                label="排序"
                tooltip="数值越小排序越靠前"
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入排序值" />
              </Form.Item>

              <Form.Item
                label="封面图片"
                extra="建议尺寸 750×350px（2:1），主体放中间偏左，避免被裁切"
              >
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
                        const fullUrl = url;
                        form.setFieldValue('cover_image', fullUrl);
                      }
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />}>上传图片</Button>
                </Upload>
              </Form.Item>

              <Form.Item
                label="路线图集"
                extra="建议尺寸 750×420px（16:9），可传 2 倍图（1500×840px）"
              >
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

              <Form.Item label="详细介绍（富文本）">
                <ReactQuill
                  theme="snow"
                  value={description}
                  onChange={setDescription}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{ height: 300, marginBottom: 50 }}
                />
              </Form.Item>
            </Spin>
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

        {!isFree && (
          <>
            <Tabs.TabPane tab="费用说明" key="fee">
              <Card title="费用说明">
                <Divider orientation="left">保险配置</Divider>
                <Form.Item
                  name="is_insurance_required"
                  label="是否需要保险"
                >
                  <Radio.Group onChange={(e) => setIsInsuranceRequired(e.target.value === 1)}>
                    <Radio.Button value={0}>不需要保险</Radio.Button>
                    <Radio.Button value={1}>需要保险</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                {isInsuranceRequired && (
                  <>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="pet_insurance_price"
                          label="宠物保险单价（元/只）"
                          rules={[{ required: true, message: '请输入宠物保险单价' }]}
                        >
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="person_insurance_price"
                          label="人身保险单价（元/人）"
                          rules={[{ required: true, message: '请输入人身保险单价' }]}
                        >
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="pet_insurance_title"
                          label="宠物保险标题"
                          rules={[{ required: true, message: '请输入宠物保险标题' }]}
                        >
                          <Input placeholder="宠物意外险" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="pet_insurance_unit"
                          label="宠物保险计价单位"
                          rules={[{ required: true, message: '请输入宠物保险计价单位' }]}
                        >
                          <Input placeholder="狗" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={24}>
                      <Col span={24}>
                        <Form.Item
                          name="pet_insurance_desc"
                          label="宠物保险描述"
                          rules={[{ required: true, message: '请输入宠物保险描述' }]}
                        >
                          <Input placeholder="保障宠物活动中突发意外医疗费用，最高保额¥5000" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="person_insurance_title"
                          label="人身保险标题"
                          rules={[{ required: true, message: '请输入人身保险标题' }]}
                        >
                          <Input placeholder="人身意外险" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="person_insurance_unit"
                          label="人身保险计价单位"
                          rules={[{ required: true, message: '请输入人身保险计价单位' }]}
                        >
                          <Input placeholder="人" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={24}>
                      <Col span={24}>
                        <Form.Item
                          name="person_insurance_desc"
                          label="人身保险描述"
                          rules={[{ required: true, message: '请输入人身保险描述' }]}
                        >
                          <Input placeholder="保障出行人意外伤害及医疗，最高保额¥200,000" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider />
                  </>
                )}
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
          </>
        )}

        {isEdit && (
          <Tabs.TabPane tab="营期管理" key="schedules">
            <Card title="排期列表">
              <Space style={{ marginBottom: 16 }}>
                <DatePicker
                  placeholder="选择日期"
                  value={newScheduleDate}
                  onChange={setNewScheduleDate}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
                <TimePicker
                  placeholder="开始时间"
                  format="HH:mm"
                  value={newStartTime}
                  onChange={setNewStartTime}
                />
                <TimePicker
                  placeholder="结束时间"
                  format="HH:mm"
                  value={newEndTime}
                  onChange={setNewEndTime}
                />
                <InputNumber
                  placeholder="库存"
                  min={1}
                  value={newStock}
                  onChange={(val) => setNewStock(val || 1)}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSchedule}>
                  添加排期
                </Button>
              </Space>
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
      </Form>

      {/* 编辑排期Modal */}
      <Modal
        title={`编辑排期 - ${currentEditingSchedule?.schedule_date || ''}`}
        open={editScheduleModalVisible}
        onCancel={() => {
          setEditScheduleModalVisible(false);
          setCurrentEditingSchedule(null);
        }}
        footer={null}
        width={1400}
        afterOpenChange={(open) => {
          if (open && currentEditingSchedule) {
            setEditTravelType(currentEditingSchedule.travel_type ?? 0);
          }
        }}
      >
        <Form
          key={currentEditingSchedule?.id}
          onFinish={async (values) => {
            try {
              // 过滤掉为空的 addon_prices 项
              const submitData: any = { ...values };
              if (submitData.addon_prices) {
                const filtered: any = {};
                Object.entries(submitData.addon_prices).forEach(([k, v]) => {
                  if (v !== undefined && v !== null && v !== '') {
                    filtered[k] = v;
                  }
                });
                submitData.addon_prices = Object.keys(filtered).length > 0 ? filtered : undefined;
              }
              const res = await request(`/api/v1/admin/schedules/${currentEditingSchedule.id}`, {
                method: 'PUT',
                data: submitData,
              });
              if (res.code === 200) {
                message.success('排期更新成功');
                setEditScheduleModalVisible(false);
                setCurrentEditingSchedule(null);
                await fetchSchedules();
              } else {
                message.error(res.message || '更新失败');
              }
            } catch (error: any) {
              message.error(error?.message || '更新排期失败');
            }
          }}
          layout="vertical"
          initialValues={currentEditingSchedule}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="开始时间" name="start_time">
                <Input placeholder="09:00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="结束时间" name="end_time">
                <Input placeholder="18:00" />
              </Form.Item>
            </Col>
          </Row>
          {!isFree && (
            <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Form.Item label="出行方式限制" name="travel_type">
                  <Select
                    options={[
                      { label: '两者都支持', value: 0 },
                      { label: '仅大巴', value: 1 },
                      { label: '仅自驾', value: 2 },
                    ]}
                    onChange={(value) => setEditTravelType(value)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Tabs type="card" style={{ marginBottom: 16 }}>
              {editTravelType !== 2 && (
                <Tabs.TabPane tab="大巴出行价格" key="bus">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="价格(1人1宠)" name="price">
                        <InputNumber placeholder="价格" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="一人两宠" name="one_person_two_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="二人一宠" name="two_person_one_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="单人轻旅（无宠）" name="single_person_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="毛孩专属接送（无主人陪同）" name="single_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="增加一人" name="extra_person_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="增加一宠" name="extra_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Tabs.TabPane>
              )}
              {editTravelType !== 1 && (
                <Tabs.TabPane tab="自驾出行价格" key="self_drive">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="自驾价格(1人1宠)" name="self_drive_price">
                        <InputNumber placeholder="自驾价格" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="一人两宠" name="self_drive_one_person_two_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="二人一宠" name="self_drive_two_person_one_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="单人轻旅（无宠）" name="self_drive_single_person_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="增加一人" name="self_drive_extra_person_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="增加一宠" name="self_drive_extra_pet_price">
                        <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Tabs.TabPane>
              )}
              <Tabs.TabPane tab="会员专属价" key="member">
                <div style={{ background: '#fff7e6', padding: '12px 16px', borderRadius: 8, marginBottom: 16, color: '#d48806', fontSize: 13 }}>
                  💡 会员下单时优先使用以下价格，不填则按正常价格结算
                </div>
                {editTravelType !== 2 && (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 12, color: '#1890ff' }}>大巴出行会员价</div>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="会员价(1人1宠)" name="member_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(一人两宠)" name="member_one_person_two_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(二人一宠)" name="member_two_person_one_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="会员价(单人)" name="member_single_person_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(毛孩接送)" name="member_single_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(加一人)" name="member_extra_person_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="会员价(加一宠)" name="member_extra_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                )}
                {editTravelType !== 1 && (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 12, marginTop: editTravelType === 2 ? 0 : 16, color: '#1890ff' }}>自驾出行会员价</div>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="会员自驾价(1人1宠)" name="member_self_drive_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(一人两宠)" name="member_self_drive_one_person_two_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(二人一宠)" name="member_self_drive_two_person_one_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="会员价(单人)" name="member_self_drive_single_person_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(加一人)" name="member_self_drive_extra_person_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="会员价(加一宠)" name="member_self_drive_extra_pet_price">
                          <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                )}
              </Tabs.TabPane>
            </Tabs>
            </>
          )}
          {scheduleAddons.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                行程选配价格（不填使用路线默认价）
              </div>
              <Row gutter={16}>
                {scheduleAddons.map((addon: any) => (
                  <Col span={8} key={addon.id}>
                    <Form.Item label={addon.name} name={['addon_prices', addon.code || `addon_${addon.id}`]}>
                      <InputNumber placeholder={`路线默认价 ¥${addon.price || 0}`} min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </div>
          )}
          <Form.Item label="库存" name="stock">
            <InputNumber placeholder="库存" min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              options={[
                { label: '已关闭', value: 0 },
                { label: '可售', value: 1 },
                { label: '已满', value: 2 },
                { label: '已结束', value: 3 },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量添加排期Modal */}
      <Modal
        title="批量添加排期"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
        width={1400}
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
          <Form.Item label="出行方式限制" name="travel_type" initialValue={0}>
            <Select
              options={[
                { label: '两者都支持', value: 0 },
                { label: '仅大巴', value: 1 },
                { label: '仅自驾', value: 2 },
              ]}
              onChange={(value) => setBatchTravelType(value)}
            />
          </Form.Item>
          <Form.Item label="价格(1人1宠)" name="price">
            <InputNumber placeholder="价格" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="自驾价格(1人1宠)" name="self_drive_price">
            <InputNumber placeholder="自驾价格" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="库存" name="stock" initialValue={12}>
            <InputNumber placeholder="库存" min={1} style={{ width: '100%' }} />
          </Form.Item>
          {batchTravelType !== 2 && (
            <Card size="small" title="大巴套餐价格（可选）" style={{ marginBottom: 16 }}>
              <Form.Item label="一人两宠" name="one_person_two_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="二人一宠" name="two_person_one_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="单人轻旅（无宠）" name="single_person_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="毛孩专属接送（无主人陪同）" name="single_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="增加一人" name="extra_person_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="增加一宠" name="extra_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          )}
          {batchTravelType !== 1 && (
            <Card size="small" title="自驾套餐价格（可选）" style={{ marginBottom: 16 }}>
              <Form.Item label="一人两宠" name="self_drive_one_person_two_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="二人一宠" name="self_drive_two_person_one_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="单人轻旅（无宠）" name="self_drive_single_person_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="增加一人" name="self_drive_extra_person_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="增加一宠" name="self_drive_extra_pet_price">
                <InputNumber placeholder="路线默认价" min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          )}
          <Card size="small" title="会员专属价（可选）" style={{ marginBottom: 16, borderColor: '#ffd591' }}>
            <div style={{ background: '#fff7e6', padding: '8px 12px', borderRadius: 6, marginBottom: 12, color: '#d48806', fontSize: 13 }}>
              💡 会员下单时优先使用以下价格，不填则按正常价格结算
            </div>
            {batchTravelType !== 2 && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff', fontSize: 13 }}>大巴出行会员价</div>
                <Form.Item label="会员价(1人1宠)" name="member_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(一人两宠)" name="member_one_person_two_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(二人一宠)" name="member_two_person_one_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(单人)" name="member_single_person_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(毛孩接送)" name="member_single_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(加一人)" name="member_extra_person_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(加一宠)" name="member_extra_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
            {batchTravelType !== 1 && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, marginTop: batchTravelType === 2 ? 0 : 12, color: '#1890ff', fontSize: 13 }}>自驾出行会员价</div>
                <Form.Item label="会员自驾价(1人1宠)" name="member_self_drive_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(一人两宠)" name="member_self_drive_one_person_two_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(二人一宠)" name="member_self_drive_two_person_one_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(单人)" name="member_self_drive_single_person_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(加一人)" name="member_self_drive_extra_person_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="会员价(加一宠)" name="member_self_drive_extra_pet_price">
                  <InputNumber placeholder="会员专享价" min={0} style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
          </Card>
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
