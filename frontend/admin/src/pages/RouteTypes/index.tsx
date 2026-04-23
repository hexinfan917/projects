import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Space, Popconfirm, message, Modal, Form, Input, InputNumber, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';

interface RouteTypeItem {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  sort_order: number;
  status: number;
}

export default function RouteTypes() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新建类型');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: '类型名称',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 100,
      search: false,
    },
    {
      title: '主题色',
      dataIndex: 'color',
      width: 120,
      search: false,
      render: (color: string) => (
        <Space>
          {color && (
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                backgroundColor: color,
                borderRadius: 4,
                border: '1px solid #ddd',
              }}
            />
          )}
          <span>{color || '-'}</span>
        </Space>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueEnum: {
        0: { text: '禁用', status: 'Error' },
        1: { text: '启用', status: 'Success' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_: any, record: RouteTypeItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleEdit = (record: RouteTypeItem) => {
    setEditingId(record.id);
    setModalTitle('编辑类型');
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await request(`/api/v1/admin/route-types/${id}`, {
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
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        const res = await request(`/api/v1/admin/route-types/${editingId}`, {
          method: 'PUT',
          data: values,
        });
        if (res.code === 200) {
          message.success('更新成功');
        } else {
          message.error(res.message || '更新失败');
          return;
        }
      } else {
        const res = await request('/api/v1/admin/route-types', {
          method: 'POST',
          data: values,
        });
        if (res.code === 200) {
          message.success('创建成功');
        } else {
          message.error(res.message || '创建失败');
          return;
        }
      }
      setModalVisible(false);
      form.resetFields();
      setEditingId(null);
      tableRef.current?.reload();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '保存失败';
      message.error(msg);
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setEditingId(null);
  };

  return (
    <PageContainer
      title="路线类型管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null);
            setModalTitle('新建类型');
            form.resetFields();
            setModalVisible(true);
          }}
        >
          新建类型
        </Button>
      }
    >
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/route-types', {
            params: {
              status: params.status,
            },
          });
          return {
            data: res.data || [],
            success: res.code === 200,
            total: (res.data || []).length,
          };
        }}
        rowKey="id"
        search={false}
        pagination={false}
      />

      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true, message: '请输入类型名称' }]}
          >
            <Input placeholder="如：山野厨房" />
          </Form.Item>
          <Form.Item name="icon" label="图标标识">
            <Input placeholder="如：mountain" />
          </Form.Item>
          <Form.Item name="color" label="主题色">
            <Input placeholder="如：#96C93D" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Radio.Group>
              <Radio.Button value={1}>启用</Radio.Button>
              <Radio.Button value={0}>禁用</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
