import { PageContainer, ProTable, ModalForm, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Tag, Modal, Descriptions, message, Image, Card, Row, Col, Divider } from 'antd';
import { EyeOutlined, ExportOutlined, MoneyCollectOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  10: { text: '待支付', color: 'orange' },
  20: { text: '待出行', color: 'blue' },
  30: { text: '已取消', color: 'default' },
  40: { text: '退款中', color: 'red' },
  50: { text: '已退款', color: 'default' },
  60: { text: '已完成', color: 'green' },
  70: { text: '已评价', color: 'purple' },
};

const statusOptions = [
  { label: '待支付', value: 10 },
  { label: '待出行', value: 20 },
  { label: '已取消', value: 30 },
  { label: '退款中', value: 40 },
  { label: '已退款', value: 50 },
  { label: '已完成', value: 60 },
  { label: '已评价', value: 70 },
];

export default function OrderList() {
  const tableRef = useRef<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleViewDetail = async (record: any) => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders/' + record.id);
      if (res.code === 200 && res.data) {
        setCurrentOrder(res.data);
        setDetailModalVisible(true);
      } else {
        message.error(res.message || '获取订单详情失败');
      }
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = (record: any) => {
    setCurrentOrder(record);
    setRefundModalVisible(true);
  };

  const submitRefund = async (values: any) => {
    try {
      const res = await request('/api/v1/admin/orders/' + currentOrder.id + '/refund', {
        method: 'POST',
        data: values,
      });
      if (res.code === 200) {
        message.success('退款申请已提交');
        setRefundModalVisible(false);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || '退款失败');
        return false;
      }
    } catch (error) {
      message.error('退款失败');
      return false;
    }
  };

  const handleExport = async () => {
    try {
      message.loading('正在导出...', 0);
      // 获取当前筛选条件下的所有订单（最多5000条）
      const params = tableRef.current?.getParams() || {};
      const res = await request('/api/v1/admin/orders', {
        params: { ...params, page: 1, page_size: 5000 },
      });
      message.destroy();
      
      if (res.code !== 200 || !res.data?.orders?.length) {
        message.warning('暂无数据可导出');
        return;
      }
      
      const orders = res.data.orders;
      const headers = ['订单号', '状态', '路线名称', '出行日期', '联系人', '联系电话', '出行人数', '宠物数', '订单金额', '实付金额', '创建时间'];
      const rows = orders.map((o: any) => [
        o.order_no,
        statusMap[o.status]?.text || o.status,
        o.route_name,
        o.travel_date,
        o.contact?.name || '',
        o.contact?.phone || '',
        o.participant_count,
        o.pet_count,
        o.total_amount,
        o.pay_amount,
        o.created_at ? dayjs(o.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
      ]);
      
      // 构建 CSV
      const csvContent = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `订单导出_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`已导出 ${orders.length} 条订单`);
    } catch (error) {
      message.destroy();
      message.error('导出失败');
    }
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      search: false,
      copyable: true,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 80,
      search: false,
    },
    {
      title: '路线',
      dataIndex: 'route_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '出行日期',
      dataIndex: 'travel_date',
      width: 120,
      search: false,
    },
    {
      title: '人数/宠物',
      width: 100,
      search: false,
      render: (record: any) => `${record.participant_count}人/${record.pet_count}宠`,
    },
    {
      title: '金额',
      dataIndex: 'pay_amount',
      width: 100,
      search: false,
      render: (text: number) => <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{text?.toFixed(2)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        10: { text: '待支付' },
        20: { text: '待出行' },
        30: { text: '已取消' },
        40: { text: '退款中' },
        50: { text: '已退款' },
        60: { text: '已完成' },
        70: { text: '已评价' },
      },
      render: (_: any, record: any) => {
        const status = Number(record.status);
        const config = statusMap[status];
        return (
          <Tag color={config?.color || 'default'}>
            {config?.text || record.status_name || '未知'}
          </Tag>
        );
      },
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => date ? dayjs(date).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看
        </Button>,
        ([20, 60, 70].includes(record.status)) && (
          <Button key="refund" type="link" size="small" danger icon={<MoneyCollectOutlined />} onClick={() => handleRefund(record)}>
            退款
          </Button>
        ),
      ],
    },
  ];

  return (
    <PageContainer title="订单管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/orders', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
              keyword: params.route_name,
            },
          });
          return {
            data: res.data?.orders || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1300 }}
        toolBarRender={() => [
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            导出订单
          </Button>,
        ]}
      />

      {/* 订单详情 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={800}
      >
        {currentOrder && (
          <>
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="订单号">{currentOrder.order_no}</Descriptions.Item>
                    <Descriptions.Item label="下单时间">{currentOrder.created_at ? dayjs(currentOrder.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="订单状态">
                      <Tag color={statusMap[currentOrder.status]?.color}>{statusMap[currentOrder.status]?.text}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col span={12}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="用户ID">{currentOrder.user_id}</Descriptions.Item>
                    <Descriptions.Item label="支付时间">{currentOrder.pay_time ? dayjs(currentOrder.pay_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="支付方式">{currentOrder.pay_channel || '-'}</Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            <Card title="路线信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  {currentOrder.route_cover && (
                    <Image src={currentOrder.route_cover} style={{ width: '100%', borderRadius: 4 }} />
                  )}
                </Col>
                <Col span={16}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="路线名称">{currentOrder.route_name}</Descriptions.Item>
                    <Descriptions.Item label="出行日期">{currentOrder.travel_date}</Descriptions.Item>
                    <Descriptions.Item label="出行人数">{currentOrder.participant_count}人</Descriptions.Item>
                    <Descriptions.Item label="携带宠物">{currentOrder.pet_count}只</Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            <Card title="费用明细" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="路线单价">¥{currentOrder.route_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="保险费用">¥{currentOrder.insurance_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="优惠金额">-¥{currentOrder.discount_amount?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="实付金额">
                  <span style={{ color: '#cf1322', fontSize: 16, fontWeight: 'bold' }}>¥{currentOrder.pay_amount?.toFixed(2)}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {currentOrder.participants && (
              <Card title="出行人信息" size="small" style={{ marginBottom: 16 }}>
                {(currentOrder.participants || []).map((p: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <Tag color="blue">{p.name}</Tag>
                    <span style={{ marginLeft: 8 }}>{p.phone}</span>
                    {p.id_card && <span style={{ marginLeft: 8, color: '#999' }}>身份证: {p.id_card}</span>}
                  </div>
                ))}
              </Card>
            )}

            {currentOrder.contact && (
              <Card title="联系人信息" size="small">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="姓名">{currentOrder.contact.name}</Descriptions.Item>
                  <Descriptions.Item label="手机">{currentOrder.contact.phone}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </>
        )}
      </Modal>

      {/* 退款申请 */}
      <ModalForm
        title="订单退款"
        open={refundModalVisible}
        onOpenChange={setRefundModalVisible}
        onFinish={submitRefund}
      >
        <p>订单号: {currentOrder?.order_no}</p>
        <p>实付金额: <span style={{ color: '#cf1322', fontWeight: 'bold' }}>¥{currentOrder?.pay_amount?.toFixed(2)}</span></p>
        <ProFormSelect
          name="refund_type"
          label="退款类型"
          options={[
            { label: '全额退款', value: 'full' },
            { label: '部分退款', value: 'partial' },
          ]}
          initialValue="full"
        />
        <ProFormTextArea
          name="refund_reason"
          label="退款原因"
          placeholder="请输入退款原因"
          rules={[{ required: true, message: '请输入退款原因' }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
