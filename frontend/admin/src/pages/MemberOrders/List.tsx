import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Avatar } from 'antd';
import { useRef } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  10: { text: '待支付', color: 'default' },
  20: { text: '已支付', color: 'success' },
  30: { text: '已取消', color: 'default' },
  40: { text: '已退款', color: 'error' },
};

export default function MemberOrderList() {
  const tableRef = useRef<any>(null);

  const handleRefund = async (record: any) => {
    try {
      const res = await request(`/api/v1/admin/member-orders/${record.id}/refund`, {
        method: 'POST',
      });
      if (res.code === 200) {
        message.success('退款成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '退款失败');
      }
    } catch (error: any) {
      message.error(error?.message || '退款失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      copyable: true,
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      width: 200,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={40}>{record.nickname?.[0] || '?'}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '-'}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.phone || '-'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '套餐',
      dataIndex: 'plan_name',
      width: 120,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      width: 80,
      search: false,
      render: (v: string) => {
        if (v === 'ios') return <Tag color="blue">苹果</Tag>;
        if (v === 'android') return <Tag color="green">安卓</Tag>;
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        10: { text: '待支付' },
        20: { text: '已支付' },
        30: { text: '已取消' },
        40: { text: '已退款' },
      },
      render: (_: any, record: any) => {
        const s = STATUS_MAP[record.status] || { text: '未知', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '原价',
      dataIndex: 'original_price',
      width: 100,
      search: false,
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
    {
      title: '实付金额',
      dataIndex: 'pay_amount',
      width: 100,
      search: false,
      render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>¥{v?.toFixed(2)}</span>,
    },
    {
      title: '支付时间',
      dataIndex: 'pay_time',
      width: 180,
      search: false,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '退款金额',
      dataIndex: 'refund_amount',
      width: 100,
      search: false,
      render: (v: number) => v > 0 ? `¥${v?.toFixed(2)}` : '-',
    },
    {
      title: '退款时间',
      dataIndex: 'refund_time',
      width: 180,
      search: false,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      search: false,
      render: (_: any, record: any) => {
        if (record.status === 20) {
          return (
            <Popconfirm
              title="确认退款"
              description={`确定要为用户「${record.nickname || record.user_id}」退款 ¥${record.pay_amount?.toFixed(2)} 吗？退款后会员权益将失效。`}
              onConfirm={() => handleRefund(record)}
              okText="确认退款"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger size="small">
                退款
              </Button>
            </Popconfirm>
          );
        }
        return <span style={{ color: '#999' }}>-</span>;
      },
    },
  ];

  return (
    <PageContainer title="会员订单">
      <ProTable
        columns={columns}
        rowKey="id"
        actionRef={tableRef}
        scroll={{ x: 1400 }}
        request={async (params) => {
          const res: any = await request('/api/v1/admin/member-orders', {
            params: {
              keyword: params.keyword,
              status: params.status,
              page: params.current,
              page_size: params.pageSize,
            },
          });
          if (res.code === 200) {
            return {
              data: res.data?.list || [],
              total: res.data?.total || 0,
              success: true,
            };
          }
          return { data: [], total: 0, success: false };
        }}
      />
    </PageContainer>
  );
}
