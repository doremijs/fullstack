import { createJWT, createRBAC } from "@aeron/auth";
import { createCache, createMemoryAdapter } from "@aeron/cache";
// Aeron Example App — 展示框架核心功能
import { NotFoundError, UnauthorizedError, createApp } from "@aeron/core";
import { createEventBus, defineEvent } from "@aeron/events";
import { createHealthCheck, createLogger } from "@aeron/observability";
import { createOpenAPIGenerator, createScalarUIPlugin, syncRouterToOpenAPI } from "@aeron/openapi";
import { errorHandler, requestLogger } from "./middleware";

// ── 基础设施 ────────────────────────────────────────

const logger = createLogger({ level: "info", enabled: true });

const cache = createCache(createMemoryAdapter());

const bus = createEventBus();

const health = createHealthCheck();
health.addCheck("cache", async () => true);

const jwt = createJWT();
// 示例专用密钥，生产环境必须使用安全的密钥管理方案
const JWT_SECRET = "aeron-example-secret-key-at-least-32-bytes!";

const rbac = createRBAC();
rbac.addRole({
  name: "admin",
  permissions: [
    { resource: "users", action: "read" },
    { resource: "users", action: "write" },
  ],
});
rbac.addRole({
  name: "viewer",
  permissions: [{ resource: "users", action: "read" }],
});

// ── 事件 ────────────────────────────────────────────

const userLoggedIn = defineEvent<{ userId: string; at: string }>("user.logged_in");

bus.on(userLoggedIn, async (payload) => {
  logger.info("user logged in", { userId: payload.userId, at: payload.at });
});

// ── Mock 数据 ───────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const MOCK_USERS: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "2", name: "Bob", email: "bob@example.com", role: "viewer" },
  { id: "3", name: "Charlie", email: "charlie@example.com", role: "viewer" },
];

// ── 启动应用 ─────────────────────────────────────────

const app = createApp({ port: 3133 });

// 注册全局中间件
app.use(errorHandler(logger));
app.use(requestLogger(logger));

// 直接使用 app.router 定义路由（避免外部 router 重复注册）
app.router.get("/", async (ctx) => ctx.json({ name: "Aeron Example", version: "0.1.0" }));
app.router.get("/health/live", async (ctx) => ctx.json(health.live()));
app.router.get("/health/ready", async (ctx) => {
  const status = await health.ready();
  return ctx.json(status, status.status === "ok" ? 200 : 503);
});

// OpenAPI 文档
const openAPIGen = createOpenAPIGenerator();
openAPIGen.setInfo({
  title: "Aeron Example API",
  version: "0.1.0",
  description: "Example API for Aeron framework",
});
openAPIGen.addServer({ url: "http://localhost:3133", description: "Local development server" });

// Scalar UI 插件
app.use(createScalarUIPlugin({ specUrl: "/openapi.json", title: "Aeron Example API Docs" }));

// API 路由组
app.router.group("/api", (api) => {
  api.get("/users", async (ctx) => {
    const cached = await cache.get<User[]>("users:list");
    if (cached) {
      return ctx.json({ users: cached, source: "cache" });
    }
    await cache.set("users:list", MOCK_USERS, { ttl: 60 });
    return ctx.json({ users: MOCK_USERS, source: "store" });
  });

  api.get("/users/:id", async (ctx) => {
    const user = MOCK_USERS.find((u) => u.id === ctx.params.id);
    if (!user) {
      throw new NotFoundError(`User ${ctx.params.id} not found`);
    }
    return ctx.json({ user });
  });

  api.post("/auth/login", async (ctx) => {
    const body = (await ctx.request.json()) as {
      email?: string;
      password?: string;
    };
    if (!body.email || !body.password) {
      return ctx.json({ error: "email and password required" }, 400);
    }
    const user = MOCK_USERS.find((u) => u.email === body.email);
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const token = await jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: 3600,
    });
    await bus.emit(userLoggedIn, {
      userId: user.id,
      at: new Date().toISOString(),
    });
    return ctx.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  });
});

// 同步所有已注册路由到 OpenAPI 文档
syncRouterToOpenAPI(app.router, openAPIGen);

app.router.get("/openapi.json", async (ctx) => ctx.json(openAPIGen.generate()));

logger.info("starting Aeron example app", { port: 3133 });
await app.listen();
