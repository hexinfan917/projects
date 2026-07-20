import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import { useRef } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const typeMap: Record<number, { text: string; color: string }> = {
  1: { text: '满减券', color: 'blue' },
  2: { text: '折扣券', color: 'purple' },
  3: { text: '立减券', color: 'green' },
  4: { text: '礼品券', color: 'orange' },
};

const statusMap: Record<number, { text: string; color: string }> = {
  1: { text: '未使用', color: 'default' },
  2: { text: '已使用', color: 'success' },
  3: { text: '已过期', color: 'warning' },
  4: { text: '已作废', color: 'error' },
};

const sourceTypeMap: Record<number, { text: string; color: string }> = {
  1: { text: '通用', color: 'blue' },
  2: { text: '会员购买赠送', color: 'purple' },
  3: { text: '会员每月发放', color: 'orange' },
  4: { text: '管理后台发放', color: 'cyan' },
};

export default function CouponGrantRecords() {
  const tableRef = useRef<any>(null);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '券编号',
      dataIndex: 'coupon_no',
      width: 180,
      search: false,
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
        <Tag color={typeMap[record.type]?.color}>{typeMap[record.type]?.text}</Tag>
      ),
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
      title: '用户',
      dataIndex: 'nickname',
      width: 150,
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
      title: '来源类型',
      dataIndex: 'source_type',
      width: 120,
      valueEnum: {
        1: { text: '通用' },
        2: { text: '会员购买赠送' },
        3: { text: '会员每月发放' },
        4: { text: '管理后台发放' },
      },
      render: (_: any, record: any) => (
        <Tag color={sourceTypeMap[record.source_type]?.color}>
          {sourceTypeMap[record.source_type]?.text}
        </Tag>
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
        <Tag color={statusMap[record.status]?.color}>{statusMap[record.status]?.text}</Tag>
      ),
    },
    {
      title: '有效期至',
      dataIndex: 'valid_end_time',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '发放时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];

  return (
    <PageContainer title="优惠券发放记录">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/user-coupons', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              source_type: 4, // 只查询管理后台发放的记录
              status: params.status,
              type: params.type,
              keyword: params.name,
            },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1400 }}
      />
    </PageContainer>
  );
}
