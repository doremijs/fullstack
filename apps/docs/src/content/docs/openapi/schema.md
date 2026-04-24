---
title: OpenAPI 文档生成
description: 使用 setupOpenAPI、Schema 构建器和路由元数据自动生成 OpenAPI 3.0 文档
---

`@ventostack/openapi` 提供从代码自动生成 OpenAPI 3.0 规范的能力，保持文档与代码同步。核心设计原则：

- **零额外维护**：路由 Schema 配置同时驱动类型推导、运行时校验和 OpenAPI 生成
- **自动推断**：未显式声明时，从 handler 返回值推断响应类型
- **渐进式增强**：从全自动到全手动控制，按需选择粒度

## 一键接入

推荐方式：使用 `setupOpenAPI` 在应用层级一键注册 OpenAPI JSON 端点和文档 UI。

```typescript
import { createApp } from "@ventostack/core";
import { setupOpenAPI } from "@ventostack/openapi";

const app = createApp({ port: 3000 });

// 注册你的路由...
// app.use(userRouter);

// 一键接入 OpenAPI
setupOpenAPI(app, {
  info: {
    title: "My API",
    version: "1.0.0",
    description: "API 文档",
  },
  servers: [
    { url: "https://api.example.com", description: "生产环境" },
    { url: "http://localhost:3000", description: "开发环境" },
  ],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  docsTitle: "My API Documentation",
});

await app.listen();
```

接入后自动获得两个端点：

- `GET /openapi.json` — OpenAPI 3.0 JSON 规范
- `GET /docs` — Scalar UI 文档页面

### 自定义路径

```typescript
setupOpenAPI(app, {
  info: { title: "My API", version: "1.0.0" },
  jsonPath: "/api-spec.json",   // 自定义 JSON 路径
  docsPath: "/api-docs",        // 自定义 UI 路径
});
```

## 路由 Schema 配置（推荐）

在 `@ventostack/core` 的路由中配置 `schemaConfig`，OpenAPI 文档将**自动同步生成**，无需手写 Schema。

```typescript
import { createRouter } from "@ventostack/core";

const router = createRouter();

router.post("/api/users", async (ctx) => {
  const body = ctx.request.json ? await ctx.request.json() : {};
  const user = await createUser(body);
  return ctx.json({ id: user.id, name: user.name }, 201);
}, {
  schemaConfig: {
    body: {
      name: { type: "string", required: true, min: 2, max: 100, description: "用户姓名" },
      email: { type: "string", required: true, format: "email", description: "邮箱地址" },
      password: { type: "string", required: true, min: 8, description: "密码" },
      role: { type: "string", enum: ["admin", "user", "viewer"], default: "user" },
    },
    responses: {
      201: {
        contentType: "application/json",
        schema: {
          id: { type: "uuid", description: "用户 ID" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string" },
        },
        description: "创建成功",
      },
      422: { description: "参数校验失败" },
    },
  },
  metadata: {
    openapi: {
      summary: "创建用户",
      tags: ["users"],
      operationId: "createUser",
    },
  },
});
```

### 支持的 Schema 字段类型

| 类型 | 说明 | OpenAPI 映射 |
|------|------|-------------|
| `string` | 字符串 | `type: "string"` |
| `number` / `float` | 浮点数 | `type: "number"` |
| `int` | 整数 | `type: "integer"` |
| `boolean` / `bool` | 布尔值 | `type: "boolean"` |
| `uuid` | UUID | `type: "string", format: "uuid"` |
| `date` | 日期 | `type: "string", format: "date-time"` |
| `array` | 数组 | `type: "array"` |
| `object` | 对象 | `type: "object"` |
| `file` | 文件上传 | `type: "string", format: "binary"` |

### Schema 字段通用属性

```typescript
{
  type: "string",
  required: true,           // 是否必填
  default: "default_value", // 默认值
  min: 2,                   // 最小值 / 最小长度
  max: 100,                 // 最大值 / 最大长度
  pattern: /^[a-z]+$/,      // 正则匹配
  enum: ["a", "b", "c"],    // 枚举值
  description: "字段描述",   // OpenAPI 描述
  example: "示例值",         // OpenAPI 示例
  format: "email",          // OpenAPI 格式
}
```

### 查询参数自动推断

```typescript
router.get("/api/users", async (ctx) => {
  const { page, limit, search } = ctx.query as { page: string; limit: string; search?: string };
  // ...
}, {
  schemaConfig: {
    query: {
      page: { type: "string", required: true, description: "页码" },
      limit: { type: "string", required: true, description: "每页数量" },
      search: { type: "string", description: "搜索关键词" },
    },
  },
});
```

配置 `schemaConfig.query` 后，OpenAPI 会自动生成 `parameters` 定义，无需手动声明。

## 响应类型自动推断

当未配置 `schemaConfig.responses` 时，OpenAPI 模块会尝试从 handler 的返回值推断响应类型：

```typescript
// 自动推断为 200 响应，类型为 { message: string }
router.get("/hello", (ctx) => {
  return ctx.json({ message: "Hello!" });
});

// 自动推断为 302 重定向
router.get("/redirect", (ctx) => {
  return ctx.redirect("/target", 302);
});

// 自动推断为 text/plain
router.get("/text", (ctx) => {
  return ctx.text("Plain text response");
});
```

