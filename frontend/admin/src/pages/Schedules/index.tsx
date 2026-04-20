import { PageContainer, ProTable, ModalForm, ProFormDatePicker, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm, Card, Calendar, Badge, Radio, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, TableOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '已关闭', color: 'default' },
  1: { text: '可售', color: 'success' },
  2: { text: '已满', color: 'warning' },
  3: { text: '已结束', color: 'default' },
};

export default function ScheduleManage() {
  const tableRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [calendarData, setCalendarData] = useState<any[]>([]);

  // 获取路线列表
  useEffect(() => {
    request('/api/v1/admin/routes', { params: { page: 1, page_size: 100 } }).then((res) => {
      if (res.code === 200) {
        setRoutes(res.data?.routes || []);
      }
    });
  }, []);

  // 获取日历数据
  const fetchCalendarData = async () => {
    if (!selectedRoute) return;
    const res = await request(`/api/v1/admin/routes/${selectedRoute}/schedules`);
    if (res.code === 200) {
      setCalendarData(res.data || []);
    }
  };

  useEffect(() => {
    if (viewMode === 'calendar' && selectedRoute) {
      fetchCalendarData();
    }
  }, [viewMode, selectedRoute]);

  const handleEdit = (record: any) => {
    setEditData(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request(`/api/v1/admin/schedules/${id}`, { method: 'DELETE' });
      if (res.code === 200) {
        message.success('删除成功');
        tableRef.current?.reload();
      } else {
        message.error(res.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editData 
        ? `/api/v1/admin/schedules/${editData.id}` 
        : `/api/v1/admin/routes/${values.route_id}/schedules`;
      const method = editData ? 'PUT' : 'POST';
      
      const res = await request(url, {
        method,
        data: values,
      });
      
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || (editData ? '更新失败' : '创建失败'));
        return false;
      }
    } catch (error) {
      message.error(editData ? '更新失败' : '创建失败');
      return false;
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
      title: '路线',
      dataIndex: 'route_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '日期',
      dataIndex: 'schedule_date',
      width: 120,
      sorter: true,
    },
    {
      title: '时间',
      width: 120,
      search: false,
      render: (record: any) => `${record.start_time || '--'} ~ ${record.end_time || '--'}`,
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      search: false,
      render: (price: number) => price ? `¥${price}` : '-',
    },
    {
      title: '库存',
      width: 100,
      search: false,
      render: (record: any) => `${record.stock}/${record.stock + record.sold}`,
    },
    {
      title: '已售',
      dataIndex: 'sold',
      width: 80,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        0: { text: '已关闭' },
        1: { text: '可售' },
        2: { text: '已满' },
        3: { text: '已结束' },
      },
      render: (status: number) => (
        <Tag color={statusMap[status]?.color || 'default'}>
          {statusMap[status]?.text || '未知'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_: any, record: any) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除"
          description="删除后无法恢复，是否继续？"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const getCalendarCellData = (date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    return calendarData.filter((item: any) => item.schedule_date === dateStr);
  };

  const calendarCellRender = (date: dayjs.Dayjs) => {
    const listData = getCalendarCellData(date);
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map((item: any) => (
          <li key={item.id}>
            <Badge
              status={item.status === 1 ? 'success' : item.status === 2 ? 'warning' : 'default'}
              text={`${item.route_name} (${item.stock}剩)`}
            />
          </li>
        ))}
      </ul>
    );
  };

  const routeOptions = routes.map((r: any) => ({ label: r.name, value: r.id }));

  return (
    <PageContainer
      title="排期管理"
      extra={
        <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
          <Radio.Button value="table"><TableOutlined /> 列表</Radio.Button>
          <Radio.Button value="calendar"><CalendarOutlined /> 日历</Radio.Button>
        </Radio.Group>
      }
    >
      {viewMode === 'table' ? (
        <ProTable
          columns={columns}
          actionRef={tableRef}
          request={async (params) => {
            const res = await request('/api/v1/admin/schedules', {
              params: {
                page: params.current,
                page_size: params.pageSize,
                route_id: params.route_id,
              },
            });
            return {
              data: res.data?.schedules || [],
              success: res.code === 200,
              total: res.data?.total || 0,
            };
          }}
          rowKey="id"
          search={{
            labelWidth: 'auto',
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          toolBarRender={() => [
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditData(null);
                setModalVisible(true);
              }}
            >
              新建排期
            </Button>,
          ]}
        />
      ) : (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 8 }}>选择路线:</span>
            <ProFormSelect
              style={{ width: 300, display: 'inline-block' }}
              options={routeOptions}
              placeholder="请选择路线"
              onChange={(value) => setSelectedRoute(value as number)}
            />
          </div>
          {selectedRoute ? (
            <Calendar cellRender={calendarCellRender} />
          ) : (
            <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
              请选择路线查看排期日历
            </div>
          )}
        </Card>
      )}

      <ModalForm
        title={editData ? '编辑排期' : '新建排期'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        initialValues={editData}
      >
        {!editData && (
          <ProFormSelect
            name="route_id"
            label="路线"
            options={routeOptions}
            rules={[{ required: true, message: '请选择路线' }]}
          />
        )}
        <ProFormDatePicker
          name="schedule_date"
          label="活动日期"
          rules={[{ required: true, message: '请选择日期' }]}
          disabledDate={(current: any) => current && current < dayjs().startOf('day')}
        />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="start_time" label="开始时间" placeholder="09:00" />
          </Col>
          <Col span={12}>
            <ProFormText name="end_time" label="结束时间" placeholder="18:00" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDigit name="price" label="当日价格" min={0} placeholder="不填使用路线默认价格" />
          </Col>
          <Col span={12}>
            <ProFormDigit name="stock" label="库存数量" min={1} rules={[{ required: true }]} />
          </Col>
        </Row>
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '已关闭', value: 0 },
            { label: '可售', value: 1 },
            { label: '已满', value: 2 },
            { label: '已结束', value: 3 },
          ]}
          initialValue={1}
        />
      </ModalForm>
    </PageContainer>
  );
}
