import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDatePicker } from '@ant-design/pro-components';
import { Button, Tag, Avatar, message, Popconfirm, Space } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const genderMap: Record<number, string> = {
  0: '未知',
  1: '男',
  2: '女',
};

export default function TravelerManage() {
  const tableRef = useRef<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const handleEdit = (record: any) => {
    setEditData(record);
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const res = await request(`/api/v1/admin/travelers/${editData.id}`, {
        method: 'PUT',
        data: values,
      });
      if (res.code === 200) {
        message.success('更新成功');
        setEditVisible(false);
        tableRef.current?.reload();
        return true;
      }
      message.error(res.message || '更新失败');
      return false;
    } catch (error) {
      message.error('更新失败');
      return false;
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request(`/api/v1/admin/travelers/${id}`, { method: 'DELETE' });
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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 120,
    },
    {
      title: '身份证',
      dataIndex: 'id_card',
      width: 180,
      search: false,
      render: (idCard: string) => idCard ? `${idCard.slice(0, 6)}****${idCard.slice(-4)}` : '-',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      valueEnum: {
        0: { text: '未知' },
        1: { text: '男' },
        2: { text: '女' },
      },
      render: (gender: number) => genderMap[gender] || '-',
    },
    {
      title: '生日',
      dataIndex: 'birthday',
      width: 120,
      search: false,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '紧急联系人',
      width: 200,
      search: false,
      render: (record: any) =>
        record.emergency_name ? (
          <span>{record.emergency_name} ({record.emergency_phone})</span>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '默认',
      dataIndex: 'is_default',
      width: 80,
      search: false,
      render: (isDefault: number) =>
        isDefault === 1 ? <Tag color="blue">默认</Tag> : '-',
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      search: false,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该出行人吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="出行人管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/travelers', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              user_id: params.user_id,
              keyword: params.name || params.phone,
            },
          });
          return {
            data: res.data?.travelers || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1400 }}
      />
      <ModalForm
        title="编辑出行人"
        open={editVisible}
        onOpenChange={setEditVisible}
        initialValues={editData}
        onFinish={handleUpdate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="name" label="姓名" rules={[{ required: true }]} />
        <ProFormText name="phone" label="手机号" rules={[{ required: true }]} />
        <ProFormText name="id_card" label="身份证" />
        <ProFormSelect
          name="gender"
          label="性别"
          options={[
            { label: '未知', value: 0 },
            { label: '男', value: 1 },
            { label: '女', value: 2 },
          ]}
        />
        <ProFormDatePicker name="birthday" label="生日" />
        <ProFormText name="emergency_name" label="紧急联系人姓名" />
        <ProFormText name="emergency_phone" label="紧急联系人电话" />
      </ModalForm>
    </PageContainer>
  );
}
