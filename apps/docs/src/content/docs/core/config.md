---
title: 配置管理
description: 使用 createConfig 和 loadConfig 管理应用配置，支持环境变量、JSON 文件和 12-Factor 规范
---

VentoStack 提供了多种配置管理方式，从简单的环境变量读取到完整的 12-Factor 配置系统。

## 基本配置

使用 `createConfig` 定义 schema 并读取配置：

```typescript
import { createConfig } from "@ventostack/core";

const config = createConfig({
  port: { type: "number", env: "PORT", default: 3000 },
  host: { type: "string", env: "HOST", default: "0.0.0.0" },
  logLevel: { type: "string", env: "LOG_LEVEL", default: "info" },
  databaseUrl: { type: "string", env: "DATABASE_URL", required: true },
  jwtSecret: { type: "string", env: "JWT_SECRET", required: true, sensitive: true },
  debug: { type: "boolean", env: "DEBUG", default: false },
}, process.env);

// TypeScript 自动推断类型
config.port     // number
config.host     // string
config.debug    // boolean
```

## 支持的字段类型

```typescript
type ConfigFieldDef = {
  type: "string" | "number" | "boolean";
  env?: string;        // 环境变量名
  default?: unknown;   // 默认值
  required?: boolean;  // 是否必填（无默认值时）
  sensitive?: boolean; // 敏感字段（日志中脱敏）
  secret?: boolean;    // 是否为密钥（需加密存储）
  options?: readonly unknown[]; // 可选枚举值
};
```

## 嵌套 Schema

Schema 支持嵌套结构：

```typescript
const config = createConfig({
  server: {
    port: { type: "number", default: 3000 },
    host: { type: "string", default: "0.0.0.0" },
  },
  database: {
    url: { type: "string", required: true },
    pool: { type: "number", default: 10 },
  },
}, process.env);

// config.server.port → number
// config.database.url → string
```

## 分环境配置文件

`loadConfig` 支持从 JSON 文件加载配置，并按环境合并：

```typescript
import { loadConfig } from "@ventostack/core";

// 读取 config/base.json 和 config/${NODE_ENV}.json
const config = await loadConfig(
  {
    port: { type: "number", default: 3000 },
    databaseUrl: { type: "string", required: true },
  },
  {
    basePath: "./config",  // 配置文件目录
    env: "development",    // 当前环境名
  }
);
```

配置文件结构：
```
config/
  base.json          - 基础配置
  development.json   - 开发环境覆盖
  production.json    - 生产环境覆盖
  test.json          - 测试环境覆盖
```

## CLI 参数解析

使用 `parseArgs` 解析命令行参数：

```typescript
import { parseArgs } from "@ventostack/core";

// bun run src/main.ts --port 8080 --env production
const args = parseArgs(process.argv.slice(2));
// args.port === "8080"
// args.env === "production"
```

## 安全预检

使用 `securityPrecheck` 在启动时检查安全配置：

```typescript
import { securityPrecheck } from "@ventostack/core";

const result = securityPrecheck({
  requireHTTPS: true,          // 生产环境必须 HTTPS
  minSecretLength: 32,         // 密钥最小长度
  requiredSecrets: ["JWT_SECRET", "DATABASE_URL"],
  disallowDebug: true,         // 生产环境禁止 DEBUG
});

if (!result.passed) {
  console.error("安全检查失败:", result.errors);
  process.exit(1);
}
```

## 配置脱敏

使用 `sanitizeConfig` 对配置进行脱敏处理（用于日志输出）：

```typescript
import { sanitizeConfig } from "@ventostack/core";

const schema = {
  port: { type: "number" },
  jwtSecret: { type: "string", sensitive: true },
  databaseUrl: { type: "string", sensitive: true },
};

const config = {
  port: 3000,
  jwtSecret: "super-secret-key",
  databaseUrl: "postgres://user:pass@localhost/db",
};

const sanitized = sanitizeConfig(schema, config);
// { port: 3000, jwtSecret: "***", databaseUrl: "***" }

console.log("当前配置:", sanitized); // 安全输出
```

## 相关模块

以下配置相关模块也存在于 `@ventostack/core` 中，但由独立文档页面覆盖：

- **YAML 配置** — `parseYAML`、`stringifyYAML`、`loadYAMLConfig`（见 [YAML 配置](/docs/core/yaml-config)）
- **配置热更新** — `createConfigWatcher`（见 [配置热重载](/docs/core/config-watch)）
- **配置加密** — `createConfigEncryptor`（见 [配置加密](/docs/core/config-encryption)）
- **12-Factor 配置** — `loadTwelveFactorConfig`、`validateEnvVars`（见 [12-Factor 配置](/docs/core/twelve-factor)）
