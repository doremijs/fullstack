---
title: Schema 定义
description: 使用 Schema 构建函数和 OpenAPI 生成器创建 OpenAPI 3.0 文档
---

`@ventostack/openapi` 提供了 OpenAPI 3.0.3 Schema 构建函数与文档生成器，支持从代码生成类型安全的 API 文档，并保持文档与代码同步。

## Schema 构建函数

使用工厂函数创建各类 OpenAPI Schema 对象：

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

// 字符串类型
const nameSchema = schemaString({
  description: "用户姓名",
  minLength: 2,
  maxLength: 100,
  example: "Alice",
});

// 数字类型
const ageSchema = schemaNumber({
  description: "用户年龄",
  minimum: 0,
  maximum: 150,
  example: 25,
});

// 整数类型
const countSchema = schemaInteger({
  description: "计数",
  minimum: 0,
  example: 10,
});

// 布尔类型
const activeSchema = schemaBoolean({
  description: "是否激活",
  example: true,
});

// 数组类型
const tagsSchema = schemaArray(schemaString(), {
  description: "标签列表",
});

// 对象类型
const userSchema = schemaObject(
  {
    id: schemaString({ description: "用户唯一 ID" }),
    name: nameSchema,
    email: schemaString({ format: "email", description: "邮箱地址" }),
    role: schemaEnum(["admin", "user", "viewer"], { description: "用户角色" }),
    tags: tagsSchema,
  },
  ["id", "name", "email", "role"],
  { description: "用户对象" },
);

// 引用其他 Schema
const userRef = schemaRef("User");
```

## OpenAPI 文档生成器

使用 `createOpenAPIGenerator()` 创建生成器实例，通过链式方法构建完整文档：

```typescript
import { createOpenAPIGenerator } from "@ventostack/openapi";

const generator = createOpenAPIGenerator();

// 设置文档基本信息
generator.setInfo({
  title: "My API",
  version: "1.0.0",
  description: "API 文档",
});

// 添加服务器
generator.addServer({
  url: "https://api.example.com",
  description: "生产环境",
});
generator.addServer({
  url: "http://localhost:3000",
  description: "开发环境",
});

// 添加标签
generator.addTag("users", "用户管理");
generator.addTag("auth", "认证授权");

// 添加 Schema 定义
generator.addSchema("User", userSchema);
generator.addSchema("CreateUser", schemaObject(
  {
    name: schemaString({ minLength: 2 }),
    email: schemaString({ format: "email" }),
    password: schemaString({ minLength: 8 }),
  },
  ["name", "email", "password"],
));

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
  parameters: [
    {
      name: "page",
      in: "query",
      schema: schemaInteger({ default: 1 }),
    },
    {
      name: "limit",
      in: "query",
      schema: schemaInteger({ default: 20, maximum: 100 }),
    },
  ],
  responses: {
    "200": {
      description: "成功返回用户列表",
      content: {
        "application/json": {
          schema: schemaObject({
            data: schemaArray(schemaRef("User")),
            total: schemaInteger(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// 生成文档对象
const doc = generator.generate();
// doc.openapi === "3.0.3"

// 导出为 JSON
const json = generator.toJSON();

// 导出为 YAML
const yaml = generator.toYAML();
```

## 一键接入应用

通过 `setupOpenAPI` 或 `createOpenAPIPlugin` 将 OpenAPI 文档自动生成接入 VentoStack 应用：

```typescript
import { createApp } from "@ventostack/core";
import { setupOpenAPI } from "@ventostack/openapi";

const app = createApp({ port: 3000 });

// 注册路由...

setupOpenAPI(app, {
  info: {
    title: "VentoStack Example API",
    version: "1.0.0",
    description: "Production-grade example API",
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development server" },
  ],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  docsTitle: "API Docs",
  jsonPath: "/openapi.json",
  docsPath: "/docs",
});

await app.listen();
```

接入后会自动：
- 在 `/openapi.json` 提供 JSON 格式的 OpenAPI 规范
- 在 `/docs` 提供 Scalar UI 文档页面

## 路由元数据

通过 `defineRouteDoc` 为路由添加 OpenAPI 元数据，生成器会自动读取：

```typescript
import { defineRouteDoc } from "@ventostack/openapi";

router.get("/users", async (ctx) => {
  // ...
}, {
  openapi: defineRouteDoc({
    summary: "获取用户列表",
    tags: ["users"],
    description: "分页获取所有用户",
  }),
});
```

## 接口定义

```typescript
/** OpenAPI 3.0 Schema 对象 */
interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: unknown[];
  description?: string;
  example?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
  oneOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  $ref?: string;
}

/** OpenAPI 文档生成器 */
interface OpenAPIGenerator {
  setInfo(info: OpenAPIInfo): void;
  addServer(server: OpenAPIServer): void;
  addTag(name: string, description?: string): void;
  addSchema(name: string, schema: OpenAPISchema): void;
  addSecurityScheme(name: string, scheme: unknown): void;
  addPath(path: string, method: string, operation: OpenAPIOperation): void;
  generate(): OpenAPIDocument;
  toJSON(): string;
  toYAML(): string;
}

/** OpenAPI 3.0 完整文档 */
interface OpenAPIDocument {
  openapi: "3.0.3";
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPath>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, unknown>;
  };
  tags?: OpenAPITag[];
}
```
