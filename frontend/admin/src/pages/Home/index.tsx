import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { UserOutlined, ShoppingOutlined, EnvironmentOutlined, DollarOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { request } from '@umijs/max';

export default function Home() {
  const [stats, setStats] = useState({
    total_users: 0,
    today_orders: 0,
    today_revenue: 0,
    total_orders: 0,
    total_revenue: 0,
    pending_orders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const res = await request('/api/v1/admin/stats');
      if (res.code === 200 && res.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 获取最近订单
  const fetchRecentOrders = async () => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders', {
        params: { page: 1, page_size: 5 },
      });
      if (res.code === 200 && res.data) {
        setRecentOrders(res.data.orders || []);
      }
    } catch (error) {
      console.error('获取最近订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentOrders();
  }, []);

  const statusMap: Record<number, { text: string; color: string }> = {
    10: { text: '待支付', color: 'orange' },
    20: { text: '待出行', color: 'blue' },
    30: { text: '已取消', color: 'default' },
    40: { text: '退款中', color: 'red' },
    50: { text: '已退款', color: 'default' },
    60: { text: '已完成', color: 'green' },
    70: { text: '已评价', color: 'purple' },
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
    },
    {
      title: '路线',
      dataIndex: 'route_name',
      key: 'route_name',
      ellipsis: true,
    },
    {
      title: '金额',
      dataIndex: 'pay_amount',
      key: 'pay_amount',
      render: (text: number) => `¥${text.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: any) => {
        const status = Number(record.status);
        return (
          <Tag color={statusMap[status]?.color || 'default'}>
            {statusMap[status]?.text || record.status_name || '未知'}
          </Tag>
        );
      },
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ];

  return (
    <PageContainer title="首页">
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.total_users}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={stats.today_orders}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日营业额"
              value={stats.today_revenue}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理订单"
              value={stats.pending_orders}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="最近订单" loading={loading}>
            <Table
              columns={columns}
              dataSource={recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="数据概览">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="总订单数"
                  value={stats.total_orders}
                  suffix="单"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="总营业额"
                  value={stats.total_revenue}
                  precision={2}
                  suffix="元"
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
