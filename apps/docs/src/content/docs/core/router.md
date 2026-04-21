---
title: 路由系统
description: 使用 createRouter 定义 HTTP 路由，支持参数路由、资源路由和路由分组
---

`createRouter` 提供了完整的 HTTP 路由功能，支持路径参数、通配符、资源路由和路由分组。

## 基本路由

```typescript
import { createRouter } from "@aeron/core";

const router = createRouter();

// HTTP 方法
router.get("/users", async (ctx) => ctx.json(await getUsers()));
router.post("/users", async (ctx) => ctx.json(await createUser(await ctx.body())));
router.put("/users/:id", async (ctx) => ctx.json(await updateUser(ctx.params.id, await ctx.body())));
router.patch("/users/:id", async (ctx) => ctx.json(await patchUser(ctx.params.id, await ctx.body())));
router.delete("/users/:id", async (ctx) => ctx.json(await deleteUser(ctx.params.id)));
```

## 路径参数

使用 `:name` 定义路径参数，通过 `ctx.params` 访问：

```typescript
router.get("/users/:id<int>", async (ctx) => {
  // ctx.params.id 被推导为 number
  const { id } = ctx.params;
  const user = await db.query(UserModel).where("id", "=", id).get();
  return ctx.json(user);
});

// 多个参数
router.get("/orgs/:orgId/repos/:repoId", async (ctx) => {
  const { orgId, repoId } = ctx.params;
  return ctx.json({ orgId, repoId });
});
```

## 路径参数类型标记

使用 `:name<type>` 语法为路径参数声明类型，框架会自动推导 TypeScript 类型并在运行时做转换和校验：

```typescript
router.get("/users/:id<int>", async (ctx) => {
  // ctx.params.id 被推导为 number，运行时自动 parseInt
  const user = await db.query(UserModel).where("id", "=", ctx.params.id).get();
  return ctx.json(user);
});

router.get("/events/:at<date>", async (ctx) => {
  // ctx.params.at 被推导为 Date
  return ctx.json({ at: ctx.params.at.toISOString() });
});

// 多个类型化参数
router.get("/users/:userId<int>/posts/:postId<int>", async (ctx) => {
  // ctx.params.userId → number
  // ctx.params.postId → number
  return ctx.json({ userId: ctx.params.userId, postId: ctx.params.postId });
});
```

### 支持的内置类型

| 标记 | TypeScript 类型 | 运行时转换 | 默认正则 |
|------|----------------|-----------|---------|
| `:name<string>` | `string` | 原样 | `[^/]+` |
| `:name<int>` | `number` | `parseInt` | `\d+` |
| `:name<float>` | `number` | `parseFloat` | `-?\d+(\.\d+)?` |
| `:name<bool>` | `boolean` | `v === "true"` | `true\|false\|1\|0` |
| `:name<uuid>` | `string` | 原样 | UUID v4 |
| `:name<date>` | `Date` | `new Date(v)` | ISO 8601 |

无类型标记的参数（如 `:id`）默认推导为 `string`。

### 自定义正则约束

在类型标记后附加 `(regex)` 可覆盖默认正则：

```typescript
// 年份必须是 4 位数字
router.get("/archive/:year<int>(\d{4})", async (ctx) => {
  return ctx.json({ year: ctx.params.year });
});

// 代码必须是大写两位字母
router.get("/items/:code<string>(^[A-Z]{2}$)", async (ctx) => {
  return ctx.json({ code: ctx.params.code });
});
```

自定义正则只影响校验，不改变 TypeScript 推导类型。当参数值不匹配正则时，请求会自动返回 400 `VALIDATION_ERROR`。

## 查询参数

通过 `ctx.query` 访问查询字符串：

```typescript
router.get("/users", async (ctx) => {
  const { page = "1", limit = "20", search } = ctx.query;
  const users = await db
    .query(UserModel)
    .where("name", "LIKE", `%${search}%`)
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit))
    .list();
  return ctx.json({ users, page: Number(page), limit: Number(limit) });
});
```

## 通配符路由

```typescript
// 匹配 /static/xxx 下的所有路径
router.get("/static/*", async (ctx) => {
  const filePath = ctx.params["*"];
  const file = Bun.file(`./public/${filePath}`);
  return new Response(file);
});
```

## 资源路由

使用 `router.resource()` 快速定义 RESTful 资源路由：

```typescript
router.resource("/users", {
  index: async (ctx) => ctx.json(await getUsers()),         // GET /users
  show: async (ctx) => ctx.json(await getUser(ctx.params.id)),  // GET /users/:id
  create: async (ctx) => ctx.json(await createUser(await ctx.body()), 201), // POST /users
  update: async (ctx) => ctx.json(await updateUser(ctx.params.id, await ctx.body())), // PUT /users/:id
  destroy: async (ctx) => ctx.json(await deleteUser(ctx.params.id)), // DELETE /users/:id
});
```

等价于手动定义：
- `GET /users` → `index`
- `GET /users/:id` → `show`
- `POST /users` → `create`
- `PUT /users/:id` → `update`
- `DELETE /users/:id` → `destroy`

## 路由分组

将 router 作为另一个 router 的子路由，实现路由分组：

```typescript
const apiRouter = createRouter();
const v1Router = createRouter();
const v2Router = createRouter();

v1Router.get("/users", handler);
v2Router.get("/users", newHandler);

// 将子路由挂载到前缀路径
apiRouter.merge(v1Router);
apiRouter.merge(v2Router);
```

## 路由中间件

路由级中间件只对该路由生效：

```typescript
const requireAuth: Middleware = async (ctx, next) => {
  const token = ctx.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return ctx.json({ error: "Unauthorized" }, 401);
  ctx.state.user = await jwt.verify(token);
  await next();
};

// 所有路由都需要认证
router.use(requireAuth);
router.get("/protected", async (ctx) => ctx.json(ctx.state.user));
```

## 注册到应用

```typescript
const app = createApp({ port: 3000 });
app.use(router);
await app.listen();
```

## Router 接口

```typescript
interface Router {
  get<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  post<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  put<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  patch<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  delete<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  use(...middleware: Middleware[]): Router;
  resource(prefix: string, handlers: ResourceHandlers, ...middleware: Middleware[]): Router;
  merge(router: Router): Router;
}

type RouteHandler<TParams extends Record<string, unknown> = Record<string, string>> = (ctx: Context<TParams>) => Response | Promise<Response>;
```
