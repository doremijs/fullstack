---
title: 限流
description: 使用 rateLimit 中间件保护应用免受暴力攻击和过载
---

`rateLimit` 是一个中间件工厂函数，基于固定窗口计数器算法实现，支持按 IP、用户 ID 或自定义键进行限流。

## 基本用法

```typescript
import { rateLimit, createMemoryRateLimitStore } from "@ventostack/core";

app.use(
  rateLimit({
    windowMs: 60_000,  // 时间窗口：1 分钟
    max: 100,          // 窗口内最大请求数
    message: "Too many requests",
    store: createMemoryRateLimitStore(),
  }),
);
```

限流中间件会在响应头中自动注入以下信息：

- `X-RateLimit-Limit` — 窗口内最大请求数
- `X-RateLimit-Remaining` — 剩余可用请求数
- `X-RateLimit-Reset` — 窗口重置时间戳（毫秒）

当请求超过限制时，返回 `429 Too Many Requests` 响应，并附带 `Retry-After` 头：

```json
{
  "error": "Too Many Requests"
}
```

## 配置选项

```typescript
interface RateLimitOptions {
  /** 时间窗口（毫秒），默认 60000 */
  windowMs?: number;
  /** 窗口内最大请求数，默认 100 */
  max?: number;
  /** 触发限流时的响应消息，默认 "Too Many Requests" */
  message?: string;
  /**
   * 是否信任代理头（X-Forwarded-For / X-Real-IP）。
   * 默认 false，避免客户端伪造 IP 绕过限流。
   */
  trustProxyHeaders?: boolean;
  /** 自定义限流键生成函数 */
  keyFn?: (ctx: Context) => string;
  /** 自定义存储后端，默认内存存储 */
  store?: RateLimitStore;
}
```

## 按路由配置不同限流规则

不同路由可以注册不同的限流中间件：

```typescript
// 登录接口严格限流
app.use(
  "/auth/login",
  rateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    message: "登录次数过多，请稍后再试",
    store: createMemoryRateLimitStore(),
  }),
);

// 搜索接口单独限流
app.use(
  "/search",
  rateLimit({
    windowMs: 60_000,
    max: 30,
    store: createMemoryRateLimitStore(),
  }),
);
```

## 按用户 ID 限流

通过自定义 `keyFn`，可以按用户身份而非 IP 进行限流：

```typescript
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    keyFn: (ctx) => {
      const userId = ctx.headers.get("x-user-id");
      return userId ? `user:${userId}` : `ip:${ctx.request.headers.get("x-forwarded-for") ?? "unknown"}`;
    },
    store: createMemoryRateLimitStore(),
  }),
);
```

## Redis 存储（分布式限流）

多实例部署时，使用 `createRedisRateLimitStore` 接入 Redis 实现统一的限流计数：

```typescript
import { rateLimit, createRedisRateLimitStore } from "@ventostack/core";

const redis = new Bun.Redis("redis://localhost:6379");

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    store: createRedisRateLimitStore({ client: redis }),
  }),
);
```

`createRedisRateLimitStore` 接受任何满足最小接口的 Redis 客户端（Bun Redis、ioredis、node-redis 等）：

```typescript
interface RedisClientLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<void>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<void>;
}
```

如果客户端支持 `eval`，会自动使用原子 Lua 脚本执行 `INCR + PEXPIRE`，彻底避免 race condition。

## 自定义存储后端

也可以完全自定义存储，只需实现 `RateLimitStore` 接口：

```typescript
interface RateLimitStore {
  /**
   * 增加计数
   * @param key - 限流键
   * @param windowMs - 时间窗口（毫秒）
   * @returns 当前计数与重置时间
   */
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /**
   * 重置计数
   * @param key - 限流键
   */
  reset(key: string): Promise<void>;
}
```

## 安全注意事项

### 代理头信任

默认情况下 `trustProxyHeaders` 为 `false`，限流键仅从直接连接的客户端 IP 获取。如果应用部署在反向代理（如 Nginx、Cloudflare）之后，需要显式开启：

```typescript
rateLimit({
  windowMs: 60_000,
  max: 100,
  trustProxyHeaders: true,  // 信任 X-Forwarded-For
  store: createMemoryRateLimitStore(),
});
```

**警告**：在直接暴露给公网的环境中开启 `trustProxyHeaders`，攻击者可通过伪造 `X-Forwarded-For` 绕过限流。

### 多实例部署

内存存储仅在单实例内生效。多实例部署时，使用 `createRedisRateLimitStore` 接入 Redis 实现统一的限流计数，详见上文 "Redis 存储" 章节。