推断优先级：**手动声明 `schemaConfig.responses` > 自动推断 > 默认 200**

## Schema 构建器（手动声明）

当需要脱离路由单独构建 Schema 时，使用 Schema 构建函数：

```typescript
import {
  schemaString,
  schemaNumber,
  schemaInteger,
  schemaBoolean,
  schemaArray,
  schemaObject,
  schemaEnum,
  schemaRef,
} from "@ventostack/openapi";

const UserSchema = schemaObject({
  id: schemaString({ format: "uuid", description: "用户 ID" }),
  name: schemaString({ minLength: 2, maxLength: 100, description: "用户姓名" }),
  email: schemaString({ format: "email", description: "邮箱地址" }),
  role: schemaEnum(["admin", "user", "viewer"], { description: "用户角色" }),
  age: schemaInteger({ minimum: 0, maximum: 150 }),
  tags: schemaArray(schemaString(), { description: "标签列表" }),
});
```

### Schema 引用

```typescript
const CreateUserSchema = schemaObject({
  name: schemaString({ minLength: 2 }),
  email: schemaString({ format: "email" }),
  password: schemaString({ minLength: 8 }),
});

// 使用 $ref 引用
const UpdateUserSchema = schemaObject({
  name: schemaString({ minLength: 2 }),
  email: schemaString({ format: "email" }),
});
```

## 路由元数据（手动增强）

使用 `defineRouteDoc` 为路由定义完整的 OpenAPI 元数据：

```typescript
import { defineRouteDoc } from "@ventostack/openapi";

const listUsersDoc = defineRouteDoc({
  path: "/api/users",
  method: "get",
  summary: "获取用户列表",
  description: "支持分页和搜索的用户列表查询",
  tags: ["users"],
  operationId: "listUsers",
  parameters: [
    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
    { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
  ],
  responses: {
    200: {
      description: "成功返回用户列表",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              data: { type: "array", items: schemaRef("User") },
              total: { type: "integer" },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});
```

然后注入到生成器中：

```typescript
import { createOpenAPIGenerator, routesToOpenAPI } from "@ventostack/openapi";

const generator = createOpenAPIGenerator();
generator.setInfo({ title: "My API", version: "1.0.0" });

// 批量注入路由元数据
routesToOpenAPI([listUsersDoc, getUserDoc, createUserDoc], generator);

const spec = generator.generate();
```

## 程序化生成文档

当需要完全控制文档生成流程时，使用 `createOpenAPIGenerator`：

```typescript
import { createOpenAPIGenerator, toYAML } from "@ventostack/openapi";

const generator = createOpenAPIGenerator();

// 设置基本信息
generator.setInfo({
  title: "My API",
  version: "1.0.0",
  description: "Production API",
});

// 添加服务器
generator.addServer({ url: "https://api.example.com", description: "生产环境" });
generator.addServer({ url: "http://localhost:3000", description: "开发环境" });

// 添加标签
generator.addTag("users", "用户管理");
generator.addTag("auth", "认证授权");

// 添加 Schema 定义
generator.addSchema("User", {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
});

// 添加安全方案
generator.addSecurityScheme("bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// 添加路径操作
generator.addPath("/users", "get", {
  summary: "获取用户列表",
  tags: ["users"],
  responses: {
    200: { description: "成功" },
  },
});

// 生成文档
const document = generator.generate();     // OpenAPIDocument 对象
const json = generator.toJSON();           // JSON 字符串
const yaml = generator.toYAML();           // YAML 字符串
```

## 从 Router 自动同步

将已注册的路由自动同步到生成器（`setupOpenAPI` 内部使用）：

```typescript
import { syncRouterToOpenAPI } from "@ventostack/openapi";

const generator = createOpenAPIGenerator();
generator.setInfo({ title: "My API", version: "1.0.0" });

// 自动读取 router 中所有路由的 schemaConfig 和 metadata
syncRouterToOpenAPI(router, generator, {
  excludePaths: ["/health", "/metrics"],  // 排除内部端点
});

const spec = generator.generate();
```

## 自定义文档 UI

默认使用 Scalar UI。如需切换为 Swagger UI：

```typescript
import { createSwaggerUIPlugin, setupOpenAPI } from "@ventostack/openapi";

// 方式 1：单独注册 Swagger UI 插件
app.use(createSwaggerUIPlugin({
  specUrl: "/openapi.json",
  title: "Swagger UI",
  path: "/swagger",
}));

// 方式 2：完全手动控制
generator.addPath("/docs", "get", {
  summary: "API 文档",
  responses: {
    200: { description: "HTML 页面" },
  },
});

// 然后自己注册 handler
app.router.get("/docs", createSwaggerUIHandler({ specUrl: "/openapi.json" }));
```

## 安全注意事项

- `/openapi.json` 和 `/docs` 默认公开暴露，生产环境应通过 `excludePaths` 或环境变量控制访问范围
- `securitySchemes` 中配置的认证方案仅作文档说明，实际认证仍需在路由中实现
- 避免在 `description` 中泄露内部实现细节（如数据库表名、内部 IP）
