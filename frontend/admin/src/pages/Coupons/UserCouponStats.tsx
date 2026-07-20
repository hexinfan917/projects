import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Tag, Table, Alert } from 'antd';
import { useRef } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  1: { text: '未使用', color: 'default' },
  2: { text: '已使用', color: 'success' },
  3: { text: '已过期', color: 'warning' },
  4: { text: '已作废', color: 'error' },
};

const typeMap: Record<number, { text: string; color: string }> = {
  1: { text: '满减券', color: 'blue' },
  2: { text: '折扣券', color: 'purple' },
  3: { text: '立减券', color: 'green' },
  4: { text: '礼品券', color: 'orange' },
};

const sourceTypeMap: Record<number, { text: string; color: string }> = {
  1: { text: '通用', color: 'blue' },
  2: { text: '会员购买赠送', color: 'purple' },
  3: { text: '会员每月发放', color: 'orange' },
  4: { text: '管理后台发放', color: 'cyan' },
};

export default function UserCouponStats() {
  const tableRef = useRef<any>(null);

  const expandedRowRender = (record: any) => {
    const columns = [
      { title: '券编号', dataIndex: 'coupon_no', width: 180 },
      { title: '券名称', dataIndex: 'name', width: 150 },
      {
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: (v: number) => <Tag color={typeMap[v]?.color}>{typeMap[v]?.text}</Tag>,
      },
      {
        title: '优惠值',
        dataIndex: 'value',
        width: 100,
        render: (_: any, row: any) => (row.type === 2 ? `${row.value}折` : `¥${row.value}`),
      },
      {
        title: '门槛',
        dataIndex: 'min_amount',
        width: 100,
        render: (v: number) => (v > 0 ? `满${v}元` : '无门槛'),
      },
      {
        title: '来源类型',
        dataIndex: 'source_type',
        width: 120,
        render: (v: number) => <Tag color={sourceTypeMap[v]?.color}>{sourceTypeMap[v]?.text}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v: number) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text}</Tag>,
      },
      {
        title: '有效期至',
        dataIndex: 'valid_end_time',
        width: 180,
        render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '发放时间',
        dataIndex: 'created_at',
        width: 180,
        render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={record.coupons || []}
        rowKey="id"
        pagination={false}
        size="small"
        bordered
      />
    );
  };

  const columns = [
    { title: '用户ID', dataIndex: 'user_id', width: 80, search: false },
    {
      title: '用户',
      dataIndex: 'nickname',
      width: 180,
      render: (_: any, record: any) => (
        <span>
          {record.nickname || '-'}
          {record.phone && <span style={{ color: '#999', marginLeft: 8 }}>({record.phone})</span>}
        </span>
      ),
    },
    {
      title: '是否会员',
      dataIndex: 'is_member',
      width: 100,
      search: false,
      valueEnum: {
        1: { text: '是' },
        0: { text: '否' },
      },
      render: (_: any, record: any) => (
        <Tag color={record.is_member ? 'success' : 'default'}>
          {record.is_member ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '券总数',
      dataIndex: 'total',
      width: 100,
      search: false,
    },
    {
      title: '未使用',
      dataIndex: 'unused',
      width: 100,
      search: false,
      render: (v: number) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '已使用',
      dataIndex: 'used',
      width: 100,
      search: false,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '已过期',
      dataIndex: 'expired',
      width: 100,
      search: false,
      render: (v: number) => <span style={{ color: '#faad14', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '已作废',
      dataIndex: 'invalid',
      width: 100,
      search: false,
      render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>{v}</span>,
    },
  ];

  return (
    <PageContainer title="用户优惠券统计">
      <Alert
        message="排序规则：未使用券数量降序 → 券总数降序 → 最近发券时间降序"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/user-coupon-stats', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.nickname,
            },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="user_id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        expandable={{ expandedRowRender }}
        scroll={{ x: 1000 }}
      />
    </PageContainer>
  );
}
