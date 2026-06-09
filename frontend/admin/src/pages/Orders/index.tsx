import { PageContainer, ProTable, ModalForm, ProFormSelect, ProFormTextArea, ProFormText, ProFormDependency } from '@ant-design/pro-components';
import { Button, Tag, Modal, Descriptions, message, Image, Card, Row, Col, Divider, Table } from 'antd';
import { EyeOutlined, ExportOutlined, MoneyCollectOutlined, CheckCircleOutlined, EditOutlined, CloseCircleOutlined } from '@ant-design/icons';
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
  const formRef = useRef<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const editFormRef = useRef<any>(null);
  const lastSearchRef = useRef<string>('__init__');

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

  const handleEdit = async (record: any) => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/orders/' + record.id);
      if (res.code === 200 && res.data) {
        setCurrentOrder(res.data);
        setEditModalVisible(true);
        // 等待 Modal 打开后设置表单值
        setTimeout(() => {
          const data = res.data;
          editFormRef.current?.setFieldsValue?.({
            contact_name: data.contact?.name || '',
            contact_phone: data.contact?.phone || '',
            contact_id_card: data.contact?.id_card || '',
            travel_date: data.travel_date || '',
            remark: data.remark || '',
            participants_json: data.participants?.length ? JSON.stringify(data.participants, null, 2) : '',
            pets_json: data.pets?.length ? JSON.stringify(data.pets, null, 2) : '',
          });
        }, 100);
      } else {
        message.error(res.message || '获取订单详情失败');
      }
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const submitEdit = async (values: any) => {
    try {
      const payload: any = {};
      payload.contact = {
        name: values.contact_name,
        phone: values.contact_phone,
        id_card: values.contact_id_card,
      };
      if (values.travel_date) payload.travel_date = values.travel_date;
      if (values.remark !== undefined) payload.remark = values.remark;
      if (values.participants_json?.trim()) {
        try { payload.participants = JSON.parse(values.participants_json); } catch { message.error('出行人 JSON 格式错误'); return false; }
      } else {
        payload.participants = [];
      }
      if (values.pets_json?.trim()) {
        try { payload.pets = JSON.parse(values.pets_json); } catch { message.error('宠物 JSON 格式错误'); return false; }
      } else {
        payload.pets = [];
      }

      const res = await request('/api/v1/admin/orders/' + currentOrder.id, {
        method: 'PUT',
        data: payload,
      });
      if (res.code === 200) {
        message.success('订单修改成功');
        setEditModalVisible(false);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || '修改失败');
        return false;
      }
    } catch (error) {
      message.error('修改失败');
      return false;
    }
  };

  const handleCancelOrder = (record: any) => {
    Modal.confirm({
      title: '确认取消订单',
      content: `确认取消订单 ${record.order_no}？取消后将恢复库存。`,
      okText: '确认取消',
      cancelText: '再想想',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await request('/api/v1/admin/orders/' + record.id + '/cancel', {
            method: 'POST',
          });
          if (res.code === 200) {
            message.success('订单已取消');
            tableRef.current?.reload();
          } else {
            message.error(res.message || '取消失败');
          }
        } catch (error) {
          message.error('取消失败');
        }
      },
    });
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
      const res = await request('/api/v1/admin/orders/' + currentOrder.id + '/direct-refund', {
        method: 'POST',
        data: values,
      });
      if (res.code === 200) {
        message.success('退款成功');
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

  const buildCSV = (rawOrders: any[]) => {
    // 过滤无效数据
    const orders = (rawOrders || []).filter(o => o && typeof o === 'object');
    if (!orders.length) {
      message.warning('暂无有效数据可导出');
      return;
    }

    // 按出行日期分组汇总
    const dateSummary: Record<string, { people: number; pets: number; count: number }> = {};
    let totalPeople = 0;
    let totalPets = 0;
    orders.forEach((o: any) => {
      const date = o.travel_date || '未指定';
      if (!dateSummary[date]) dateSummary[date] = { people: 0, pets: 0, count: 0 };
      dateSummary[date].people += Number(o.participant_count || 0);
      dateSummary[date].pets += Number(o.pet_count || 0);
      dateSummary[date].count += 1;
      totalPeople += Number(o.participant_count || 0);
      totalPets += Number(o.pet_count || 0);
    });

    const headers = ['报名订单号', '用户ID', '路线名称', '出行日期', '联系人', '联系电话', '宠物列表', '出行人数', '宠物数'];
    const rows = orders.map((o: any) => {
      const petsArr = Array.isArray(o.pets) ? o.pets : [];
      const pets = petsArr.map((p: any) => `${p?.name || ''}${p?.breed ? '(' + p.breed + ')' : ''}`).join('；') || '';
      const contact = o.contact && typeof o.contact === 'object' ? o.contact : {};
      return [
        o.order_no || '',
        o.user_id ?? '',
        o.route_name || '',
        o.travel_date || '',
        contact.name || '',
        contact.phone || '',
        pets,
        o.participant_count ?? 0,
        o.pet_count ?? 0,
      ];
    });

    // 按日期添加小计行
    Object.entries(dateSummary).forEach(([date, summary]) => {
      rows.push(['', '', '', date, '', '', `${date} 小计 (${summary.count}笔)`, summary.people, summary.pets]);
    });
    // 总计行
    rows.push(['', '', '', '', '', '', `总计 (${orders.length}笔)`, totalPeople, totalPets]);

    const csvContent = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `订单导出_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    try {
      message.loading('正在导出...', 0);

      // 优先导出选中的订单
      if (selectedRows.length > 0) {
        buildCSV(selectedRows);
        message.destroy();
        message.success(`已导出 ${selectedRows.length} 条选中订单`);
        return;
      }

      const filterValues = formRef.current?.getFieldsValue?.() || {};
      const res = await request('/api/v1/admin/orders', {
        params: {
          page: 1,
          page_size: 5000,
          status: filterValues.status,
          is_free: filterValues.is_free,
          keyword: filterValues.route_name,
          order_no: orderNoFromUrl || undefined,
        },
      });
      message.destroy();

      if (res.code !== 200 || !res.data?.orders?.length) {
        message.warning('暂无数据可导出');
        return;
      }

      buildCSV(res.data.orders);
      message.success(`已导出 ${res.data.orders.length} 条订单`);
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
      title: '会员',
      dataIndex: 'is_member',
      width: 80,
      search: false,
      render: (_: any, record: any) => (
        <Tag color={record.is_member ? 'gold' : 'default'}>
          {record.is_member ? '会员' : '非会员'}
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
      width: 260,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看
        </Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>,
        [10, 20].includes(record.status) && (
          <Button key="cancel" type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancelOrder(record)}>
            取消
          </Button>
        ),
        record.status === 20 && (
          <Button key="verify" type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleVerify(record)}>
            确认完成
          </Button>
        ),
        (!record.is_free && [20, 45].includes(record.status)) && (
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
        formRef={formRef}
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
          const data = res.data?.orders || [];

          // 只有筛选条件变化时才自动全选（搜索/重置），初始加载和翻页时不触发
          const searchKey = JSON.stringify({
            status: params.status,
            route_name: params.route_name,
            is_free: params.is_free,
          });
          if (lastSearchRef.current === '__init__') {
            // 首次加载，记录参数但不选中
            lastSearchRef.current = searchKey;
          } else if (lastSearchRef.current !== searchKey) {
            // 筛选条件变化（用户点击了查询/重置），拉取全部数据并全选
            lastSearchRef.current = searchKey;
            const allRes = await request('/api/v1/admin/orders', {
              params: {
                page: 1,
                page_size: 5000,
                status: params.status,
                keyword: params.route_name,
                is_free: params.is_free,
                order_no: orderNoFromUrl || undefined,
              },
            });
            const allData = allRes.data?.orders || [];
            setSelectedRowKeys(allData.map((o: any) => o.id));
            setSelectedRows(allData);
          }

          return {
            data,
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
        scroll={{ x: 1300 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys);
            // rows 只包含当前页，需和之前已选跨页数据合并
            setSelectedRows(prev => {
              const map = new Map();
              (prev || []).forEach((o: any) => { if (o && o.id != null) map.set(o.id, o); });
              (rows || []).forEach((o: any) => { if (o && o.id != null) map.set(o.id, o); });
              return (keys || []).map((id: any) => map.get(id)).filter(Boolean);
            });
          },
          preserveSelectedRowKeys: true,
        }}
        toolBarRender={() => [
          <Button
            key="selectAll"
            onClick={() => {
              const data = tableRef.current?.pageData?.data || [];
              if (!data.length) return;
              const pageKeys = data.map((o: any) => o.id);
              setSelectedRowKeys(prev => Array.from(new Set([...prev, ...pageKeys])));
              setSelectedRows(prev => {
                const map = new Map();
                prev.forEach((o: any) => map.set(o.id, o));
                data.forEach((o: any) => map.set(o.id, o));
                return Array.from(map.values());
              });
            }}
          >
            全选本页
          </Button>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            {selectedRows.length > 0 ? `导出选中订单 (${selectedRows.length})` : '导出订单'}
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
        title="订单直接退款"
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
        <ProFormDependency name={['refund_type']}>
          {({ refund_type }) => {
            if (refund_type !== 'partial') return null;
            return (
              <ProFormText
                name="refund_amount"
                label="退款金额"
                placeholder="请输入退款金额"
                rules={[
                  { required: true, message: '请输入退款金额' },
                  {
                    validator: (_, value) => {
                      const num = parseFloat(value);
                      if (isNaN(num) || num <= 0) {
                        return Promise.reject('退款金额必须大于0');
                      }
                      if (num > currentOrder?.pay_amount) {
                        return Promise.reject('退款金额不能大于实付金额');
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              />
            );
          }}
        </ProFormDependency>
        <ProFormTextArea
          name="refund_reason"
          label="退款原因"
          placeholder="请输入退款原因"
          rules={[{ required: true, message: '请输入退款原因' }]}
        />
      </ModalForm>

      {/* 编辑订单 */}
      <ModalForm
        title={`编辑订单 - ${currentOrder?.order_no || ''}`}
        open={editModalVisible}
        onOpenChange={setEditModalVisible}
        onFinish={submitEdit}
        formRef={editFormRef}
        width={600}
      >
        <p style={{ color: '#999', marginBottom: 16 }}>订单状态: {statusMap[currentOrder?.status]?.text || '-'}</p>
        <ProFormText name="contact_name" label="联系人姓名" placeholder="请输入联系人姓名" />
        <ProFormText name="contact_phone" label="联系人电话" placeholder="请输入联系人电话" />
        <ProFormText name="contact_id_card" label="联系人身份证" placeholder="请输入联系人身份证" />
        <ProFormText name="travel_date" label="出行日期" placeholder="YYYY-MM-DD" />
        <ProFormTextArea
          name="participants_json"
          label="出行人列表 (JSON)"
          placeholder={`[{"name":"张三","phone":"13800138000","id_card":"","gender":1}]`}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea
          name="pets_json"
          label="宠物列表 (JSON)"
          placeholder={`[{"name":"旺财","breed":"金毛","gender":1,"weight":25}]`}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea name="remark" label="备注" placeholder="订单备注" />
      </ModalForm>
    </PageContainer>
  );
}
