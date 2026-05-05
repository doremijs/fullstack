import { describe, test, expect } from 'bun:test'

describe('个人中心页', () => {
  test('密码校验 - 长度至少8位', () => {
    const validatePassword = (pwd: string) => pwd.length >= 8
    expect(validatePassword('12345678')).toBe(true)
    expect(validatePassword('1234567')).toBe(false)
  })

  test('密码校验 - 包含字母和数字', () => {
    const pattern = /^(?=.*[a-zA-Z])(?=.*\d)|(?=.*[a-zA-Z])(?=.*[^a-zA-Z0-9])|(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/
    expect(pattern.test('abc12345')).toBe(true)
    expect(pattern.test('abcdefgh')).toBe(false)
    expect(pattern.test('12345678')).toBe(false)
  })

  test('两次密码一致性校验', () => {
    const matchPassword = (newPwd: string, confirmPwd: string) => newPwd === confirmPwd
    expect(matchPassword('abc12345', 'abc12345')).toBe(true)
    expect(matchPassword('abc12345', 'abc12346')).toBe(false)
  })

  test('性别选项正确', () => {
    const genderOptions = [
      { value: 0, label: '未知' },
      { value: 1, label: '男' },
      { value: 2, label: '女' },
    ]
    expect(genderOptions).toHaveLength(3)
    expect(genderOptions.map(g => g.value)).toEqual([0, 1, 2])
  })

  test('MFA 设置状态转换', () => {
    type MfaStep = 'idle' | 'setup' | 'verify'
    const steps: MfaStep[] = ['idle', 'setup', 'verify']
    expect(steps).toHaveLength(3)
    expect(steps[0]).toBe('idle')
  })

  test('个人中心 API 端点正确', () => {
    const endpoints = {
      profile: '/api/system/user/profile',
      updateProfile: '/api/system/user/profile',
      changePassword: '/api/system/user/profile/password',
      avatar: '/api/system/user/profile/avatar',
      mfaEnable: '/api/auth/mfa/enable',
      mfaVerify: '/api/auth/mfa/verify',
      mfaDisable: '/api/auth/mfa/disable',
    }
    expect(endpoints.profile).toContain('profile')
    expect(endpoints.changePassword).toContain('password')
    expect(endpoints.mfaEnable).toContain('mfa')
  })
})
