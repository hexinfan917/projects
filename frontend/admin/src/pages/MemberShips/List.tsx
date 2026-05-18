import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Tag, Avatar, Space, Button, Drawer, Table, Descriptions, Divider, Spin } from 'antd';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '生效中', color: 'success' },
  2: { text: '已过期', color: 'default' },
  3: { text: '已退款', color: 'error' },
};

const COUPON_STATUS_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '未使用', color: 'default' },
  2: { text: '已使用', color: 'success' },
  3: { text: '已过期', color: 'warning' },
  4: { text: '已作废', color: 'error' },
};

const COUPON_TYPE_MAP: Record<number, string> = {
  1: '满减券',
  2: '折扣券',
  3: '立减券',
  4: '礼品券',
};

const PAY_CHANNEL_MAP: Record<string, string> = {
  'wechat': '微信支付',
  'alipay': '支付宝',
  'balance': '余额支付',
};

export default function MemberShipList() {
  const tableRef = useRef<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponList, setCouponList] = useState<any[]>([]);

  useEffect(() => {
    request('/api/v1/admin/member-plans').then((res: any) => {
      if (res.code === 200) {
        setPlans(res.data?.list || []);
      }
    }).catch(() => {});
  }, []);

  const openDetail = (record: any) => {
    setDetailRecord(record);
    setDetailVisible(true);
    setCouponLoading(true);
    request('/api/v1/admin/user-coupons', {
      params: {
        user_id: record.user_id,
        page_size: 100,
      },
    }).then((res: any) => {
      if (res.code === 200) {
        setCouponList(res.data?.list || []);
      }
    }).catch(() => {
      setCouponList([]);
    }).finally(() => {
      setCouponLoading(false);
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      width: 200,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={40}>{record.nickname?.[0] || '?'}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.phone}</div>
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
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        1: { text: '生效中' },
        2: { text: '已过期' },
        3: { text: '已退款' },
      },
      render: (_: any, record: any) => {
        const s = STATUS_MAP[record.status] || { text: '未知', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '权益详情',
      dataIndex: 'benefits',
      width: 160,
      search: false,
      render: (benefits: string[]) => (
        <Space size={4} wrap>
          {(benefits || []).map((b: string, i: number) => (
            <Tag key={i} color="blue" style={{ fontSize: 12 }}>{b}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '有效期',
      dataIndex: 'start_date',
      width: 200,
      search: false,
      render: (_: any, record: any) => (
        <div>
          <div>{record.start_date} ~ {record.end_date}</div>
          {record.status === 1 && (
            <div style={{ fontSize: 12, color: '#52c41a' }}>
              剩余 {Math.max(0, Math.ceil((new Date(record.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} 天
            </div>
          )}
        </div>
      ),
    },
    {
      title: '支付金额',
      dataIndex: 'pay_amount',
      width: 100,
      search: false,
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
    {
      title: '优惠券',
      dataIndex: 'coupon_remaining',
      width: 100,
      search: false,
      render: (_: any, record: any) => {
        const remaining = record.coupon_remaining || 0;
        const total = record.coupon_total || 0;
        if (remaining === 0 && total > 0) {
          return <Tag color="default">已领完</Tag>;
        }
        return <Tag color={remaining > 0 ? 'green' : 'default'}>{remaining}/{total} 张</Tag>;
      },
    },
    {
      title: '订单信息',
      width: 240,
      search: false,
      render: (_: any, record: any) => {
        const orders = record.order_coupons || [];
        if (orders.length === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <Space direction="vertical" size={4}>
            {orders.slice(0, 2).map((o: any) => (
              <div key={o.order_id} style={{ fontSize: 12 }}>
                <a
                  href={`/admin/orders?order_no=${o.order_no}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: 8 }}
                >
                  {o.order_no}
                </a>
                <Tag color="orange" style={{ fontSize: 11 }}>{o.coupon_name}</Tag>
                <span style={{ color: '#f5222d' }}>-¥{o.discount_amount?.toFixed(2)}</span>
              </div>
            ))}
            {orders.length > 2 && <span style={{ fontSize: 12, color: '#999' }}>+{orders.length - 2} 条...</span>}
          </Space>
        );
      },
    },
    {
      title: '自动续费',
      dataIndex: 'is_auto_renew',
      width: 90,
      search: false,
      render: (v: number) => v === 1 ? '是' : '否',
    },
    {
      title: '开通时间',
      dataIndex: 'created_at',
      width: 170,
      search: false,
    },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      search: false,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => openDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const couponColumns = [
    { title: '券编号', dataIndex: 'coupon_no', width: 140 },
    { title: '券名称', dataIndex: 'name', width: 150 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: number) => COUPON_TYPE_MAP[v] || '未知',
    },
    {
      title: '面值',
      dataIndex: 'value',
      width: 80,
      render: (v: number, record: any) => {
        if (record.type === 4) return '-';
        return `¥${v?.toFixed(2)}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: number) => {
        const s = COUPON_STATUS_MAP[v] || { text: '未知', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '有效期', width: 180, render: (_: any, record: any) => `${record.valid_start_time?.slice(0, 10)} ~ ${record.valid_end_time?.slice(0, 10)}` },
    {
      title: '使用时间',
      dataIndex: 'used_at',
      width: 160,
      render: (v: string) => v || '-',
    },
  ];

  const orderColumns = [
    { title: '订单号', dataIndex: 'order_no', width: 160 },
    { title: '使用券', dataIndex: 'coupon_name', width: 120 },
    {
      title: '优惠金额',
      dataIndex: 'discount_amount',
      width: 100,
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record: any) => (
        <a href={`/admin/orders?order_no=${record.order_no}`} target="_blank" rel="noopener noreferrer">
          查看
        </a>
      ),
    },
  ];

  return (
    <PageContainer title="会员列表">
      <ProTable
        actionRef={tableRef}
        columns={columns}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
        request={async (params: any) => {
          const res: any = await request('/api/v1/admin/memberships', {
            params: {
              keyword: params.nickname,
              status: params.status,
              page: params.current || 1,
              page_size: params.pageSize || 10,
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
        toolBarRender={false}
      />

      <Drawer
        title="会员详情"
        width={720}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {detailRecord && (
          <>
            <Descriptions title="基本信息" column={2} size="small" bordered>
              <Descriptions.Item label="会员ID">{detailRecord.id}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{detailRecord.user_id}</Descriptions.Item>
              <Descriptions.Item label="用户昵称">{detailRecord.nickname}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detailRecord.phone}</Descriptions.Item>
              <Descriptions.Item label="套餐">{detailRecord.plan_name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailRecord.status]?.color}>
                  {STATUS_MAP[detailRecord.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="有效期">{detailRecord.start_date} ~ {detailRecord.end_date}</Descriptions.Item>
              <Descriptions.Item label="支付金额">¥{detailRecord.pay_amount?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="支付方式">{PAY_CHANNEL_MAP[detailRecord.pay_channel] || detailRecord.pay_channel || '-'}</Descriptions.Item>
              <Descriptions.Item label="订单号">{detailRecord.order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="自动续费">{detailRecord.is_auto_renew === 1 ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="开通时间">{detailRecord.created_at}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px 0' }}>券包明细（{couponList.length} 张）</h4>
              <Spin spinning={couponLoading}>
                <Table
                  size="small"
                  rowKey="id"
                  columns={couponColumns}
                  dataSource={couponList}
                  pagination={false}
                  scroll={{ x: 800 }}
                />
              </Spin>
            </div>

            <Divider />

            <div>
              <h4 style={{ margin: '0 0 12px 0' }}>用券订单（{(detailRecord.order_coupons || []).length} 条）</h4>
              <Table
                size="small"
                rowKey="order_id"
                columns={orderColumns}
                dataSource={detailRecord.order_coupons || []}
                pagination={false}
                locale={{ emptyText: '暂无用券订单' }}
              />
            </div>
          </>
        )}
      </Drawer>
    </PageContainer>
  );
}
