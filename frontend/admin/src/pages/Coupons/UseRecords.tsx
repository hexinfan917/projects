import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Tag, Avatar } from 'antd';
import { useRef } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '未使用', color: 'default' },
  2: { text: '已使用', color: 'success' },
  3: { text: '已过期', color: 'warning' },
  4: { text: '已作废', color: 'error' },
};

const TYPE_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '满减券', color: 'blue' },
  2: { text: '折扣券', color: 'purple' },
  3: { text: '立减券', color: 'green' },
  4: { text: '礼品券', color: 'orange' },
};

export default function CouponUseRecords() {
  const tableRef = useRef<any>(null);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: '券编号',
      dataIndex: 'coupon_no',
      width: 180,
    },
    {
      title: '券名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      valueEnum: {
        1: { text: '满减券' },
        2: { text: '折扣券' },
        3: { text: '立减券' },
        4: { text: '礼品券' },
      },
      render: (_: any, record: any) => (
        <Tag color={TYPE_MAP[record.type]?.color}>{TYPE_MAP[record.type]?.text}</Tag>
      ),
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      width: 200,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={32}>{record.nickname?.[0] || '?'}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '-'}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.phone || '-'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        1: { text: '未使用' },
        2: { text: '已使用' },
        3: { text: '已过期' },
        4: { text: '已作废' },
      },
      render: (_: any, record: any) => (
        <Tag color={STATUS_MAP[record.status]?.color}>{STATUS_MAP[record.status]?.text}</Tag>
      ),
    },
    {
      title: '优惠值',
      dataIndex: 'value',
      width: 100,
      search: false,
      render: (_: any, record: any) =>
        record.type === 2 ? `${record.value}折` : (record.type === 4 ? '-' : `¥${record.value}`),
    },
    {
      title: '有效期',
      width: 200,
      search: false,
      render: (_: any, record: any) => (
        <div>
          <div>{dayjs(record.valid_start_time).format('YYYY-MM-DD HH:mm')} ~</div>
          <div>{dayjs(record.valid_end_time).format('YYYY-MM-DD HH:mm')}</div>
        </div>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      search: false,
      render: (_: any, record: any) => record.order_no || '-',
    },
    {
      title: '核销时间',
      dataIndex: 'used_at',
      width: 170,
      search: false,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '领取时间',
      dataIndex: 'created_at',
      width: 170,
      search: false,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  return (
    <PageContainer title="优惠券核销记录">
      <ProTable
        actionRef={tableRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        request={async (params) => {
          const res = await request('/api/v1/admin/user-coupons', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.coupon_no || params.name,
              type: params.type,
              status: params.status,
            },
          });
          return {
            data: res.data?.list || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
      />
    </PageContainer>
  );
}
