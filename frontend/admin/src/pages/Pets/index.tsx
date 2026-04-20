import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { Button, Tag, Avatar, message, Popconfirm, Space } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

const genderMap: Record<number, string> = {
  0: '母',
  1: '公',
};

const breedTypeMap: Record<number, string> = {
  1: '小型',
  2: '中型',
  3: '大型',
  4: '巨型',
};

export default function PetManage() {
  const tableRef = useRef<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const handleEdit = (record: any) => {
    setEditData(record);
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const res = await request(`/api/v1/admin/pets/${editData.id}`, {
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
      const res = await request(`/api/v1/admin/pets/${id}`, { method: 'DELETE' });
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
      title: '头像',
      dataIndex: 'avatar',
      width: 80,
      search: false,
      render: (url: string, record: any) => (
        <Avatar src={url} size={48} shape="square">
          {record.name?.[0] || '宠'}
        </Avatar>
      ),
    },
    {
      title: '宠物名',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '品种',
      dataIndex: 'breed',
      width: 120,
    },
    {
      title: '体型',
      dataIndex: 'breed_type',
      width: 80,
      search: false,
      render: (type: number) => breedTypeMap[type] || '-',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      search: false,
      render: (gender: number) => genderMap[gender] || '-',
    },
    {
      title: '体重(kg)',
      dataIndex: 'weight',
      width: 100,
      search: false,
      render: (weight: number) => weight ? `${weight}kg` : '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 150,
      search: false,
      render: (tags: string[]) =>
        tags?.map((tag, idx) => <Tag key={idx} size="small">{tag}</Tag>),
    },
    {
      title: '疫苗日期',
      dataIndex: 'vaccine_date',
      width: 120,
      search: false,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
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
          <Popconfirm title="确定删除该宠物档案吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="宠物档案">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/pets', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              user_id: params.user_id,
              keyword: params.name || params.breed,
            },
          });
          return {
            data: res.data?.pets || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1300 }}
      />
      <ModalForm
        title="编辑宠物"
        open={editVisible}
        onOpenChange={setEditVisible}
        initialValues={editData}
        onFinish={handleUpdate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="name" label="宠物名" rules={[{ required: true }]} />
        <ProFormText name="breed" label="品种" rules={[{ required: true }]} />
        <ProFormSelect
          name="breed_type"
          label="体型"
          options={[
            { label: '小型', value: 1 },
            { label: '中型', value: 2 },
            { label: '大型', value: 3 },
            { label: '巨型', value: 4 },
          ]}
        />
        <ProFormSelect
          name="gender"
          label="性别"
          options={[
            { label: '母', value: 0 },
            { label: '公', value: 1 },
          ]}
        />
        <ProFormDigit name="weight" label="体重(kg)" min={0} />
        <ProFormDatePicker name="vaccine_date" label="疫苗日期" />
      </ModalForm>
    </PageContainer>
  );
}
