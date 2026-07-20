import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Input, message, Spin, Collapse, Tag, Space, Typography, Alert, Empty, Select } from 'antd';
import { useState, useEffect, useMemo, useRef } from 'react';
import { request } from '@umijs/max';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface OptionItem {
  order: number;
  label: string;
  score: number;
}

interface Question {
  id: number;
  module_name: string;
  question_order: number;
  title: string;
  options: OptionItem[];
  is_active: number;
}

interface BehaviorTag {
  id: number;
  tag_key: string;
  tag_text: string;
  category: string;
  threshold: number;
  priority: number;
  is_active: number;
}

interface BehaviorRule {
  id: number;
  tag_key: string;
  tag_text: string;
  category: string;
  question_id: number;
  option_order: number | null;
  weight: number;
  is_active: number;
}

export default function DogPersonalityBehaviorConfigs() {
  const [loading, setLoading] = useState(true);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<BehaviorTag[]>([]);
  const [rules, setRules] = useState<BehaviorRule[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [draftCategoryMap, setDraftCategoryMap] = useState<Record<string, 'problem' | 'positive'>>({});
  // tags 的实时引用，避免保存循环中 setTags 后闭包读到旧值导致同文案重复建标签
  const tagsRef = useRef<BehaviorTag[]>([]);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  // 加载题目、标签、规则
  const loadData = async () => {
    setLoading(true);
    try {
      const [qRes, tRes, rRes] = await Promise.all([
        request('/api/v1/admin/dog-personality/questions'),
        request('/api/v1/admin/dog-personality/behavior-tags'),
        request('/api/v1/admin/dog-personality/behavior-rules'),
      ]);
      if (qRes.code === 200) setQuestions(qRes.data?.list || []);
      if (tRes.code === 200) setTags(tRes.data?.list || []);
      if (rRes.code === 200) setRules(rRes.data?.list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 初始化草稿：question_id:option_order -> tag_text / category
  useEffect(() => {
    const map: Record<string, string> = {};
    const catMap: Record<string, 'problem' | 'positive'> = {};
    rules.forEach((rule) => {
      if (rule.option_order !== null && rule.option_order !== undefined) {
        map[`${rule.question_id}:${rule.option_order}`] = rule.tag_text || '';
        if (rule.category === 'problem' || rule.category === 'positive') {
          catMap[`${rule.question_id}:${rule.option_order}`] = rule.category;
        }
      }
    });
    setDraftMap(map);
    setDraftCategoryMap(catMap);
  }, [rules]);

  // 按模块分组题目
  const groupedQuestions = useMemo(() => {
    const map: Record<string, Question[]> = {};
    questions
      .filter((q) => q.is_active === 1)
      .forEach((q) => {
        if (!map[q.module_name]) map[q.module_name] = [];
        map[q.module_name].push(q);
      });
    return map;
  }, [questions]);

  const getDraftText = (questionId: number, optionOrder: number) => {
    return draftMap[`${questionId}:${optionOrder}`] || '';
  };

  const setDraftText = (questionId: number, optionOrder: number, text: string) => {
    setDraftMap((prev) => ({ ...prev, [`${questionId}:${optionOrder}`]: text }));
  };

  // 分类草稿：未配置过规则时按 PRD 7.3.4 默认规则给初值（选项 0/1 正向，2/3 问题）
  const getDraftCategory = (questionId: number, optionOrder: number): 'problem' | 'positive' => {
    return draftCategoryMap[`${questionId}:${optionOrder}`] || (optionOrder <= 1 ? 'positive' : 'problem');
  };

  const setDraftCategory = (questionId: number, optionOrder: number, category: 'problem' | 'positive') => {
    setDraftCategoryMap((prev) => ({ ...prev, [`${questionId}:${optionOrder}`]: category }));
  };

  // 找到或创建标签（按文案匹配，不限分类，复用已有标签且不修改其 category）
  const findOrCreateTag = async (text: string, category: 'problem' | 'positive'): Promise<string | null> => {
    const existing = tagsRef.current.find(
      (t) => t.tag_text === text && t.is_active === 1 && t.threshold === 1
    );
    if (existing) return existing.tag_key;

    const tagKey = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await request('/api/v1/admin/dog-personality/behavior-tags', {
      method: 'POST',
      data: {
        tag_key: tagKey,
        tag_text: text,
        category,
        threshold: 1,
        priority: 0,
        is_active: 1,
      },
    });
    if (res.code !== 200) {
      message.error(res.message || '创建标签失败');
      return null;
    }
    const newTag = res.data;
    // 同步更新 ref 与 state，保证同一次保存中相同文案不会重复建标签
    tagsRef.current = [...tagsRef.current, newTag];
    setTags(tagsRef.current);
    return newTag.tag_key;
  };

  // 保存某道题的配置
  const handleSaveQuestion = async (question: Question) => {
    setSavingQuestionId(question.id);
    try {
      const existingRules = rules.filter((r) => r.question_id === question.id && r.option_order !== null);

      for (const option of question.options || []) {
        const text = getDraftText(question.id, option.order).trim();
        const existingRule = existingRules.find((r) => r.option_order === option.order);

        if (!text) {
          // 文案为空，删除已有规则
          if (existingRule) {
            await request(`/api/v1/admin/dog-personality/behavior-rules/${existingRule.id}`, {
              method: 'DELETE',
            });
          }
        } else {
          const tagKey = await findOrCreateTag(text, getDraftCategory(question.id, option.order));
          if (!tagKey) return;

          if (existingRule) {
            // 更新规则指向新标签
            if (existingRule.tag_key !== tagKey || existingRule.weight !== 1) {
              await request(`/api/v1/admin/dog-personality/behavior-rules/${existingRule.id}`, {
                method: 'PUT',
                data: {
                  tag_key: tagKey,
                  question_id: question.id,
                  option_order: option.order,
                  weight: 1,
                  is_active: 1,
                },
              });
            }
          } else {
            // 创建新规则
            await request('/api/v1/admin/dog-personality/behavior-rules', {
              method: 'POST',
              data: {
                tag_key: tagKey,
                question_id: question.id,
                option_order: option.order,
                weight: 1,
                is_active: 1,
              },
            });
          }
        }
      }

      message.success('保存成功');
      await loadData();
    } finally {
      setSavingQuestionId(null);
    }
  };

  if (loading) {
    return (
      <PageContainer title="行为画像配置">
        <Spin tip="加载中..." style={{ marginTop: 40, display: 'block' }} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="行为画像配置">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="配置说明"
        description="给每道题的每个选项写一句话。用户答题时选了哪个选项，测评报告的行为画像区域就显示对应的话。不填则不显示。分类（正向特质/问题行为）仅在新建标签时生效；若文案与已有标签相同，则直接复用该标签及其原有分类。"
      />

      {Object.keys(groupedQuestions).length === 0 ? (
        <Empty description="暂无启用中的题目" />
      ) : (
        Object.entries(groupedQuestions).map(([moduleName, moduleQuestions]) => (
          <Card key={moduleName} style={{ marginBottom: 24 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <Tag color="blue">{moduleName}</Tag>
            </Title>
            <Collapse ghost>
              {moduleQuestions.map((question) => (
                <Panel
                  header={
                    <Space>
                      <Text strong>题目 {question.question_order || question.id}</Text>
                      <Text>{question.title}</Text>
                    </Space>
                  }
                  key={question.id}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(question.options || []).map((option) => (
                      <div
                        key={option.order}
                        style={{
                          display: 'flex',
                          gap: 16,
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ width: 120, flexShrink: 0 }}>
                          <Tag>选项 {['A', 'B', 'C', 'D'][option.order] ?? option.order}</Tag>
                          <div style={{ marginTop: 4, color: '#666', fontSize: 13 }}>{option.label}</div>
                        </div>
                        <div style={{ width: 110, flexShrink: 0 }}>
                          <Select
                            value={getDraftCategory(question.id, option.order)}
                            onChange={(v) => setDraftCategory(question.id, option.order, v)}
                            options={[
                              { label: '正向特质', value: 'positive' },
                              { label: '问题行为', value: 'problem' },
                            ]}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <Input.TextArea
                            value={getDraftText(question.id, option.order)}
                            onChange={(e) => setDraftText(question.id, option.order, e.target.value)}
                            placeholder="选了这个选项，报告里显示什么？"
                            autoSize={{ minRows: 1, maxRows: 3 }}
                          />
                        </div>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', marginTop: 12 }}>
                      <Button
                        type="primary"
                        loading={savingQuestionId === question.id}
                        onClick={() => handleSaveQuestion(question)}
                      >
                        保存本题配置
                      </Button>
                    </div>
                  </Space>
                </Panel>
              ))}
            </Collapse>
          </Card>
        ))
      )}
    </PageContainer>
  );
}
