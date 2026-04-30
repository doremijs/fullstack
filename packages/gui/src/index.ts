/**
 * @ventostack/gui — GUI 层公共模块
 *
 * 提供可复用的 React 组件、Hooks、工具函数与样式，
 * 供 admin/web 及未来其他前端应用共享。
 */

// Utils
export { cn } from './utils/cn'
export { getAccessToken, setAccessToken, clearToken } from './utils/token'
export { fetchConfig, getConfig } from './utils/fetchConfig'
// createApiClient — depends on @doremijs/o2t, exported from sub-path if needed
// export { createApiClient, setOnUnauthorized } from './utils/createApiClient'

// Hooks
export { useTheme } from './hooks/useTheme'
export type { ThemeMode } from './hooks/useTheme'
export { useUrlQuery } from './hooks/useUrlQuery'
export { useTable } from './hooks/useTable'
export type { UseTableOptions, UseTableReturn, PaginatedParams, PaginatedData } from './hooks/useTable'

// Components
export { default as GlobalMessage, msg } from './ui/GlobalMessage'
export { default as GlobalHistory, globalNavigate } from './ui/GlobalHistory'

// Types
export type { WithChildren, WithClassName, WithStyle, ID } from './types'
