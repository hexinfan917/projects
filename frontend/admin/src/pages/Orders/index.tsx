import { PageContainer, ProTable, ModalForm, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Tag, Modal, Descriptions, message, Image, Card, Row, Col, Divider, Table } from 'antd';
import { EyeOutlined, ExportOutlined, MoneyCollectOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
  70: { text: '已完成', color: 'green' },
};

const statusOptions = [
  { label: '待支付', value: 10 },
  { label: '待出行', value: 20 },
  { label: '已取消', value: 30 },
  { label: '退款中', value: 40 },
  { label: '已退款', value: 50 },
  { label: '已完成', value: 60 },
  { label: '已完成', value: 70 },
];

export default function OrderList() {
  const tableRef = useRef<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 从 URL 获取 order_no 参数（会员列表跳转过来时携带）
  const urlParams = new URLSearchParams(window.location.search);
  const orderNoFromUrl = urlParams.get('order_no');

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

  const handleVerify = async (record: any) => {
    Modal.confirm({
      title: '确认完成订单',
      content: `确认将订单 ${record.order_no} 标记为已完成？用户将可以进行评价。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await request('/api/v1/admin/orders/' + record.id + '/verify', {
            method: 'POST',
          });
          if (res.code === 200) {
            message.success('订单已确认完成');
            tableRef.current?.reload();
          } else {
            message.error(res.message || '确认失败');
          }
        } catch (error) {
          message.error('确认失败');
        }
      },
    });
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
      const res = await request('/api/v1/admin/orders', {
        params: { page: 1, page_size: 5000 },
      });
      message.destroy();
      
      if (res.code !== 200 || !res.data?.orders?.length) {
        message.warning('暂无数据可导出');
        return;
      }
      
      const orders = res.data.orders;
      const headers = ['订单号', '类型', '状态', '路线名称', '出行日期', '联系人', '联系电话', '联系人身份证', '出行人列表', '宠物列表', '出行人数', '宠物数', '订单金额', '实付金额', '创建时间'];
      const rows = orders.map((o: any) => {
        const participants = Array.isArray(o.participants) ? o.participants : [];
        const petsArr = Array.isArray(o.pets) ? o.pets : [];
        const travelers = participants.map((p: any) => `${p?.name || ''}${p?.phone ? '(' + p.phone + ')' : ''}`).join('；') || '';
        const pets = petsArr.map((p: any) => `${p?.name || ''}${p?.breed ? '(' + p.breed + ')' : ''}`).join('；') || '';
        const contact = o.contact && typeof o.contact === 'object' ? o.contact : {};
        return [
          o.order_no || '',
          o.is_free ? '免费' : '付费',
          statusMap[o.status]?.text || o.status || '',
          o.route_name || '',
          o.travel_date || '',
          contact.name || '',
          contact.phone || '',
          contact.id_card || '',
          travelers,
          pets,
          o.participant_count ?? 0,
          o.pet_count ?? 0,
          o.total_amount ?? 0,
          o.pay_amount ?? 0,
          o.created_at ? dayjs(o.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
        ];
      });
      
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
    } catch (error: any) {
      message.destroy();
      console.error('导出失败:', error);
      message.error('导出失败: ' + (error?.message || '未知错误'));
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
      title: '类型',
      dataIndex: 'is_free',
      width: 80,
      valueEnum: {
        0: { text: '付费' },
        1: { text: '免费' },
      },
      render: (_: any, record: any) => (
        <Tag color={record.is_free ? 'green' : 'blue'}>
          {record.is_free ? '免费' : '付费'}
        </Tag>
      ),
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
        70: { text: '已完成' },
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
        record.status === 20 && (
          <Button key="verify" type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleVerify(record)}>
            确认完成
          </Button>
        ),
        (!record.is_free && [20, 60, 70].includes(record.status)) && (
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
              order_no: orderNoFromUrl || undefined,
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
                    <Descriptions.Item label="微信支付单号">{currentOrder.pay_trade_no || currentOrder.pay_transaction_id || '-'}</Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            <Card title="路线信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  {currentOrder.route_cover ? (
                    <Image src={currentOrder.route_cover} style={{ width: '100%', borderRadius: 4, maxHeight: 160, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: 120, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                      暂无封面图
                    </div>
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
                <Descriptions.Item label="装备费用">¥{currentOrder.equipment_price?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="选装费用">¥{currentOrder.addon_amount?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="优惠金额">-¥{currentOrder.discount_amount?.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="订单总额">
                  <span>¥{currentOrder.total_amount?.toFixed(2)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="实付金额" span={2}>
                  <span style={{ color: '#cf1322', fontSize: 16, fontWeight: 'bold' }}>¥{currentOrder.pay_amount?.toFixed(2)}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 出行人信息（同行人） */}
            {currentOrder.participants && currentOrder.participants.length > 0 && (
              <Card title="出行人信息（同行人）" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={currentOrder.participants}
                  columns={[
                    { title: '姓名', dataIndex: 'name', key: 'name' },
                    { title: '手机号', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
                    { title: '身份证号', dataIndex: 'id_card', key: 'id_card', render: (v: string) => v || '-' },
                    { title: '性别', dataIndex: 'gender', key: 'gender', render: (v: number) => v === 1 ? '男' : v === 2 ? '女' : '未知' },
                  ]}
                  rowKey={(record: any, idx: number) => record.id || idx}
                />
              </Card>
            )}

            {/* 联系人信息（默认出行人） */}
            {currentOrder.contact && (
              <Card title="联系人信息（默认出行人）" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="姓名">{currentOrder.contact.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="手机">{currentOrder.contact.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="身份证号">{currentOrder.contact.id_card || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 宠物信息 */}
            {currentOrder.pets && currentOrder.pets.length > 0 && (
              <Card title="宠物信息" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={currentOrder.pets}
                  columns={[
                    { title: '宠物名', dataIndex: 'name', key: 'name' },
                    { title: '品种', dataIndex: 'breed', key: 'breed', render: (v: string) => v || '-' },
                    { title: '性别', dataIndex: 'gender', key: 'gender', render: (v: number) => v === 1 ? '公' : v === 2 ? '母' : '未知' },
                    { title: '体重(kg)', dataIndex: 'weight', key: 'weight', render: (v: number) => v ? v.toFixed(1) : '-' },
                  ]}
                  rowKey={(record: any, idx: number) => record.id || idx}
                />
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
