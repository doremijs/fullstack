# Aeron — Bun 全栈后端框架

> 成为 Bun 生态中最完整、最工程化的全栈后端框架。

---

## 1. Project Overview

Aeron 是基于 **Bun 运行时** 构建的后端开发框架，采用 Monorepo 结构（Bun workspaces）。

核心目标：
- 极致利用 Bun 原生能力（Bun.sql、Bun.redis、Bun.serve）
- 100% 类型安全，零运行时类型反射开销
- 无 class、无 DI 容器、显式依赖注入
- 工程化优先：可测试、可观测、可生成 OpenAPI

---

## 2. Architecture

### 分层模型

```
┌─────────────────────────────────────┐
│  CLI / OpenAPI / AI / Testing       │  ← 用户接口层
├─────────────────────────────────────┤
│  Auth / Cache / Events / Observability │  ← 能力层
├─────────────────────────────────────┤
│  Database (ORM + Bun.sql)           │  ← 数据层
├─────────────────────────────────────┤
│  Core (HTTP Router + Context + Middleware) │  ← 核心层
└─────────────────────────────────────┘
```

### 模块边界

| Package | 职责 | 外部依赖 |
|---------|------|----------|
| `core` | HTTP 路由、Context、中间件、错误处理 | 无 |
| `database` | ORM、迁移、连接池 | `core` |
| `cache` | Redis 封装、缓存策略 | `core` |
| `auth` | JWT、Session、权限校验 | `core`, `database` |
| `events` | 事件总线、队列、调度 | `core` |
| `observability` | 日志、指标、链路追踪 | `core` |
| `openapi` | OpenAPI 文档生成 | `core` |
| `ai` | AI Tool 调用、Worker 隔离 | `core` |
| `cli` | 脚手架、代码生成、迁移命令 | 所有包 |
| `testing` | 测试工具、Mock、Fixture | `core` |

---

## 3. Tech Stack

### Bun 原生能力（优先使用）

| 能力 | API | 替代方案 |
|------|-----|----------|
| HTTP Server | `Bun.serve()` | 不使用 Express/Fastify |
| SQL | `Bun.sql` + 标签模板 | 不使用 pg/mysql 驱动 |
| Redis | `Bun.redis` | 不使用 ioredis |
| 加密 | `Bun.password`, `crypto.subtle` | 不使用 bcrypt/jsonwebtoken |
| 测试 | `bun:test` | 不使用 Jest/Vitest |
| 打包 | `Bun.build()` | 不使用 esbuild/rollup |
| 进程 | `Bun.spawn()`, `Bun.worker()` | 不使用 child_process |

### 自研组件

| 组件 | 原因 |
|------|------|
| ORM | 基于 `Bun.sql` 标签模板，类型推导零开销 |
| JWT | 基于 Web Crypto API，Bun 原生支持，无 Node 兼容包袱 |
| Validator | 参考 Valibot，树摇友好，类型推导精确 |
| Router | 基于 `Bun.serve()` 原生路由扩展 |

---

## 4. Code Conventions

### 无 Class

全部使用函数和工厂函数。状态通过闭包或显式对象传递。

```typescript
// 正确
function createUserService(deps: { db: Database; cache: Cache }) {
  return {
    async findById(id: string) { /* ... */ }
  };
}

// 错误
class UserService {
  constructor(private db: Database, private cache: Cache) {}
}
```

### 无 DI 容器

依赖显式传递，禁止字符串定位。

```typescript
// 正确
const userService = createUserService({ db, cache });

// 错误
const userService = container.get("UserService");
const userService = container.get(UserService);
```

### TypeScript Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 优先使用 Bun 内置 API

遇到需求时先查 Bun 文档，再考虑第三方包。

### SQL 调用规范

标签模板字面量是唯一正确调用方式。

```typescript
// 正确
const users = await sql`SELECT * FROM users WHERE id = ${id}`;

// 错误
const users = await sql.query("SELECT * FROM users WHERE id = $1", [id]);
const users = await db.select("users").where({ id });
```

