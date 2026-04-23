---
title: 请求验证
description: 使用 @ventostack/core 提供的 validate、validateBody 和 validateQuery 进行数据校验
---

请求验证功能由 `@ventostack/core` 提供，而非 `@ventostack/openapi`。它基于简单的字段规则（FieldRule）进行类型检查和约束验证。

## validate 函数

`validate(data, schema)` 校验任意对象是否符合定义的规则，返回 `{ valid: boolean; errors: string[] }`：

```typescript
import { validate } from "@ventostack/core";

const result = validate(
  { name: "Alice", email: "alice@example.com", age: 25 },
  {
    name: { type: "string", required: true, min: 2, max: 100 },
    email: { type: "string", required: true },
    age: { type: "number", min: 0, max: 150 },
    role: { type: "string", enum: ["admin", "user"] as const },
  },
);

if (!result.valid) {
  console.error(result.errors);
  // ["age must be at most 150", "role must be one of: admin, user"]
}
```

## 校验中间件

### validateBody

`validateBody(schema)` 创建校验请求体的中间件，自动解析 JSON 并校验：

```typescript
import { validateBody } from "@ventostack/core";

const createUserSchema = {
  name: { type: "string", required: true, min: 2, max: 100 },
  email: { type: "string", required: true },
  password: { type: "string", required: true, min: 8 },
};

router.post("/users", async (ctx) => {
  const body = await ctx.request.json() as { name: string; email: string; password: string };
  // 校验通过，继续处理
  const user = await createUser(body);
  return ctx.json(user, 201);
}, validateBody(createUserSchema));
```

校验失败时自动返回 `400` 响应：

```json
{
  "errors": [
    "name is required",
    "password must have at least 8 characters"
  ]
}
```

### validateQuery

`validateQuery(schema)` 创建校验查询参数的中间件：

```typescript
import { validateQuery } from "@ventostack/core";

const listQuerySchema = {
  page: { type: "string", pattern: /^[0-9]+$/ },
  limit: { type: "string", pattern: /^[0-9]+$/ },
  search: { type: "string", max: 100 },
};

router.get("/users", async (ctx) => {
  const { page = "1", limit = "20", search } = ctx.query;
  // 已验证的参数
  return ctx.json({ page, limit, search });
}, validateQuery(listQuerySchema));
```

## 字段规则

```typescript
/** 字段类型 */
type FieldType = "string" | "number" | "boolean" | "array" | "object";

/** 字段校验规则 */
interface FieldRule {
  /** 字段类型 */
  type: FieldType;
  /** 是否必填 */
  required?: boolean;
  /** 最小值/最小长度 */
  min?: number;
  /** 最大值/最大长度 */
  max?: number;
  /** 正则匹配（仅 string 类型） */
  pattern?: RegExp;
  /** 枚举值 */
  enum?: readonly unknown[];
  /** 数组元素规则 */
  items?: FieldRule;
  /** 对象属性规则 */
  properties?: Record<string, FieldRule>;
  /** 自定义校验函数，返回错误字符串或 null */
  custom?: (value: unknown) => string | null;
}
```

## 校验结果

```typescript
interface ValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 错误信息列表（字符串数组） */
  errors: string[];
}
```

## 嵌套对象校验

支持对嵌套对象和数组进行深度校验：

```typescript
const result = validate(
  {
    user: {
      name: "Alice",
      tags: ["admin", "developer"],
    },
  },
  {
    user: {
      type: "object",
      required: true,
      properties: {
        name: { type: "string", required: true },
        tags: {
          type: "array",
          items: { type: "string", min: 1 },
        },
      },
    },
  },
);
```

## 自定义校验

通过 `custom` 函数实现自定义校验逻辑：

```typescript
const schema = {
  password: {
    type: "string",
    required: true,
    min: 8,
    custom: (value: unknown) => {
      const str = value as string;
      if (!/[A-Z]/.test(str)) return "必须包含至少一个大写字母";
      if (!/[0-9]/.test(str)) return "必须包含至少一个数字";
      return null;
    },
  },
};
```
