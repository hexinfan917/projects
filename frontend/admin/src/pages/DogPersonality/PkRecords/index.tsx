import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Tag, Avatar } from 'antd';
import { useRef } from 'react';
import { request } from '@umijs/max';

const TYPE_CODE_COLORS: Record<string, string> = {
  ESFP: '#f59e0b', ESTP: '#f97316', ENFP: '#22c55e', ENTP: '#14b8a6',
  ESFJ: '#8b5cf6', ESTJ: '#6366f1', ENFJ: '#ec4899', ENTJ: '#0ea5e9',
  ISFP: '#f43f5e', ISTP: '#78716c', INFP: '#a855f7', INTP: '#3b82f6',
  ISFJ: '#10b981', ISTJ: '#64748b', INFJ: '#d946ef', INTJ: '#4f46e5',
};

export default function DogPersonalityPkRecords() {
  const tableRef = useRef<any>(null);

  const renderPet = (record: any, side: 'a' | 'b') => {
    const prefix = side === 'a' ? 'a' : 'b';
    const name = record[`${prefix}_pet_name`] || '未知宠物';
    const avatar = record[`${prefix}_pet_avatar`];
    const code = record[`${prefix}_type_code`];
    const title = record[`${prefix}_title`] || '-';
    const userId = record[`${prefix}_user_id`];
    const score = record[`${prefix}_total_score`];
    const color = TYPE_CODE_COLORS[code] || '#1677ff';
    const isWinner = record.winner_side === side;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={avatar} size={48} shape="square" style={{ borderRadius: 8 }}>
          {name?.[0]}
        </Avatar>
        <div>
          <div style={{ fontWeight: 500 }}>
            {name}
            {isWinner && <Tag color="gold" style={{ marginLeft: 8 }}>胜</Tag>}
            {record.winner_side === 'tie' && <Tag style={{ marginLeft: 8 }}>平</Tag>}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            用户ID: {userId} · 总分: {score}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Tag color={color}>{code}</Tag>
            <span style={{ fontSize: 12, color: '#888' }}>{title}</span>
          </div>
        </div>
      </div>
    );
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '记录用户ID', dataIndex: 'user_id', width: 100 },
    {
      title: 'A 方',
      dataIndex: 'a',
      search: false,
      width: 260,
      render: (_: any, record: any) => renderPet(record, 'a'),
    },
    {
      title: 'B 方',
      dataIndex: 'b',
      search: false,
      width: 260,
      render: (_: any, record: any) => renderPet(record, 'b'),
    },
    {
      title: '结果',
      dataIndex: 'winner_side',
      width: 90,
      search: false,
      valueEnum: {
        a: { text: 'A 胜', status: 'Success' },
        b: { text: 'B 胜', status: 'Processing' },
        tie: { text: '平局', status: 'Default' },
      },
    },
    {
      title: 'A 结果ID',
      dataIndex: 'a_result_id',
      width: 90,
      search: false,
    },
    {
      title: 'B 结果ID',
      dataIndex: 'b_result_id',
      width: 90,
      search: false,
    },
    { title: 'PK 时间', dataIndex: 'created_at', width: 180, search: false },
  ];

  return (
    <PageContainer title="PK 记录">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/dog-personality/pk/records', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              user_id: params.user_id,
              a_result_id: params.a_result_id,
              b_result_id: params.b_result_id,
            },
          });
          if (res.code !== 200) {
            return { data: [], success: false, total: 0 };
          }
          return {
            data: res.data.list,
            success: true,
            total: res.data.total,
          };
        }}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          pageSize: 20,
        }}
      />
    </PageContainer>
  );
}
