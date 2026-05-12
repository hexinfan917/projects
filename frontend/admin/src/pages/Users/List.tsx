import { PageContainer, ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { Button, Tag, Avatar, message, Popconfirm, Descriptions, Drawer, Table, Empty, Space } from 'antd';
import { EditOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
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

function calcAge(birthDate?: string) {
  if (!birthDate) return '-';
  const birth = dayjs(birthDate);
  const now = dayjs();
  let age = now.year() - birth.year();
  if (now.month() < birth.month() || (now.month() === birth.month() && now.date() < birth.date())) age--;
  return age > 0 ? `${age}岁` : '-';
}

export default function UserList() {
  const tableRef = useRef<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // 宠物子表弹窗状态
  const [petDetailVisible, setPetDetailVisible] = useState(false);
  const [petDetailData, setPetDetailData] = useState<any>(null);
  const [petEditVisible, setPetEditVisible] = useState(false);
  const [petEditData, setPetEditData] = useState<any>(null);
  const [petLoadingMap, setPetLoadingMap] = useState<Record<number, boolean>>({});
  const [petDataMap, setPetDataMap] = useState<Record<number, any[]>>({});

  const handleViewDetail = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/users/' + id);
      if (res.code === 200) {
        setDetailData(res.data);
        setDetailVisible(true);
      } else {
        message.error(res.message || '获取详情失败');
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleEdit = (record: any) => {
    setEditData(record);
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const res = await request('/api/v1/admin/users/' + editData.id, {
        method: 'PUT',
        data: values,
      });
      if (res.code === 200) {
        message.success('更新成功');
        setEditVisible(false);
        tableRef.current?.reload();
        return true;
      } else {
        message.error(res.message || '更新失败');
        return false;
      }
    } catch (error) {
      message.error('更新失败');
      return false;
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/users/' + id, { method: 'DELETE' });
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

  const loadPets = async (userId: number) => {
    setPetLoadingMap((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await request('/api/v1/admin/pets', {
        params: { user_id: userId, page: 1, page_size: 100 },
      });
      setPetDataMap((prev) => ({
        ...prev,
        [userId]: res.code === 200 ? res.data?.pets || [] : [],
      }));
    } catch {
      setPetDataMap((prev) => ({ ...prev, [userId]: [] }));
    } finally {
      setPetLoadingMap((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handlePetView = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/pets/' + id);
      if (res.code === 200) {
        setPetDetailData(res.data);
        setPetDetailVisible(true);
      } else {
        message.error('获取详情失败');
      }
    } catch {
      message.error('获取详情失败');
    }
  };

  const handlePetEdit = (record: any) => {
    setPetEditData(record);
    setPetEditVisible(true);
  };

  const handlePetUpdate = async (values: any) => {
    try {
      const payload = { ...values };
      const res = await request('/api/v1/admin/pets/' + petEditData.id, {
        method: 'PUT',
        data: payload,
      });
      if (res.code === 200) {
        message.success('更新成功');
        setPetEditVisible(false);
        // 刷新当前展开用户的宠物数据
        if (petEditData?.user_id) {
          loadPets(petEditData.user_id);
        }
        return true;
      }
      message.error(res.message || '更新失败');
      return false;
    } catch {
      message.error('更新失败');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: '头像',
      dataIndex: 'avatar',
      width: 80,
      search: false,
      render: (url: string) => <Avatar src={url} size={40}>用户</Avatar>,
    },
    { title: '昵称', dataIndex: 'nickname', width: 150, ellipsis: true },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      search: false,
      render: (gender: number) => (gender === 1 ? '男' : gender === 2 ? '女' : '未知'),
    },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '真实姓名', dataIndex: 'real_name', width: 120, search: false },
    { title: '身份证', dataIndex: 'id_card', width: 180, search: false },
    {
      title: '会员等级',
      dataIndex: 'member_level',
      width: 100,
      valueEnum: { 0: { text: '新手上路' }, 1: { text: '爱好者' }, 2: { text: '资深' }, 3: { text: '大使' } },
      render: (level: number) => {
        const map: any = { 0: { text: '新手上路', color: 'default' }, 1: { text: '爱好者', color: 'green' }, 2: { text: '资深', color: 'blue' }, 3: { text: '大使', color: 'purple' } };
        return <Tag color={map[level]?.color}>{map[level]?.text}</Tag>;
      },
    },
    { title: '积分', dataIndex: 'member_points', width: 100, search: false },
    {
      title: '宠物数量',
      dataIndex: 'pet_count',
      width: 100,
      search: false,
      render: (count: number) => <Tag color={count > 0 ? 'green' : 'default'}>{count || 0}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: { 0: { text: '禁用' }, 1: { text: '正常' } },
      render: (status: number) => <Tag color={status === 1 ? 'success' : 'error'}>{status === 1 ? '正常' : '禁用'}</Tag>,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>查看</Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>,
        <Popconfirm key="delete" title="确认删除" description="删除后用户将无法登录，是否继续？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  const petColumns = [
    { title: '宠物ID', dataIndex: 'id', width: 80 },
    { title: '宠物名称', dataIndex: 'name', width: 120 },
    { title: '品种', dataIndex: 'breed', width: 120 },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      render: (gender: number) => genderMap[gender] || '-',
    },
    {
      title: '年龄',
      dataIndex: 'birth_date',
      width: 80,
      render: (birthDate: string) => calcAge(birthDate),
    },
    {
      title: '疫苗',
      dataIndex: 'vaccine_date',
      width: 100,
      render: (date: string) => (date ? <Tag color="success">已接种</Tag> : <Tag>未接种</Tag>),
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePetView(record.id)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handlePetEdit(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const levelOptions = [
    { label: '新手上路', value: 0 },
    { label: '爱好者', value: 1 },
    { label: '资深', value: 2 },
    { label: '大使', value: 3 },
  ];

  const statusOptions = [
    { label: '禁用', value: 0 },
    { label: '正常', value: 1 },
  ];

  return (
    <PageContainer title="用户列表">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/users', {
            params: { page: params.current, page_size: params.pageSize, keyword: params.nickname || params.phone, status: params.status },
          });
          return { data: res.data?.users || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        expandable={{
          onExpand: (expanded, record) => {
            if (expanded) {
              loadPets(record.id);
            }
          },
          expandedRowRender: (record) => {
            const pets = petDataMap[record.id] || [];
            const loading = petLoadingMap[record.id];
            return (
              <div style={{ margin: '12px 0 12px 40px', background: '#fafafa', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 12 }}>宠物信息</div>
                {pets.length === 0 && !loading ? (
                  <Empty description="暂无宠物" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table
                    columns={petColumns}
                    dataSource={pets}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                    bordered
                  />
                )}
              </div>
            );
          },
        }}
      />

      <Drawer title="用户详情" width={600} open={detailVisible} onClose={() => setDetailVisible(false)}>
        {detailData && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="头像">{detailData.avatar ? <Avatar src={detailData.avatar} size={64} /> : '无'}</Descriptions.Item>
            <Descriptions.Item label="ID">{detailData.id}</Descriptions.Item>
            <Descriptions.Item label="OpenID">{detailData.openid}</Descriptions.Item>
            <Descriptions.Item label="昵称">{detailData.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{detailData.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="真实姓名">{detailData.real_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="身份证">{detailData.id_card || '-'}</Descriptions.Item>
            <Descriptions.Item label="性别">{detailData.gender === 1 ? '男' : detailData.gender === 2 ? '女' : '未知'}</Descriptions.Item>
            <Descriptions.Item label="生日">{detailData.birthday || '-'}</Descriptions.Item>
            <Descriptions.Item label="城市">{detailData.city || '-'}</Descriptions.Item>
            <Descriptions.Item label="会员等级">{['新手上路', '爱好者', '资深', '大使'][detailData.member_level || 0]}</Descriptions.Item>
            <Descriptions.Item label="积分">{detailData.member_points || 0}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={detailData.status === 1 ? 'success' : 'error'}>{detailData.status === 1 ? '正常' : '禁用'}</Tag></Descriptions.Item>
            <Descriptions.Item label="注册时间">{detailData.created_at ? dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
            <Descriptions.Item label="宠物数量">
              <Tag color={(detailData.pet_count || 0) > 0 ? 'green' : 'default'}>{detailData.pet_count || 0}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <ModalForm title="编辑用户" open={editVisible} onOpenChange={setEditVisible} onFinish={handleUpdate} initialValues={editData}>
        <ProFormText name="nickname" label="昵称" placeholder="请输入昵称" />
        <ProFormText name="phone" label="手机号" placeholder="请输入手机号" rules={[{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误' }]} />
        <ProFormText name="real_name" label="真实姓名" placeholder="请输入真实姓名" />
        <ProFormText name="id_card" label="身份证" placeholder="请输入身份证号" />
        <ProFormSelect name="member_level" label="会员等级" options={levelOptions} />
        <ProFormDigit name="member_points" label="积分" min={0} />
        <ProFormSelect name="status" label="状态" options={statusOptions} />
      </ModalForm>

      <Drawer title="宠物详情" width={600} open={petDetailVisible} onClose={() => setPetDetailVisible(false)}>
        {petDetailData && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="宠物头像">
              {petDetailData.avatar ? <Avatar src={petDetailData.avatar} size={64} shape="square">{petDetailData.name?.[0]}</Avatar> : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="ID">{petDetailData.id}</Descriptions.Item>
            <Descriptions.Item label="宠物名">{petDetailData.name}</Descriptions.Item>
            <Descriptions.Item label="品种">{petDetailData.breed}</Descriptions.Item>
            <Descriptions.Item label="体型">{breedTypeMap[petDetailData.breed_type] || '-'}</Descriptions.Item>
            <Descriptions.Item label="性别">{genderMap[petDetailData.gender] || '-'}</Descriptions.Item>
            <Descriptions.Item label="体重">{petDetailData.weight ? `${petDetailData.weight}kg` : '-'}</Descriptions.Item>
            <Descriptions.Item label="年龄">{calcAge(petDetailData.birth_date)}</Descriptions.Item>
            <Descriptions.Item label="疫苗">
              {petDetailData.vaccine_date ? dayjs(petDetailData.vaccine_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="是否默认">{petDetailData.is_default ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={petDetailData.status === 1 ? 'success' : 'error'}>{petDetailData.status === 1 ? '正常' : '已删除'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{petDetailData.created_at ? dayjs(petDetailData.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <ModalForm
        title="编辑宠物"
        open={petEditVisible}
        onOpenChange={setPetEditVisible}
        onFinish={handlePetUpdate}
        initialValues={{
          ...petEditData,
          birth_date: petEditData?.birth_date ? dayjs(petEditData.birth_date).format('YYYY-MM-DD') : undefined,
          vaccine_date: petEditData?.vaccine_date ? dayjs(petEditData.vaccine_date).format('YYYY-MM-DD') : undefined,
        }}
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
        <ProFormSelect name="gender" label="性别" options={[{ label: '母', value: 0 }, { label: '公', value: 1 }]} />
        <ProFormDigit name="weight" label="体重(kg)" min={0} max={200} />
        <ProFormDatePicker name="vaccine_date" label="疫苗日期" />
        <ProFormSelect name="is_default" label="是否默认" options={[{ label: '否', value: 0 }, { label: '是', value: 1 }]} />
      </ModalForm>
    </PageContainer>
  );
}
