---
title: 快速开始
description: 5 分钟内创建并运行你的第一个 Aeron 应用
---

## 前置条件

安装 [Bun](https://bun.sh)（>= 1.0.0）：

```bash
curl -fsSL https://bun.sh/install | bash
```

## 创建项目

```bash
mkdir my-aeron-app
cd my-aeron-app
bun init -y
```

## 安装依赖

```bash
bun add @aeron/core
```

## 创建应用

创建 `src/main.ts`：

```typescript
import { createApp, createRouter } from "@aeron/core";

const router = createRouter();

router.get("/", async (ctx) => {
  return ctx.json({ message: "Hello, Aeron!" });
});

router.get("/users/:id", async (ctx) => {
  const { id } = ctx.params;
  return ctx.json({ id, name: "Alice" });
});

// 使用类型标记，ctx.params.id 自动推导为 number
router.get("/items/:id<int>", async (ctx) => {
  return ctx.json({ id: ctx.params.id, type: typeof ctx.params.id });
});

const app = createApp({ port: 3000 });
app.use(router);
await app.listen();

console.log("Server running at http://localhost:3000");
```

## 启动开发服务器

```bash
bun --hot src/main.ts
```

访问 `http://localhost:3000`，你会看到：

```json
{ "message": "Hello, Aeron!" }
```

## 添加中间件

```typescript
import { createApp, createRouter } from "@aeron/core";
import type { Middleware } from "@aeron/core";

// 日志中间件
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
  return response;
};

// 认证中间件示例
const auth: Middleware = async (ctx, next) => {
  const token = ctx.headers.get("authorization");
  if (!token) {
    return ctx.json({ error: "Unauthorized" }, 401);
  }
  return next();
};

const router = createRouter();
router.get("/protected", async (ctx) => {
  return ctx.json({ data: "secret" });
}, auth);

const app = createApp({ port: 3000 });
app.use(logger);
app.use(router);
await app.listen();
```

## 完整示例：带数据库和认证

首先安装额外依赖：

```bash
bun add @aeron/database @aeron/auth @aeron/cache @aeron/observability
```

```typescript
import { createApp, createRouter } from "@aeron/core";
import { createDatabase, defineModel, column } from "@aeron/database";
import { createJWT, createRBAC, createPasswordHasher } from "@aeron/auth";
import { createCache, createMemoryAdapter } from "@aeron/cache";
import { createLogger } from "@aeron/observability";

// 定义数据模型
const UserModel = defineModel("users", {
  id: column.bigint({ primary: true, autoIncrement: true }),
  email: column.varchar({ length: 255, unique: true }),
  password: column.varchar({ length: 255 }),
  name: column.varchar({ length: 255 }),
  role: column.varchar({ length: 50 }),
});

// 初始化依赖
const logger = createLogger({ level: "info" });

// 传入 url 即可自动使用 Bun.sql，无需手动配置 executor
const db = createDatabase({ url: process.env.DATABASE_URL! });

const jwt = createJWT({
  secret: process.env.JWT_SECRET!,
  defaultOptions: { expiresIn: 7 * 24 * 60 * 60 }, // 7 天
});

const passwordHasher = createPasswordHasher();
const cache = createCache(createMemoryAdapter());
const rbac = createRBAC();

// 定义权限角色
rbac.addRole({
  name: "admin",
  permissions: [
    { resource: "users", action: "read" },
    { resource: "users", action: "write" },
    { resource: "users", action: "delete" },
  ],
});
rbac.addRole({
  name: "user",
  permissions: [{ resource: "users", action: "read" }],
});

const router = createRouter();

// 注册路由
router.post("/auth/register", async (ctx) => {
  const { email, password, name } = await ctx.request.json() as {
    email: string;
    password: string;
    name: string;
  };

  const existing = await db.query(UserModel).where("email", "=", email).get();
  if (existing) {
    return ctx.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await passwordHasher.hash(password);
  const user = await db
    .query(UserModel)
    .insert({ email, password: passwordHash, name, role: "user" }, { returning: true });

  return ctx.json({ id: user?.id, email, name }, 201);
});

// 登录路由
router.post("/auth/login", async (ctx) => {
  const { email, password } = await ctx.request.json() as { email: string; password: string };

  const user = await db.query(UserModel).where("email", "=", email).get();
  if (!user) {
    return ctx.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await passwordHasher.verify(password, user.password as string);
  if (!valid) {
    return ctx.json({ error: "Invalid credentials" }, 401);
  }

  const token = await jwt.sign({ sub: String(user.id), role: user.role as string });
  return ctx.json({ token });
});

// 受保护的路由
router.get("/users", async (ctx) => {
  const token = ctx.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return ctx.json({ error: "Unauthorized" }, 401);
  }

  const payload = await jwt.verify(token);

  if (!rbac.can([payload.role as string], "users", "read")) {
    return ctx.json({ error: "Forbidden" }, 403);
  }

  // cache.remember：先读缓存，未命中则执行 factory 并将结果写入缓存
  const users = await cache.remember("users:all", 300, async () => {
    return db.query(UserModel).select("id", "name", "email").list();
  });

  return ctx.json(users);
});

const app = createApp({ port: 3000 });
app.use(router);

app.lifecycle.onAfterStart(() => {
  logger.info("Server started", { port: 3000 });
});

await app.listen();
```

## 下一步

- 深入了解[路由系统](/core/router/)
- 了解[中间件机制](/core/middleware/)
- 配置[数据库连接](/database/connection/)
- 设置[认证和授权](/auth/jwt/)
