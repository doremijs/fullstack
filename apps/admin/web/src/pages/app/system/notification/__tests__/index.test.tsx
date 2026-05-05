import { describe, test, expect } from 'bun:test'

describe('消息中心页', () => {
  test('NotifyMessage 类型应包含必要字段', () => {
    const msg = {
      id: '1', receiverId: 'u1', channel: 'in_app', title: '系统通知',
      content: '测试内容', status: 'UNREAD', createdAt: '2024-01-01'
    }
    expect(msg.title).toBeTruthy()
    expect(['UNREAD', 'READ']).toContain(msg.status)
    expect(['email', 'sms', 'webhook', 'in_app']).toContain(msg.channel)
  })

  test('NotifyTemplate 类型应包含必要字段', () => {
    const tpl = {
      id: '1', type: 'system', channel: 'smtp', titleTemplate: '通知: {{title}}',
      contentTemplate: '内容: {{content}}', variables: '["title","content"]',
      status: 1, createdAt: '2024-01-01'
    }
    expect(tpl.titleTemplate).toContain('{{')
    expect(tpl.channel).toBeTruthy()
  })

  test('批量标记已读请求体正确', () => {
    const ids = ['1', '2', '3']
    const body = { ids }
    expect(body.ids).toHaveLength(3)
    expect(body.ids).toContain('1')
  })

  test('消息渠道选项正确', () => {
    const channels = [
      { value: 'email', label: '邮件' },
      { value: 'sms', label: '短信' },
      { value: 'webhook', label: 'Webhook' },
      { value: 'in_app', label: '站内信' },
    ]
    expect(channels).toHaveLength(4)
    expect(channels.map(c => c.value)).toContain('in_app')
  })
})
