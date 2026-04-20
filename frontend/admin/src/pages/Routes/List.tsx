import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import { useRef } from 'react';
import { request, history } from '@umijs/max';

export default function RouteList() {
  const tableRef = useRef<any>(null);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 60,
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
      valueEnum: {
        1: { text: '山野厨房' },
        2: { text: '海边度假' },
        3: { text: '森林露营' },
        4: { text: '主题派对' },
        5: { text: '自驾路线' },
      },
    },
    {
      title: '价格',
      dataIndex: 'base_price',
      search: false,
      width: 100,
      render: (text: number) => `¥${text}`,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      search: false,
      width: 80,
    },
    {
      title: '人数',
      search: false,
      width: 120,
      render: (record: any) => `${record.min_participants}-${record.max_participants}人`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: {
        0: { text: '下架', status: 'Error' },
        1: { text: '上架', status: 'Success' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      search: false,
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (text: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => history.push(`/routes/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => history.push(`/routes/edit/${record.id}?tab=schedules`)}
          >
            排期
          </Button>
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
                  // 使用 ProTable 的 reload 方法刷新
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
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/routes', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              keyword: params.name,
              route_type: params.route_type,
              status: params.status,
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