---

## 5. Directory Structure

```
/Users/erguotou/workspace/doremi/fullstack/
├── packages/
│   ├── core/              # HTTP 核心
│   ├── database/          # ORM + 迁移
│   ├── cache/             # Redis 封装
│   ├── auth/              # JWT + Session
│   ├── events/            # 事件总线
│   ├── observability/     # 日志 + 指标
│   ├── openapi/           # 文档生成
│   ├── ai/                # AI Tool 调用
│   ├── cli/               # 命令行工具
│   └── testing/           # 测试工具
├── apps/
│   └── example/           # 示例应用
├── docs/                  # 文档
├── bun.lock               # Bun 锁文件
├── package.json           # Workspace 根配置
└── tsconfig.json          # 根 TypeScript 配置
```

---

## 6. Key Design Decisions

### 为什么不用 DI 容器

- 运行时反射破坏类型安全
- 字符串定位导致重构困难
- 隐式依赖增加认知负担
- 显式传递更利于测试和 Tree Shaking

### 为什么不用 Class

- 构造函数副作用难以控制
- `this` 绑定问题
- 继承滥用风险
- 工厂函数更灵活，支持闭包和局部状态

### 为什么自研 JWT

- Bun 原生支持 Web Crypto API
- 无需兼容 Node crypto 的历史包袱
- 完全控制算法白名单和密钥管理
- 包体积零增长

### 为什么自研 ORM

- `Bun.sql` 标签模板已提供类型安全查询
- 传统 ORM 的模型层是 class，与框架原则冲突
- 只需要轻量封装：连接池、迁移、结果映射
- 避免 Prisma/Drizzle 的生成步骤和运行时依赖

### 为什么参考 Valibot 自研验证器

- Valibot 的树摇友好架构适合 Bun
- 可完全控制错误信息和国际化
- 与框架类型系统深度集成
- 无 Zod 的递归类型问题

---

## 7. Security Guidelines

### JWT

- **算法白名单**：仅允许 `HS256`, `HS384`, `HS512`, `ES256`, `EdDSA`
- **密钥最小 256-bit**：使用 `crypto.getRandomValues` 生成
- **恒定时间比较**：使用 `crypto.subtle.timingSafeEqual`

### HMAC 签名

- 所有 HMAC 签名必须包含 `timestamp` + `nonce`
- 服务端校验 timestamp 偏差不超过 5 分钟
- nonce 存入 Redis 防重放，TTL 10 分钟

### 错误处理

- 错误上报前脱敏：移除密码、token、密钥、PII
- 生产环境不返回堆栈信息

### AI Tool 安全

- 所有 AI Tool 参数必须经过 Schema 校验
- AI Worker 运行在隔离的 `Bun.worker()` 中
- Worker 超时强制终止，防止资源耗尽

---

## 8. Testing

### 测试框架

- 使用 `bun:test`，不引入 Jest/Vitest
- 测试文件命名：`*.test.ts`

### 测试规范

- 单元测试：每个公共函数必须有测试
- 集成测试：每个 HTTP 端点必须有测试
- 数据库测试：使用 `@testing` 包的 `createTestDatabase`，每次测试后清理
- Mock 规范：优先 mock 外部服务，不 mock 框架内部模块

### 测试命令

```bash
# 运行所有测试
bun test

# 运行单个包测试
bun test packages/core

# 带覆盖率
bun test --coverage
```

---

## 9. Frontend

TODO: 前端部分待补充。

---

## 10. Common Commands

```bash
# 安装依赖
bun install

# 开发模式（热重载）
bun run dev

# 构建
bun run build

# 运行测试
bun test

# 运行 CLI
bun run cli

# 数据库迁移
bun run migrate

# 生成 OpenAPI 文档
bun run openapi:generate

# 类型检查
bun run typecheck

# 代码格式化
bun run format

# 代码检查
bun run lint
```
