import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Modal, Input } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  40: { text: '退款中', color: 'orange' },
  45: { text: '退款驳回', color: 'red' },
  50: { text: '已退款', color: 'default' },
};

export default function FinanceManage() {
  const tableRef = useRef<any>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async (orderId: number) => {
    try {
      const res = await request(`/api/v1/admin/refunds/${orderId}/approve`, {
        method: 'POST',
      });
      if (res.code === 200) {
        message.success('退款审核通过');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '审核失败');
      }
    } catch (error) {
      message.error('审核失败');
    }
  };

  const handleReject = async () => {
    if (!currentOrder) return;
    if (!rejectReason.trim()) {
      message.warning('请填写拒绝原因');
      return;
    }
    try {
      const res = await request(`/api/v1/admin/refunds/${currentOrder.id}/reject`, {
        method: 'POST',
        data: { reason: rejectReason.trim() },
      });
      if (res.code === 200) {
        message.success('已拒绝退款申请');
        setRejectModalVisible(false);
        setRejectReason('');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 180,
      copyable: true,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 80,
    },
    {
      title: '路线',
      dataIndex: 'route_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '支付金额',
      dataIndex: 'pay_amount',
      width: 100,
      render: (text: number) => <span>¥{text?.toFixed(2)}</span>,
    },
    {
      title: '退款金额',
      dataIndex: 'refund_amount',
      width: 100,
      render: (text: number) => <span style={{ color: '#cf1322' }}>¥{text?.toFixed(2)}</span>,
    },
    {
      title: '退款原因',
      dataIndex: 'refund_reason',
      ellipsis: true,
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        40: { text: '退款中' },
        45: { text: '退款驳回' },
        50: { text: '已退款' },
      },
      render: (_: any, record: any) => (
        <Tag color={statusMap[record.status]?.color || 'default'}>
          {statusMap[record.status]?.text || '未知'}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 180,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_: any, record: any) =>
        record.status === 40 ? [
          <Popconfirm
            key="approve"
            title="确认通过"
            description="确认同意该退款申请？"
            onConfirm={() => handleApprove(record.id)}
          >
            <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>
              通过
            </Button>
          </Popconfirm>,
          <Button
            key="reject"
            type="link"
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              setCurrentOrder(record);
              setRejectModalVisible(true);
            }}
          >
            拒绝
          </Button>,
        ] : null,
    },
  ];

  return (
    <PageContainer title="退款审核">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/refunds', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
            },
          });
          return {
            data: res.data?.refunds || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="拒绝退款申请"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false);
          setRejectReason('');
        }}
      >
        <p>订单号: {currentOrder?.order_no}</p>
        <p style={{ marginBottom: 8 }}>拒绝原因：</p>
        <Input.TextArea
          rows={4}
          placeholder="请填写拒绝退款的原因，用户将看到此说明"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </PageContainer>
  );
}
