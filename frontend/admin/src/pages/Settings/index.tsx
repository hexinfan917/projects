import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Input, Button, message, Tabs, Switch, Space, Divider } from 'antd';
import { useState, useEffect } from 'react';
import { request } from '@umijs/max';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 获取设置
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await request('/api/v1/admin/settings');
      if (res.code === 200 && res.data) {
        // 将设置数据转换为表单值
        const formValues: any = {};
        Object.keys(res.data).forEach((key) => {
          formValues[key] = res.data[key].value;
        });
        form.setFieldsValue(formValues);
      }
    } catch (error) {
      message.error('获取设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // 保存设置
  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const res = await request('/api/v1/admin/settings', {
        method: 'PUT',
        data: values,
      });
      if (res.code === 200) {
        message.success('设置已保存');
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="系统设置">
      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            site_name: '尾巴旅行',
            site_description: '带宠出行，探索世界',
          }}
        >
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基础设置" key="basic">
              <Form.Item
                name="site_name"
                label="网站名称"
                rules={[{ required: true, message: '请输入网站名称' }]}
              >
                <Input placeholder="请输入网站名称" />
              </Form.Item>

              <Form.Item name="site_logo" label="网站Logo">
                <Input placeholder="Logo URL" />
              </Form.Item>

              <Form.Item name="site_description" label="网站描述">
                <Input.TextArea rows={3} placeholder="请输入网站描述" />
              </Form.Item>

              <Form.Item name="contact_phone" label="客服电话">
                <Input placeholder="请输入客服电话" />
              </Form.Item>

              <Form.Item name="contact_email" label="客服邮箱">
                <Input placeholder="请输入客服邮箱" />
              </Form.Item>
            </TabPane>

            <TabPane tab="微信支付" key="wechat_pay">
              <Form.Item name="wechat_mch_id" label="商户号(MchID)">
                <Input placeholder="请输入微信商户号" />
              </Form.Item>

              <Form.Item name="wechat_appid" label="AppID">
                <Input placeholder="请输入微信公众号/小程序AppID" />
              </Form.Item>

              <Form.Item name="wechat_api_key" label="API密钥">
                <Input.Password placeholder="请输入API密钥" />
              </Form.Item>

              <Form.Item name="wechat_notify_url" label="支付回调URL">
                <Input placeholder="https://your-domain.com/api/v1/pay/notify" />
              </Form.Item>
            </TabPane>

            <TabPane tab="小程序配置" key="miniprogram">
              <Form.Item name="mp_appid" label="小程序AppID">
                <Input placeholder="请输入小程序AppID" />
              </Form.Item>

              <Form.Item name="mp_secret" label="小程序AppSecret">
                <Input.Password placeholder="请输入小程序AppSecret" />
              </Form.Item>
            </TabPane>

            <TabPane tab="短信服务" key="sms">
              <Form.Item name="sms_provider" label="短信服务商">
                <Input placeholder="如: aliyun, tencent" />
              </Form.Item>

              <Form.Item name="sms_access_key" label="AccessKey">
                <Input placeholder="请输入AccessKey" />
              </Form.Item>

              <Form.Item name="sms_secret_key" label="SecretKey">
                <Input.Password placeholder="请输入SecretKey" />
              </Form.Item>

              <Form.Item name="sms_sign_name" label="短信签名">
                <Input placeholder="请输入短信签名" />
              </Form.Item>
            </TabPane>

            <TabPane tab="存储配置" key="storage">
              <Form.Item name="storage_type" label="存储类型">
                <Input placeholder="local, oss, cos, s3" />
              </Form.Item>

              <Form.Item name="storage_domain" label="访问域名">
                <Input placeholder="https://cdn.your-domain.com" />
              </Form.Item>

              <Form.Item name="storage_bucket" label="Bucket">
                <Input placeholder="请输入Bucket名称" />
              </Form.Item>

              <Form.Item name="storage_region" label="Region">
                <Input placeholder="如: oss-cn-beijing" />
              </Form.Item>
            </TabPane>
          </Tabs>

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                保存设置
              </Button>
              <Button icon={<ReloadOutlined />} onClick={fetchSettings}>
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  );
}
