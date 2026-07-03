import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, message, InputNumber, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, ToTopOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request, history } from '@umijs/max';

type StatusTab = 'all' | '1' | '0';

export default function RouteList() {
  const tableRef = useRef<any>(null);
  const [editingSortId, setEditingSortId] = useState<number | null>(null);
  const [editingSortValue, setEditingSortValue] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState<StatusTab>('all');
  const [routeTypeEnum, setRouteTypeEnum] = useState<Record<string, { text: string }>>({
    1: { text: '山野厨房' },
    2: { text: '海边度假' },
    3: { text: '森林露营' },
    4: { text: '主题派对' },
    5: { text: '自驾路线' },
  });

  useEffect(() => {
    request('/api/v1/admin/route-types').then((res: any) => {
      if (res.code === 200 && Array.isArray(res.data)) {
        const enumMap: Record<string, { text: string }> = {};
        res.data.forEach((item: any) => {
          if (item && item.id != null) {
            enumMap[String(item.id)] = { text: item.name || '' };
          }
        });
        setRouteTypeEnum(enumMap);
      }
    }).catch(() => {});
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 60,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      search: false,
      width: 80,
      tooltip: '数字越小越靠前，数字相同时新创建的在前面',
      render: (_: any, record: any) => {
        if (editingSortId === record.id) {
          return (
            <InputNumber
              autoFocus
              value={editingSortValue}
              min={0}
              style={{ width: 70 }}
              onChange={(val) => setEditingSortValue(val)}
              onBlur={() => {
                if (editingSortValue !== null && editingSortValue !== record.sort_order) {
                  request(`/api/v1/admin/routes/${record.id}`, {
                    method: 'PUT',
                    data: { sort_order: editingSortValue },
                  }).then((res: any) => {
                    if (res.code === 200) {
                      message.success('排序更新成功');
                      tableRef.current?.reload();
                    } else {
                      message.error(res.message || '更新失败');
                    }
                  }).catch(() => message.error('更新失败'));
                }
                setEditingSortId(null);
                setEditingSortValue(null);
              }}
              onPressEnter={() => {
                if (editingSortValue !== null && editingSortValue !== record.sort_order) {
                  request(`/api/v1/admin/routes/${record.id}`, {
                    method: 'PUT',
                    data: { sort_order: editingSortValue },
                  }).then((res: any) => {
                    if (res.code === 200) {
                      message.success('排序更新成功');
                      tableRef.current?.reload();
                    } else {
                      message.error(res.message || '更新失败');
                    }
                  }).catch(() => message.error('更新失败'));
                }
                setEditingSortId(null);
                setEditingSortValue(null);
              }}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => {
              setEditingSortId(record.id);
              setEditingSortValue(record.sort_order ?? 0);
            }}
          >
            {record.sort_order ?? 0}
          </span>
        );
      },
    },
    {
      title: '路线编号',
      dataIndex: 'route_no',
      width: 150,
    },
    {
      title: '封面',
      dataIndex: 'cover_image',
      search: false,
      width: 80,
      render: (url: string) => url ? (
        <img src={url} alt="封面" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }} />
      ) : '-',
    },
    {
      title: '路线名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'route_type',
      width: 100,
      valueEnum: routeTypeEnum,
    },
    {
      title: '起价',
      dataIndex: 'schedule_price',
      search: false,
      width: 100,
      render: (text: number, record: any) => {
        if (record.is_free === 1) return <Tag color="green">免费</Tag>;
        return text ? `¥${text}` : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      width: 80,
      valueEnum: {
        0: { text: '下架', status: 'Error' },
        1: { text: '上架', status: 'Success' },
      },
    },
    {
      title: '会员专享',
      dataIndex: 'is_member_only',
      search: false,
      width: 90,
      render: (v: number) => v === 1 ? <Tag color="gold">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      search: false,
      width: 170,
      render: (text: string) => text ? text.substring(0, 19).replace('T', ' ') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (text: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => history.push(`/routes/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title={record.status === 1 ? '确认下架' : '确认上架'}
            description={record.status === 1 ? '下架后用户将无法查看该路线，是否继续？' : '上架后用户将可以查看并报名该路线，是否继续？'}
            onConfirm={async () => {
              try {
                const res = await request(`/api/v1/admin/routes/${record.id}`, {
                  method: 'PUT',
                  data: { status: record.status === 1 ? 0 : 1 },
                });
                if (res.code === 200) {
                  message.success(record.status === 1 ? '下架成功' : '上架成功');
                  tableRef.current?.reload();
                } else {
                  message.error(res.message || '操作失败');
                }
              } catch (error: any) {
                const msg = error?.response?.data?.message || error?.message || '操作失败';
                message.error(msg);
              }
            }}
          >
            <Button
              type="link"
              size="small"
              icon={record.status === 1 ? <VerticalAlignBottomOutlined /> : <ToTopOutlined />}
              danger={record.status === 1}
            >
              {record.status === 1 ? '下架' : '上架'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            onConfirm={async () => {
              try {
                const res = await request(`/api/v1/admin/routes/${record.id}`, {
                  method: 'DELETE',
                });
                if (res.code === 200) {
                  message.success('删除成功');
                  tableRef.current?.reload();
                } else {
                  message.error(res.message || '删除失败');
                }
              } catch (error: any) {
                const msg = error?.response?.data?.message || error?.message || '删除失败';
                message.error(msg);
              }
            }}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleStatusChange = (key: StatusTab) => {
    setActiveStatus(key);
    // 切换 Tab 后通过 params 变化触发 ProTable 重新请求
    tableRef.current?.reloadAndRest?.();
  };

  const getStatusParam = () => {
    if (activeStatus === 'all') return undefined;
    return activeStatus;
  };

  return (
    <PageContainer
      title="路线管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => history.push('/routes/edit')}
        >
          新建路线
        </Button>
      }
    >
      <Tabs
        activeKey={activeStatus}
        onChange={(key) => handleStatusChange(key as StatusTab)}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'all', label: '全部' },
          { key: '1', label: '上架中' },
          { key: '0', label: '已下架' },
        ]}
      />
      <ProTable
        columns={columns}
        actionRef={tableRef}
        params={{ activeStatus }}
        request={async (params) => {
          const res = await request('/api/v1/admin/routes', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.name,
              route_no: params.route_no,
              route_type: params.route_type,
              status: getStatusParam(),
            },
          });
          return {
            data: res.data?.routes || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
        scroll={{ x: 1200 }}
      />
    </PageContainer>
  );
}
