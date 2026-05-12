import { PageContainer, ProTable, ModalForm, ProFormText, ProFormDigit, ProFormRadio, ProFormItem } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Space, Form, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '下架', color: 'default' },
  1: { text: '上架', color: 'success' },
};

const ICON_OPTIONS = [
  { label: '折扣', value: 'discount' },
  { label: '优惠券', value: 'coupon' },
  { label: '礼品', value: 'gift' },
  { label: 'VIP', value: 'vip' },
  { label: '星星', value: 'star' },
  { label: '火', value: 'fire' },
];

export default function MemberPlanList() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const formRef = useRef<any>(null);
  const [couponTemplates, setCouponTemplates] = useState<any[]>([]);

  useEffect(() => {
    request('/api/v1/admin/coupon-templates', { params: { page: 1, page_size: 100 } })
      .then(res => {
        if (res.code === 200) {
          setCouponTemplates(res.data?.list || []);
        }
      })
      .catch(() => {});
  }, []);

  const openModal = (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
    setTimeout(() => {
      const benefit = record?.benefit_config || {};
      const couponPkg = record?.coupon_package || {};
      const values = record
        ? {
            ...record,
            discount_rate: benefit.discount_rate,
            benefit_items: benefit.items || [],
            coupon_desc: couponPkg.desc,
            coupon_total_value: couponPkg.total_value,
            coupon_templates: couponPkg.templates || [],
          }
        : {
            status: 1,
            sort_order: 0,
            color: '#FF6B35',
            is_recommend: 0,
            duration_days: 30,
            discount_rate: 0.98,
            benefit_items: [{ icon: 'discount', title: '全场9.8折' }],
            coupon_desc: '3张¥10券',
            coupon_total_value: 30,
            coupon_templates: [{ template_id: undefined, count: 3, valid_days: 30 }],
          };
      formRef.current?.setFieldsValue(values);
    }, 0);
  };

  const handleToggleStatus = async (record: any) => {
    try {
      const newStatus = record.status === 1 ? 0 : 1;
      const res = await request('/api/v1/admin/member-plans/' + record.id, {
        method: 'PUT',
        data: { status: newStatus },
      });
      if (res.code === 200) {
        message.success(newStatus === 0 ? '已下架' : '已上架');
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
        benefit_config: {
          discount_rate: values.discount_rate,
          items: values.benefit_items || [],
        },
        coupon_package: {
          desc: values.coupon_desc,
          total_value: values.coupon_total_value,
          templates: (values.coupon_templates || []).map((t: any) => ({
            template_id: Number(t.template_id),
            count: Number(t.count),
            valid_days: Number(t.valid_days),
          })),
        },
      };
      // 删除前端临时字段
      delete payload.discount_rate;
      delete payload.benefit_items;
      delete payload.coupon_desc;
      delete payload.coupon_total_value;
      delete payload.coupon_templates;

      const url = editData ? '/api/v1/admin/member-plans/' + editData.id : '/api/v1/admin/member-plans';
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
      message.error('提交失败，请检查表单');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '副标题', dataIndex: 'subtitle', width: 150, ellipsis: true, search: false },
    {
      title: '价格',
      width: 150,
      search: false,
      render: (_: any, record: any) => (
        <Space>
          <span style={{ color: '#f5222d', fontWeight: 'bold' }}>¥{record.sale_price}</span>
          {record.original_price > record.sale_price && (
            <span style={{ textDecoration: 'line-through', color: '#999' }}>¥{record.original_price}</span>
          )}
        </Space>
      ),
    },
    { title: '时长(天)', dataIndex: 'duration_days', width: 100, search: false },
    {
      title: '标签',
      dataIndex: 'tag',
      width: 100,
      search: false,
      render: (tag: string) => tag ? <Tag color="orange">{tag}</Tag> : '-',
    },
    {
      title: '推荐',
      dataIndex: 'is_recommend',
      width: 80,
      search: false,
      render: (v: number) => (v === 1 ? <Tag color="red">推荐</Tag> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (_: any, record: any) => (
        <Tag color={statusMap[record.status]?.color}>{statusMap[record.status]?.text}</Tag>
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
        <Popconfirm
          key="toggle"
          title={record.status === 1 ? '确认下架' : '确认上架'}
          description={record.status === 1 ? '下架后用户将无法购买，是否继续？' : '上架后用户将可以购买，是否继续？'}
          onConfirm={() => handleToggleStatus(record)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" danger={record.status === 1} size="small" icon={<DeleteOutlined />}>
            {record.status === 1 ? '下架' : '上架'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const memberCouponTemplates = couponTemplates.filter((t: any) => t.source_type === 2 && t.status === 1);

  return (
    <PageContainer title="会员套餐">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建套餐
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/member-plans', {
            params: { status: params.status },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.list?.length || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <ModalForm
        title={editData ? '编辑会员套餐' : '新建会员套餐'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={700}
      >
        <ProFormText name="name" label="套餐名称" rules={[{ required: true }]} placeholder="如：月卡会员" />
        <ProFormText name="subtitle" label="副标题" placeholder="如：连续包月" />
        <ProFormDigit name="original_price" label="原价" rules={[{ required: true }]} min={0} step={0.01} />
        <ProFormDigit name="sale_price" label="售价" rules={[{ required: true }]} min={0} step={0.01} />
        <ProFormDigit name="duration_days" label="有效期(天)" rules={[{ required: true }]} min={1} />
        <ProFormDigit name="sort_order" label="排序" min={0} initialValue={0} tooltip="越小越靠前" />
        <ProFormText name="tag" label="角标" placeholder="如：热销、超值" />
        <ProFormText name="color" label="主题色" initialValue="#FF6B35" placeholder="如：#FF6B35" />
        <ProFormRadio.Group
          name="is_recommend"
          label="是否推荐"
          options={[
            { label: '否', value: 0 },
            { label: '推荐', value: 1 },
          ]}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '上架', value: 1 },
            { label: '下架', value: 0 },
          ]}
        />

        {/* 权益配置 */}
        <div style={{ fontWeight: 'bold', fontSize: 16, marginTop: 16, marginBottom: 8, color: '#1f2937' }}>权益配置</div>
        <ProFormDigit
          name="discount_rate"
          label="折扣率"
          min={0}
          max={1}
          step={0.01}
          initialValue={0.98}
          tooltip="如 0.98 表示全场9.8折，不填则不在权益中展示"
        />
        <ProFormItem label="权益列表" required>
          <Form.List name="benefit_items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...restField} name={[name, 'icon']} rules={[{ required: true, message: '请选择图标' }]} style={{ marginBottom: 0 }}>
                      <Select placeholder="图标" style={{ width: 120 }} options={ICON_OPTIONS} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'title']} rules={[{ required: true, message: '请输入标题' }]} style={{ marginBottom: 0 }}>
                      <Input placeholder="如：全场9.8折" style={{ width: 260 }} />
                    </Form.Item>
                    <MinusCircleOutlined style={{ color: '#999' }} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加权益
                </Button>
              </>
            )}
          </Form.List>
        </ProFormItem>

        {/* 券包配置 */}
        <div style={{ fontWeight: 'bold', fontSize: 16, marginTop: 16, marginBottom: 8, color: '#1f2937' }}>券包配置</div>
        <ProFormText name="coupon_desc" label="券包描述" placeholder="如：3张¥10券" rules={[{ required: true }]} />
        <ProFormDigit name="coupon_total_value" label="券包总价值" min={0} step={0.01} rules={[{ required: true }]} />
        <ProFormItem label="券模板列表" required>
          <Form.List name="coupon_templates">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...restField} name={[name, 'template_id']} rules={[{ required: true, message: '请选择模板' }]} style={{ marginBottom: 0 }}>
                      <Select
                        placeholder="选择优惠券模板"
                        style={{ width: 220 }}
                        showSearch
                        filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                        options={memberCouponTemplates.map((t: any) => ({ label: `${t.name}（${t.type === 2 ? `${t.value}折` : `¥${t.value}`}）`, value: t.id }))}
                      />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'count']} rules={[{ required: true, message: '请输入数量' }]} style={{ marginBottom: 0 }}>
                      <Input type="number" placeholder="数量" style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'valid_days']} rules={[{ required: true, message: '请输入天数' }]} style={{ marginBottom: 0 }}>
                      <Input type="number" placeholder="有效天数" style={{ width: 100 }} />
                    </Form.Item>
                    <MinusCircleOutlined style={{ color: '#999' }} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加券模板
                </Button>
              </>
            )}
          </Form.List>
        </ProFormItem>

        {memberCouponTemplates.length === 0 && (
          <div style={{ padding: 12, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, color: '#cf1322' }}>
            暂无可用优惠券模板，请先前往「优惠券模板」页面创建来源类型为「会员购买赠送」的模板
          </div>
        )}
      </ModalForm>
    </PageContainer>
  );
}
