import { PageContainer, ProTable, ModalForm, ProFormText, ProFormDigit, ProFormSelect, ProFormRadio, ProFormList } from '@ant-design/pro-components';
import { Button, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import { request } from '@umijs/max';

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '禁用', color: 'default' },
  1: { text: '启用', color: 'success' },
};

export default function DogPersonalityQuestions() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [moduleOptions, setModuleOptions] = useState<any[]>([]);
  const [moduleMap, setModuleMap] = useState<Record<string, any>>({});
  const formRef = useRef<any>(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const res = await request('/api/v1/admin/dog-personality/modules');
      const list = res.data?.list || [];
      setModuleOptions(list.map((m: any) => ({ label: m.name, value: m.name })));
      setModuleMap(Object.fromEntries(list.map((m: any) => [m.name, m])));
    } catch (error) {
      message.error('加载模块列表失败');
    }
  };

  const openModal = (record?: any) => {
    setEditData(record || null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue(record || { is_active: 1, options: [{}, {}, {}, {}] });
    }, 0);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request('/api/v1/admin/dog-personality/questions/' + id, { method: 'DELETE' });
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
      // 计算本题满分
      values.max_score = Math.max(...(values.options || []).map((o: any) => o.score || 0));

      const url = editData ? '/api/v1/admin/dog-personality/questions/' + editData.id : '/api/v1/admin/dog-personality/questions';
      const method = editData ? 'PUT' : 'POST';
      const res = await request(url, { method, data: values });
      if (res.code === 200) {
        message.success(editData ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditData(null);
        formRef.current?.resetFields();
        tableRef.current?.reload();
        return true;
      }
      message.error(res.message || (editData ? '更新失败' : '创建失败'));
      return false;
    } catch (error) {
      message.error(editData ? '更新失败' : '创建失败');
      return false;
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false, sorter: (a: any, b: any) => a.id - b.id, defaultSortOrder: 'ascend' },
    { title: '题号', dataIndex: 'question_order', width: 70, search: false, sorter: (a: any, b: any) => a.question_order - b.question_order },
    { title: '模块', dataIndex: 'module_name', width: 180 },
    {
      title: '所属四维维度',
      dataIndex: 'dimension',
      width: 120,
      valueType: 'select',
      valueEnum: {
        'E/I': { text: 'E/I 社交倾向' },
        'S/N': { text: 'S/N 感官敏感' },
        'F/T': { text: 'F/T 情感需求' },
        'P/J': { text: 'P/J 生活规律' },
      },
      search: false,
    },
    { title: '题干', dataIndex: 'title', width: 260, ellipsis: true },
    { title: '满分', dataIndex: 'max_score', width: 80, search: false },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueEnum: { 0: { text: '禁用' }, 1: { text: '启用' } },
      render: (_: any, record: any) => (
        <Tag color={statusMap[record.is_active]?.color}>{statusMap[record.is_active]?.text}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
          编辑
        </Button>,
        <Popconfirm key="delete" title="确认删除" description="删除后不可恢复，是否继续？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="题目管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新建题目
          </Button>,
        ]}
        request={async () => {
          const res = await request('/api/v1/admin/dog-personality/questions');
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.list?.length || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 800 }}
      />

      <ModalForm
        title={editData ? '编辑题目' : '新建题目'}
        open={modalVisible}
        onOpenChange={setModalVisible}
        onFinish={handleSubmit}
        formRef={formRef}
        width={800}
      >
        <ProFormSelect
          name="module_name"
          label="模块"
          rules={[{ required: true }]}
          options={moduleOptions}
          fieldProps={{
            onChange: (value: string) => {
              const dimension = moduleMap[value]?.bind_dimension;
              formRef.current?.setFieldsValue({ dimension });
            },
          }}
        />
        <ProFormText name="dimension" label="所属四维维度" disabled />
        <ProFormDigit name="question_order" label="题号" rules={[{ required: true }]} min={1} />
        <ProFormText name="title" label="题干" rules={[{ required: true }]} />
        <ProFormText name="image_url" label="配图URL" />
        <ProFormRadio.Group
          name="is_active"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />

        <div style={{ marginBottom: 8, fontWeight: 500 }}>选项配置（按表现从优到差）</div>
        <ProFormList
          name="options"
          min={4}
          max={4}
          creatorButtonProps={false}
          initialValue={[{}, {}, {}, {}]}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <ProFormDigit name="order" label="顺序" rules={[{ required: true }]} min={0} max={3} width="xs" />
            <ProFormText name="label" label="选项文案" rules={[{ required: true }]} style={{ flex: 1 }} />
            <ProFormDigit name="score" label="分值" rules={[{ required: true }]} min={0} width="xs" />
            <ProFormSelect
              name="polarity"
              label="极性"
              rules={[{ required: true, message: '请选择极性' }]}
              options={[
                { label: '+ 正极（E/S/F/P）', value: '+' },
                { label: '- 负极（I/N/T/J）', value: '-' },
              ]}
              width="sm"
              allowClear={false}
            />
          </div>
        </ProFormList>
      </ModalForm>
    </PageContainer>
  );
}
