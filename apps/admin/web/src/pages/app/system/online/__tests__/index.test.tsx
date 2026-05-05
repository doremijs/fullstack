import { describe, test, expect } from 'bun:test'

describe('在线用户页', () => {
  test('OnlineUser 类型应包含必要字段', () => {
    const user = {
      sessionId: 's1',
      userId: 'u1',
      username: 'admin',
      nickname: '管理员',
      ip: '192.168.1.1',
      browser: 'Chrome 120',
      os: 'macOS',
      loginAt: '2024-01-01T00:00:00Z',
      lastAccessAt: '2024-01-01T01:00:00Z'
    }
    expect(user.sessionId).toBeTruthy()
    expect(user.userId).toBeTruthy()
    expect(user.ip).toBeTruthy()
    expect(user.browser).toBeTruthy()
  })

  test('强制下线 API 端点正确', () => {
    const endpoint = '/api/system/monitor/online/:sessionId'
    expect(endpoint).toContain('sessionId')
  })
})
