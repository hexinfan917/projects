import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormRadio, ProFormDateTimePicker, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const typeMap: Record<number, { text: string; color: string }> = {
  1: { text: '满减券', color: 'blue' },
  2: { text: '折扣券', color: 'purple' },
  3: { text: '立减券', color: 'green' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '停用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

const sourceTypeMap: Record<number, { text: string; color: string }> = {
  1: { text: '通用', color: 'blue' },
  2: { text: '会员购买赠送', color: 'purple' },
  3: { text: '会员每月发放', color: 'orange' },
};

export default function CouponTemplateList() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const formRef = useRef<any>(null);
  const [applicableType, setApplicableType] = useState<number>(1);
  const [routeList, setRouteList] = useState<any[]>([]);
  const [routeTypeList, setRouteTypeList] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);

  useEffect(() => {
    request('/api/v1/routes', { params: { page: 1, page_size: 100 } })
      .then(res => { if (res.code === 200) setRouteList(res.data?.routes || []); })
      .catch(() => {});
    request('/api/v1/routes/types')
      .then(res => { if (res.code === 200) setRouteTypeList(res.data || []); })
      .catch(() => {});
  }, []);

  const openModal = async (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
    const type = record?.applicable_type || 1;
    setApplicableType(type);
    let userOpts: any[] = [];
    // 编辑时如果是指定用户，加载已选用户信息
    if (type === 4 && record?.applicable_ids?.length > 0) {
      const res = await request('/api/v1/admin/users', { params: { keyword: '', page: 1, page_size: 100 } });
      if (res.code === 200) {
        const allUsers = res.data?.users || [];
        userOpts = allUsers
          .filter((u: any) => record.applicable_ids.includes(u.id))
          .map((u: any) => ({ label: `${u.nickname} (${u.phone || '-'})`, value: u.id }));
      }
    }
    setUserOptions(userOpts);
    setTimeout(() => {
      const values = record
        ? { ...record, applicable_ids: record.applicable_ids || [] }
        : { type: 1, status: 1, valid_type: 1, valid_days: 7, per_user_limit: 1, total_count: 0, source_type: 1, applicable_type: 1 };
      formRef.current?.setFieldsValue(values);
    }, 0);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/coupon-templates/' + id, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('停用成功');
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
        applicable_ids: Array.isArray(values.applicable_ids) ? values.applicable_ids : (values.applicable_ids ? JSON.parse(values.applicable_ids) : []),
      };
      const url = editData ? '/api/v1/admin/coupon-templates/' + editData.id : '/api/v1/admin/coupon-templates';
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
    } catch (error) {
      message.error(editData ? '更新失败' : '创建失败');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      valueEnum: { 1: { text: '满减券' }, 2: { text: '折扣券' }, 3: { text: '立减券' } },
      render: (_: any, record: any) => <Tag color={typeMap[record.type]?.color}>{typeMap[record.type]?.text}</Tag>,
    },
    {
      title: '优惠值',
      dataIndex: 'value',
      width: 100,
      search: false,
      render: (_: any, record: any) =>
        record.type === 2 ? `${record.value}折` : `¥${record.value}`,
    },
    {
      title: '门槛',
      dataIndex: 'min_amount',
      width: 100,
      search: false,
      render: (v: number) => (v > 0 ? `满${v}元` : '无门槛'),
    },
    {
      title: '发放/总量',
      width: 120,
      search: false,
      render: (_: any, record: any) =>
        record.total_count > 0
          ? `${record.claimed_count || 0} / ${record.total_count}`
          : `${record.claimed_count || 0} / 不限`,
    },
    {
      title: '核销率',
      width: 100,
      search: false,
      render: (_: any, record: any) => record.usage_rate || '0%',
    },
    {
      title: '来源类型',
      dataIndex: 'source_type',
      width: 120,
      valueEnum: { 1: { text: '通用' }, 2: { text: '会员购买赠送' }, 3: { text: '会员每月发放' } },
      render: (_: any, record: any) => <Tag color={sourceTypeMap[record.source_type]?.color}>{sourceTypeMap[record.source_type]?.text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: { 0: { text: '停用' }, 1: { text: '启用' } },
      render: (_: any, record: any) => <Tag color={statusMap[record.status]?.color}>{statusMap[record.status]?.text}</Tag>,
    },
    {
      title: '有效期',
      width: 180,
      search: false,
      render: (_: any, record: any) =>
        record.valid_type === 1
          ? `领取后${record.valid_days}天`
          : `${record.valid_start_time ? dayjs(record.valid_start_time).format('MM-DD') : '-'} ~ ${record.valid_end_time ? dayjs(record.valid_end_time).format('MM-DD') : '-'}`,
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
        <Popconfirm key="delete" title="确认停用" description="停用后用户将无法领取该券，是否继续？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>停用</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="优惠券模板">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建优惠券
          </Button>,
        ]}
        request={async (params) => {
          const res = await request('/api/v1/admin/coupon-templates', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.name,
              type: params.type,
              status: params.status,
            },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
      />

      <ModalForm
        title={editData ? '编辑优惠券' : '新建优惠券'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={600}
      >
        <ProFormText name="name" label="券名称" rules={[{ required: true }]} placeholder="如：新人专享券" />
        <ProFormSelect
          name="source_type"
          label="来源类型"
          rules={[{ required: true }]}
          initialValue={1}
          options={[
            { label: '通用（可在领券中心领取）', value: 1 },
            { label: '会员购买赠送', value: 2 },
            { label: '会员每月发放', value: 3 },
          ]}
        />
        <ProFormSelect
          name="type"
          label="类型"
          rules={[{ required: true }]}
          options={[
            { label: '满减券', value: 1 },
            { label: '折扣券', value: 2 },
            { label: '立减券', value: 3 },
          ]}
        />
        <ProFormDigit name="value" label="优惠值" rules={[{ required: true }]} min={0} step={0.01} tooltip="满减/立减填金额，折扣填0-1之间小数" />
        <ProFormDigit name="min_amount" label="最低门槛金额" min={0} initialValue={0} tooltip="0表示无门槛" />
        <ProFormDigit name="max_discount" label="折扣券最高优惠上限" min={0} initialValue={0} tooltip="仅折扣券有效，0表示不限制" />
        <ProFormDigit name="total_count" label="发放总量" min={0} initialValue={0} tooltip="0表示不限量" />
        <ProFormDigit name="per_user_limit" label="每人限领" min={0} initialValue={1} tooltip="0表示不限" />

        <ProFormRadio.Group
          name="valid_type"
          label="有效期类型"
          options={[
            { label: '领取后X天有效', value: 1 },
            { label: '固定时间段', value: 2 },
          ]}
        />
        <ProFormDigit name="valid_days" label="领取后有效天数" min={1} initialValue={7} tooltip="valid_type=1时生效" />
        <ProFormDateTimePicker name="valid_start_time" label="固定有效期开始" tooltip="valid_type=2时生效" />
        <ProFormDateTimePicker name="valid_end_time" label="固定有效期结束" tooltip="valid_type=2时生效" />

        <ProFormSelect
          name="applicable_type"
          label="适用范围"
          initialValue={1}
          fieldProps={{
            onChange: (value: number) => {
              setApplicableType(value);
              if (value === 1) {
                formRef.current?.setFieldsValue({ applicable_ids: [] });
              }
            },
          }}
          options={[
            { label: '全部路线', value: 1 },
            { label: '指定路线', value: 2 },
            { label: '指定路线类型', value: 3 },
            { label: '指定用户', value: 4 },
          ]}
        />
        {applicableType === 2 && (
          <ProFormSelect
            name="applicable_ids"
            label="适用路线"
            mode="multiple"
            showSearch
            placeholder="请选择适用路线"
            options={routeList.map((r: any) => ({ label: r.name, value: r.id }))}
          />
        )}
        {applicableType === 3 && (
          <ProFormSelect
            name="applicable_ids"
            label="适用路线类型"
            mode="multiple"
            placeholder="请选择适用路线类型"
            options={routeTypeList.map((t: any) => ({ label: t.name, value: t.id }))}
          />
        )}
        {applicableType === 4 && (
          <ProFormSelect
            name="applicable_ids"
            label="适用用户"
            mode="multiple"
            showSearch
            filterOption={false}
            placeholder="输入手机号或昵称搜索用户"
            fieldProps={{
              onSearch: async (keyword: string) => {
                if (!keyword || keyword.length < 2) return;
                const res = await request('/api/v1/admin/users', { params: { keyword, page: 1, page_size: 20 } });
                if (res.code === 200) {
                  const opts = (res.data?.users || []).map((u: any) => ({
                    label: `${u.nickname} (${u.phone || '-'})`,
                    value: u.id,
                  }));
                  setUserOptions(opts);
                }
              },
              notFoundContent: '输入关键词搜索用户',
            }}
            options={userOptions}
          />
        )}

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
