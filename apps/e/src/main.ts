import { createApp, createRouter, requestLogger, errorHandler } from "@aeron/core";
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
const db = createDatabase({ url: 'sqlite://data/abc.db' });

const jwt = createJWT({
  secret: process.env.JWT_SECRET || 'please_change_me_please_change_me',
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

  const valid = await passwordHasher.verify(password, user.password);
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

  const users = await cache.remember("users:all", 300, async () => {
    return db.query(UserModel).select("id", "name", "email").list();
  });

  return ctx.json(users);
});

const app = createApp({ port: 3000 });
app.use(errorHandler());
app.use(requestLogger());
app.use(router);

// 启动前自动建表（示例用；生产环境应使用迁移工具）
await db.raw(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT
  )
`);

app.lifecycle.onAfterStart(() => {
  logger.info("Server started", { port: 3000 });
});

await app.listen();
