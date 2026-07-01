import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, message, Space, Drawer, Descriptions, Select, Popconfirm } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '待审核', color: 'default' },
  1: { text: '已通过', color: 'success' },
  2: { text: '已拒绝', color: 'error' },
  3: { text: '已完成领养', color: 'processing' },
};

export default function AdoptionApplicationsManage() {
  const tableRef = useRef<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [current, setCurrent] = useState<any>(null);

  const openDetail = async (record: any) => {
    try {
      const res = await request('/api/v1/admin/adoption/applications/' + record.id);
      if (res.code === 200) {
        setCurrent(res.data);
        setDrawerVisible(true);
      } else {
        message.error(res.message || '加载失败');
      }
    } catch (error) {
      message.error('加载失败');
    }
  };

  const updateStatus = async (id: number, status: number, adminRemark?: string) => {
    try {
      const res = await request('/api/v1/admin/adoption/applications/' + id + '/status', {
        method: 'PUT',
        data: { status, admin_remark: adminRemark },
      });
      if (res.code === 200) {
        message.success('操作成功');
        tableRef.current?.reload();
        if (current && current.id === id) {
          setCurrent({ ...current, status, status_name: statusMap[status]?.text, admin_remark: adminRemark || current.admin_remark });
        }
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '狗狗',
      dataIndex: ['dog', 'name'],
      width: 120,
      render: (_: any, record: any) => record.dog?.name || '-',
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 100,
      search: false,
      render: (v: number) => v || '-',
    },
    {
      title: '申请人',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      render: (v: string) => v || '-',
    },
    {
      title: '年龄',
      dataIndex: 'age',
      width: 80,
      render: (v: string) => v || '-',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 140,
      search: false,
    },
    {
      title: '所在城市',
      dataIndex: 'city',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      valueEnum: {
        0: { text: '待审核' },
        1: { text: '已通过' },
        2: { text: '已拒绝' },
        3: { text: '已完成领养' },
      },
      render: (_: any, record: any) => {
        const config = statusMap[record.status] || { text: '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
          {/* 待审核：显示全部操作 */}
          {record.status === 0 && (
            <>
              <Button type="link" size="small" onClick={() => updateStatus(record.id, 1)}>
                通过
              </Button>
              <Button type="link" size="small" style={{ color: '#1890ff' }} onClick={() => updateStatus(record.id, 3)}>
                完成领养
              </Button>
              <Popconfirm
                title="确认拒绝"
                description="拒绝后不可恢复，是否继续？"
                onConfirm={() => updateStatus(record.id, 2)}
              >
                <Button type="link" danger size="small">
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
          {/* 已通过：可完成领养或拒绝 */}
          {record.status === 1 && (
            <>
              <Button type="link" size="small" style={{ color: '#1890ff' }} onClick={() => updateStatus(record.id, 3)}>
                完成领养
              </Button>
              <Popconfirm
                title="确认拒绝"
                description="拒绝后不可恢复，是否继续？"
                onConfirm={() => updateStatus(record.id, 2)}
              >
                <Button type="link" danger size="small">
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
          {/* 已拒绝和已完成：只显示详情，无操作 */}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="领养申请">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/adoption/applications', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
              keyword: params.name,
            },
          });
          return { data: res.data?.applications || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1100 }}
      />
      <Drawer
        title="申请详情"
        width={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {current && (
          <>
            <Descriptions title="申请人信息" bordered column={2}>
              <Descriptions.Item label="用户ID">{current.user_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="姓名">{current.name}</Descriptions.Item>
              <Descriptions.Item label="性别">{current.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="年龄">{current.age || '-'}</Descriptions.Item>
              <Descriptions.Item label="电话">{current.phone}</Descriptions.Item>
              <Descriptions.Item label="所在城市">{current.city || '-'}</Descriptions.Item>
              <Descriptions.Item label="住房情况">{current.housing || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {current.created_at ? dayjs(current.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="养宠经验" span={2}>
                {current.experience || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="领养理由" span={2}>
                {current.reason || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Descriptions title="狗狗信息" bordered column={2} style={{ marginTop: 24 }}>
              <Descriptions.Item label="狗狗ID">{current.dog?.id || '-'}</Descriptions.Item>
              <Descriptions.Item label="名字">{current.dog?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="品种">{current.dog?.breed || '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 12, fontWeight: 'bold' }}>当前状态：
                <Tag color={statusMap[current.status]?.color || 'default'}>
                  {statusMap[current.status]?.text || '未知'}
                </Tag>
              </div>
              <Space>
                {/* 待审核：显示全部操作 */}
                {current.status === 0 && (
                  <>
                    <Button type="primary" onClick={() => updateStatus(current.id, 1)}>
                      通过
                    </Button>
                    <Button onClick={() => updateStatus(current.id, 3)}>
                      完成领养
                    </Button>
                    <Button danger onClick={() => updateStatus(current.id, 2)}>
                      拒绝
                    </Button>
                  </>
                )}
                {/* 已通过：可完成领养或拒绝 */}
                {current.status === 1 && (
                  <>
                    <Button type="primary" onClick={() => updateStatus(current.id, 3)}>
                      完成领养
                    </Button>
                    <Button danger onClick={() => updateStatus(current.id, 2)}>
                      拒绝
                    </Button>
                  </>
                )}
                {/* 已拒绝和已完成：无操作按钮 */}
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </PageContainer>
  );
}
