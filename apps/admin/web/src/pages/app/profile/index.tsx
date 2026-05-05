import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Avatar, Upload, Tabs, Table, Switch, Tag, Space, message, Radio, Typography, List, Alert } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined, HistoryOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { client } from '@/api'
import type { LoginLogItem } from '@/api/types'
import { useTable } from '@ventostack/gui'
import { usePublicConfig } from '@/hooks/usePublicConfig'

const { Title, Text, Paragraph } = Typography

interface UserProfile {
  avatar?: string
  nickname: string
  email: string
  phone: string
  gender: 'unknown' | 'male' | 'female'
}

interface MFASetupData {
  secret: string
  qrCodeUri: string
  recoveryCodes: string[]
}

export default function ProfilePage() {
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [mfaForm] = Form.useForm()
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaSetupData, setMfaSetupData] = useState<MFASetupData | null>(null)
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'verify'>('idle')

  const mfaGloballyEnabled = usePublicConfig(s => s.config.mfaEnabled)
  const mfaForce = usePublicConfig(s => s.config.mfaForce)

  const { loading: logsLoading, data: logsData, total: logsTotal, page: logsPage, pageSize: logsPageSize, refresh, onPageChange } = useTable<LoginLogItem>(
    async (params) => {
      const { error, data } = await client.get('/api/system/login-logs', { query: params })
      if (!error && data) {
        return data
      }
      return { items: [], total: 0 }
    },
    { defaultPageSize: 10 }
  )

  const fetchProfile = async () => {
    const { error, data } = await client.get('/api/system/user/profile')
    if (!error && data) {
      setAvatarUrl(data.avatar || '')
      profileForm.setFieldsValue(data)
    } else {
      message.error('获取用户信息失败')
    }
  }

  const fetchMFAStatus = async () => {
    const { error, data } = await client.get('/api/auth/mfa/status')
    if (!error && data) {
      setMfaEnabled(data.enabled)
    } else {
      message.error('获取MFA状态失败')
    }
  }

  useEffect(() => {
    fetchProfile()
    if (mfaGloballyEnabled) {
      fetchMFAStatus()
    }
    refresh()
  }, [])

  const handleProfileSubmit = async (values: UserProfile) => {
    setLoading(true)
    const { error } = await client.put('/api/system/user/profile', {
      body: {
        nickname: values.nickname,
        email: values.email,
        phone: values.phone,
        gender: values.gender
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    if (!error) {
      message.success('保存成功')
      fetchProfile()
    } else {
      message.error('保存失败')
    }
    setLoading(false)
  }

  const handleAvatarUpload = async (options: any) => {
    const { file } = options
    const formData = new FormData()
    formData.append('file', file)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.post('/api/system/user/profile/avatar', { body: formData } as any)
    if (!result.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAvatarUrl((result as any)?.url || (result as any)?.data?.url)
      message.success('头像上传成功')
      fetchProfile()
    } else {
      message.error('头像上传失败')
    }
  }

  const handlePasswordSubmit = async (values: { oldPassword: string; newPassword: string }) => {
    setLoading(true)
    const { error } = await client.put('/api/system/user/profile/password', {
      body: {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    if (!error) {
      message.success('密码修改成功')
      passwordForm.resetFields()
    } else {
      message.error('密码修改失败')
    }
    setLoading(false)
  }

  const handleMFAEnable = async () => {
    const { error, data } = await client.post('/api/auth/mfa/enable', {})
    if (!error && data) {
      setMfaSetupData(data)
      setMfaStep('setup')
    } else {
      message.error('启用MFA失败')
    }
  }

  const handleMFADisable = async () => {
    const password = mfaForm.getFieldValue('password')
    if (!password) {
      message.warning('请输入密码确认')
      return
    }
    setLoading(true)
    const { error } = await client.post('/api/auth/mfa/disable', { body: { code: password } })
    if (!error) {
      message.success('MFA已禁用')
      setMfaEnabled(false)
      mfaForm.resetFields()
    } else {
      message.error('禁用MFA失败')
    }
    setLoading(false)
  }

  const handleMFAVerify = async (values: { code: string }) => {
    setLoading(true)
    const { error } = await client.post('/api/auth/mfa/verify', {
      body: {
        code: values.code,
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    if (!error) {
      message.success('MFA启用成功')
      setMfaEnabled(true)
      setMfaStep('idle')
      setMfaSetupData(null)
      mfaForm.resetFields()
    } else {
      message.error('验证码错误')
    }
    setLoading(false)
  }

  const copyRecoveryCode = (code: string) => {
    navigator.clipboard.writeText(code)
    message.success('已复制到剪贴板')
  }

  const basicInfoTab = (
    <Card>
      <Form
        form={profileForm}
        layout="vertical"
        onFinish={handleProfileSubmit}
        initialValues={{ gender: 'unknown' }}
      >
        <Form.Item label="头像">
          <Space direction="vertical" size="middle">
            <Avatar size={100} src={avatarUrl} icon={<UserOutlined />} />
            <Upload
              customRequest={handleAvatarUpload}
              accept="image/*"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>上传头像</Button>
            </Upload>
          </Space>
        </Form.Item>
        <Form.Item
          label="昵称"
          name="nickname"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入昵称" />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '邮箱格式不正确' }
          ]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item
          label="手机号"
          name="phone"
          rules={[{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]}
        >
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item
          label="性别"
          name="gender"
          rules={[{ required: true, message: '请选择性别' }]}
        >
          <Radio.Group>
            <Radio value="unknown">未知</Radio>
            <Radio value="male">男</Radio>
            <Radio value="female">女</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )

  const passwordTab = (
    <Card>
      <Form
        form={passwordForm}
        layout="vertical"
        onFinish={handlePasswordSubmit}
      >
        <Form.Item
          label="原密码"
          name="oldPassword"
          rules={[{ required: true, message: '请输入原密码' }]}
        >
          <Input.Password placeholder="请输入原密码" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少8位' }
          ]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>
        <Form.Item
          label="确认密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              }
            })
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            修改密码
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )

  const mfaTab = (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {mfaForce && !mfaEnabled && mfaStep === 'idle' && (
          <Alert
            message="安全要求"
            description="管理员已要求所有用户启用多因素认证，请尽快完成设置"
            type="warning"
            showIcon
          />
        )}

        <div>
          <Text strong>多因素认证状态</Text>
          <br />
          <Switch
            checked={mfaEnabled}
            onChange={(checked) => {
              if (checked) {
                handleMFAEnable()
              } else {
                setMfaStep('idle')
                mfaForm.resetFields()
              }
            }}
            checkedChildren="已启用"
            unCheckedChildren="未启用"
          />
        </div>

        {mfaStep === 'setup' && mfaSetupData && (
          <>
            <div>
              <Title level={5}>步骤1: 扫描二维码</Title>
              <Paragraph>
                请使用认证器应用（如 Google Authenticator、Authy）扫描以下二维码或手动输入密钥：
              </Paragraph>
              <Text code copyable={{ text: mfaSetupData.secret }}>
                {mfaSetupData.secret}
              </Text>
              <pre style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
                <code>{mfaSetupData.qrCodeUri}</code>
              </pre>
            </div>

            <div>
              <Title level={5}>步骤2: 保存恢复码</Title>
              <Paragraph type="warning">
                请妥善保存以下恢复码，当您无法使用认证器时可用于恢复账户：
              </Paragraph>
              <List
                dataSource={mfaSetupData.recoveryCodes}
                renderItem={(code) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        icon={<CopyOutlined />}
                        onClick={() => copyRecoveryCode(code)}
                      >
                        复制
                      </Button>
                    ]}
                  >
                    <Text code>{code}</Text>
                  </List.Item>
                )}
              />
            </div>

            <div>
              <Title level={5}>步骤3: 输入验证码</Title>
              <Form form={mfaForm} layout="vertical" onFinish={handleMFAVerify}>
                <Form.Item
                  label="验证码"
                  name="code"
                  rules={[{ required: true, message: '请输入6位验证码' }]}
                >
                  <Input.OTP length={6} />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      验证并启用
                    </Button>
                    <Button onClick={() => setMfaStep('idle')}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </>
        )}

        {!mfaEnabled && mfaStep === 'idle' && (
          <Alert message="未启用MFA" description="启用多因素认证可以提高账户安全性" type="info" showIcon />
        )}

        {mfaEnabled && mfaStep === 'idle' && (
          <>
            <Alert message="已启用MFA" description="您的账户已受到多因素认证保护" type="success" showIcon />
            <Form form={mfaForm} layout="vertical">
              <Form.Item
                label="输入验证码以禁用MFA"
                name="password"
                rules={[{ required: true, message: '请输入验证码确认' }]}
              >
                <Input placeholder="请输入认证器验证码" />
              </Form.Item>
              <Form.Item>
                <Button danger onClick={handleMFADisable} loading={loading}>
                  禁用MFA
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Space>
    </Card>
  )

  const loginHistoryColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip'
    },
    {
      title: '浏览器',
      dataIndex: 'browser',
      key: 'browser'
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: '登录时间',
      dataIndex: 'loginAt',
      key: 'loginAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }
  ]

  const loginHistoryTab = (
    <Card>
      <Table
        loading={logsLoading}
        columns={loginHistoryColumns}
        dataSource={logsData}
        rowKey="id"
        pagination={{
          current: logsPage,
          pageSize: logsPageSize,
          total: logsTotal,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: onPageChange
        }}
      />
    </Card>
  )

  const tabItems = [
    {
      key: 'basic',
      label: (<span><UserOutlined />基本信息</span>),
      children: basicInfoTab
    },
    {
      key: 'password',
      label: (<span><LockOutlined />修改密码</span>),
      children: passwordTab
    },
    ...(mfaGloballyEnabled ? [{
      key: 'mfa',
      label: (<span><SafetyOutlined />MFA设置</span>),
      children: mfaTab
    }] : []),
    {
      key: 'history',
      label: (<span><HistoryOutlined />登录记录</span>),
      children: loginHistoryTab
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>个人中心</Title>
      <Tabs defaultActiveKey="basic" items={tabItems} />
    </div>
  )
}
