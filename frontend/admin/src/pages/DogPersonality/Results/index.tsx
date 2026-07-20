import { PageContainer, ProTable, ModalForm } from '@ant-design/pro-components';
import { Button, Tag, message, Descriptions, Progress } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { request } from '@umijs/max';

const DIMENSION_META: Record<string, { label: string; left: string; right: string; color: string }> = {
  EI: { label: '社交倾向', left: 'E 外向', right: 'I 内向', color: '#1677ff' },
  SN: { label: '感官敏感', left: 'S 实感', right: 'N 直觉', color: '#52c41a' },
  FT: { label: '情感需求', left: 'F 感性', right: 'T 理性', color: '#faad14' },
  PJ: { label: '生活规律', left: 'P 随性', right: 'J 计划', color: '#eb2f96' },
};

const DIMENSION_ORDER = ['EI', 'SN', 'FT', 'PJ'];

export default function DogPersonalityResults() {
  const tableRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const openDetail = async (record: any) => {
    try {
      const res = await request('/api/v1/admin/dog-personality/results/' + record.id);
      if (res.code === 200) {
        setDetail(res.data);
        setModalVisible(true);
      } else {
        message.error(res.message || '获取详情失败');
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const renderDimensionTags = (dimension_scores?: Record<string, any>) => {
    if (!dimension_scores) return '-';
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DIMENSION_ORDER.map((dim) => {
          const ds = dimension_scores[dim];
          if (!ds) return null;
          return (
            <Tag key={dim} color={DIMENSION_META[dim]?.color || 'default'}>
              {dim}: {ds.score}/{ds.max_score}
            </Tag>
          );
        })}
      </div>
    );
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    { title: '用户ID', dataIndex: 'user_id', width: 80 },
    { title: '宠物ID', dataIndex: 'pet_id', width: 80 },
    {
      title: '犬格编码',
      dataIndex: 'type_code',
      width: 100,
      render: (code: string) => <Tag color="purple">{code}</Tag>,
    },
    {
      title: '四维得分',
      dataIndex: 'dimension_scores',
      width: 260,
      search: false,
      render: (_: any, record: any) => renderDimensionTags(record.dimension_scores),
    },
    {
      title: '可信度',
      dataIndex: 'reliability_score',
      width: 100,
      search: false,
      render: (score: number) => (
        <Tag color={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'}>{score}</Tag>
      ),
    },
    { title: '测评时间', dataIndex: 'created_at', width: 180, search: false },
    {
      title: '测评时间',
      dataIndex: 'time_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: {
        transform: (value: any) => ({
          start_time: value?.[0] ? `${value[0]} 00:00:00` : undefined,
          end_time: value?.[1] ? `${value[1]} 23:59:59` : undefined,
        }),
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_: any, record: any) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
          详情
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer title="测评记录">
      <ProTable
        columns={columns}
        actionRef={tableRef}
        request={async (params) => {
          const res = await request('/api/v1/admin/dog-personality/results', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              user_id: params.user_id,
              pet_id: params.pet_id,
              type_code: params.type_code,
              start_time: params.start_time,
              end_time: params.end_time,
            },
          });
          return { data: res.data?.list || [], success: res.code === 200, total: res.data?.total || 0 };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 900 }}
      />

      <ModalForm
        title="测评报告详情"
        open={modalVisible}
        onOpenChange={setModalVisible}
        submitter={false}
        width={760}
      >
        {detail && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="记录ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{detail.user_id}</Descriptions.Item>
              <Descriptions.Item label="宠物">{detail.pet_name || '-'} (ID: {detail.pet_id})</Descriptions.Item>
              <Descriptions.Item label="犬格编码">
                <Tag color="purple">{detail.type_code}</Tag>
                {detail.title ? ` · ${detail.title}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="可信度">{detail.reliability_score}</Descriptions.Item>
              <Descriptions.Item label="测评时间">{detail.created_at}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16, fontWeight: 500 }}>四维得分</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DIMENSION_ORDER.map((dim) => {
                const ds = detail.dimension_scores?.[dim];
                if (!ds) return null;
                const percent = Math.max(0, Math.min(100, (ds.rate || 0) * 100));
                const meta = DIMENSION_META[dim];
                return (
                  <div key={dim}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{meta.label}（{dim}）</span>
                      <span>{meta.left} {ds.score}/{ds.max_score} {meta.right}</span>
                    </div>
                    <Progress percent={Math.round(percent)} strokeColor={meta.color} showInfo={false} />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, fontWeight: 500 }}>行为画像</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(detail.report_data?.key_behaviors || []).length > 0 ? (
                (detail.report_data?.key_behaviors || []).map((item: string, idx: number) => (
                  <Tag key={idx} color="blue" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '6px 12px', height: 'auto' }}>
                    {item}
                  </Tag>
                ))
              ) : (
                <Tag color="default">暂无行为画像</Tag>
              )}
            </div>

            <div style={{ marginTop: 16, fontWeight: 500 }}>报告内容</div>
            <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
              <Descriptions.Item label="性格解读">
                <div style={{ whiteSpace: 'pre-line' }}>{detail.report_data?.description || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="饲养 & 训练指南">
                <div style={{ whiteSpace: 'pre-line' }}>{detail.report_data?.guide || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="业务推荐">
                <div style={{ whiteSpace: 'pre-line' }}>{detail.report_data?.recommendation || '-'}</div>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </ModalForm>
    </PageContainer>
  );
}
