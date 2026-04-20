import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag, Image, Rate, message, Popconfirm } from 'antd';
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { useRef } from 'react';
import { request } from '@umijs/max';
import dayjs from 'dayjs';

export default function EvaluationManage() {
  const tableRef = useRef<any>(null);

  const handleDelete = async (id: number) => {
    try {
      const res = await request(`/api/v1/admin/evaluations/${id}`, {
        method: 'DELETE',
      });
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
      title: '用户ID',
      dataIndex: 'user_id',
      width: 80,
      search: false,
    },
    {
      title: '评分',
      dataIndex: 'rating',
      width: 120,
      valueEnum: {
        5: { text: '5星' },
        4: { text: '4星' },
        3: { text: '3星' },
        2: { text: '2星' },
        1: { text: '1星' },
      },
      render: (rating: number) => (
        <Rate disabled defaultValue={rating} style={{ fontSize: 14 }} />
      ),
    },
    {
      title: '评价内容',
      dataIndex: 'content',
      ellipsis: true,
      width: 300,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 150,
      search: false,
      render: (tags: string[]) => (
        <>
          {tags?.map((tag, idx) => (
            <Tag key={idx} size="small">{tag}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '图片',
      dataIndex: 'images',
      width: 100,
      search: false,
      render: (images: string[]) =>
        images?.length > 0 ? (
          <Image.PreviewGroup>
            {images.slice(0, 3).map((url, idx) => (
              <Image
                key={idx}
                src={url}
                width={30}
                height={30}
                style={{ marginRight: 4, objectFit: 'cover' }}
                preview={{ src: url }}
              />
            ))}
            {images.length > 3 && <span style={{ color: '#999' }}>+{images.length - 3}</span>}
          </Image.PreviewGroup>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        ),
    },
    {
      title: '匿名',
      dataIndex: 'is_anonymous',
      width: 80,
      search: false,
      render: (isAnonymous: number) =>
        isAnonymous === 1 ? <Tag color="orange">匿名</Tag> : <Tag color="default">实名</Tag>,
    },
    {
      title: '评价时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_: any, record: any) => [
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

  return (
    <PageContainer title="评价管理">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/evaluations', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              rating: params.rating,
            },
          });
          return {
            data: res.data?.evaluations || [],
            success: res.code === 200,
            total: res.data?.total || 0,
          };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
