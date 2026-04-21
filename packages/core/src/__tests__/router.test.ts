import { describe, expect, test } from "bun:test";
import type { Middleware } from "../middleware";
import { createRouter, parseRoutePath } from "../router";

type RouteHandler = (req: Request) => Response | Promise<Response>;

describe("createRouter", () => {
  test("registers GET route", () => {
    const router = createRouter();
    const handler = async () => new Response("ok");
    router.get("/users", handler);

    const routes = router.routes();
    expect(routes).toHaveLength(1);
    expect(routes[0]!.method).toBe("GET");
    expect(routes[0]!.path).toBe("/users");
    expect(routes[0]!.strippedPath).toBe("/users");
  });

  test("registers POST route", () => {
    const router = createRouter();
    router.post("/users", async () => new Response("ok"));
    expect(router.routes()[0]!.method).toBe("POST");
  });

  test("registers PUT route", () => {
    const router = createRouter();
    router.put("/users/:id", async () => new Response("ok"));
    expect(router.routes()[0]!.method).toBe("PUT");
    expect(router.routes()[0]!.path).toBe("/users/:id");
  });

  test("registers PATCH route", () => {
    const router = createRouter();
    router.patch("/users/:id", async () => new Response("ok"));
    expect(router.routes()[0]!.method).toBe("PATCH");
  });

  test("registers DELETE route", () => {
    const router = createRouter();
    router.delete("/users/:id", async () => new Response("ok"));
    expect(router.routes()[0]!.method).toBe("DELETE");
  });

  test("method chaining works", () => {
    const router = createRouter();
    const result = router
      .get("/a", async () => new Response("a"))
      .post("/b", async () => new Response("b"));

    expect(result).toBe(router);
    expect(router.routes()).toHaveLength(2);
  });
});

describe("Router.use()", () => {
  test("router middleware applies to all routes", () => {
    const calls: string[] = [];
    const mw: Middleware = async (_ctx, next) => {
      calls.push("router-mw");
      return await next();
    };

    const router = createRouter();
    router.use(mw);
    router.get("/a", async (ctx) => ctx.text("a"));

    const routes = router.routes();
    expect(routes[0]!.middleware).toHaveLength(1);
  });

  test("router middleware + route middleware combine", () => {
    const routerMw: Middleware = async (_ctx, next) => await next();
    const routeMw: Middleware = async (_ctx, next) => await next();

    const router = createRouter();
    router.use(routerMw);
    router.get("/a", async (ctx) => ctx.text("a"), routeMw);

    const routes = router.routes();
    // router middleware + route middleware
    expect(routes[0]!.middleware).toHaveLength(2);
  });
});

describe("Router.group()", () => {
  test("prefixes paths in group", () => {
    const router = createRouter();
    router.group("/api", (group) => {
      group.get("/users", async () => new Response("users"));
      group.post("/users", async () => new Response("create"));
    });

    const routes = router.routes();
    expect(routes).toHaveLength(2);
    expect(routes[0]!.path).toBe("/api/users");
    expect(routes[1]!.path).toBe("/api/users");
    expect(routes[0]!.strippedPath).toBe("/api/users");
    expect(routes[0]!.method).toBe("GET");
    expect(routes[1]!.method).toBe("POST");
  });

  test("group middleware applies to grouped routes", () => {
    const groupMw: Middleware = async (_ctx, next) => await next();

    const router = createRouter();
    router.group(
      "/api",
      (group) => {
        group.get("/health", async (ctx) => ctx.text("ok"));
      },
      groupMw,
    );

    const routes = router.routes();
    expect(routes[0]!.middleware).toContain(groupMw);
  });

  test("nested groups accumulate prefixes", () => {
    const router = createRouter();
    router.group("/api", (api) => {
      api.group("/v1", (v1) => {
        v1.get("/users", async () => new Response("ok"));
      });
    });

    expect(router.routes()[0]!.path).toBe("/api/v1/users");
    expect(router.routes()[0]!.strippedPath).toBe("/api/v1/users");
  });

  test("sub-router middleware included in group routes", () => {
    const subMw: Middleware = async (_ctx, next) => await next();
    const groupMw: Middleware = async (_ctx, next) => await next();

    const router = createRouter();
    router.group(
      "/api",
      (group) => {
        group.use(subMw);
        group.get("/users", async (ctx) => ctx.text("ok"));
      },
      groupMw,
    );

    const routes = router.routes();
    // group middleware + sub-router middleware
    expect(routes[0]!.middleware).toHaveLength(2);
    expect(routes[0]!.middleware[0]).toBe(groupMw);
    expect(routes[0]!.middleware[1]).toBe(subMw);
  });

  test("group returns router for chaining", () => {
    const router = createRouter();
    const result = router.group("/api", () => {});
    expect(result).toBe(router);
  });
});

describe("Router.compile()", () => {
  test("compiles routes to Bun.serve format", () => {
    const router = createRouter();
    router.get("/health", async (ctx) => ctx.text("ok"));
    router.post("/users", async (ctx) => ctx.json({ id: 1 }));

    const compiled = router.compile();

    expect(compiled["/health"]).toBeDefined();
    expect(compiled["/users"]).toBeDefined();
    expect(typeof (compiled["/health"] as Record<string, unknown>).GET).toBe("function");
    expect(typeof (compiled["/users"] as Record<string, unknown>).POST).toBe("function");
  });

  test("compiled handler creates context and returns response", async () => {
    const router = createRouter();
    router.get("/hello", (ctx) => ctx.json({ message: "hello" }));

    const compiled = router.compile();
    const handler = (compiled["/hello"] as Record<string, RouteHandler>).GET!;

    const req = new Request("http://localhost:3000/hello");
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "hello" });
  });

  test("compiled handler passes params from request", async () => {
    const router = createRouter();
    router.get("/users/:id", (ctx) => ctx.json({ id: ctx.params.id }));

    const compiled = router.compile();
    const handler = (compiled["/users/:id"] as Record<string, RouteHandler>).GET!;

    // Simulate Bun.serve adding params to request
    const req = new Request("http://localhost:3000/users/42");
    Object.defineProperty(req, "params", { value: { id: "42" } });

    const res = await handler(req);
    expect(await res.json()).toEqual({ id: "42" });
  });

  test("compiled handler runs middleware", async () => {
    const calls: string[] = [];
    const mw: Middleware = async (_ctx, next) => {
      calls.push("mw");
      return await next();
    };

    const router = createRouter();
    router.get(
      "/test",
      (ctx) => {
        calls.push("handler");
        return ctx.text("ok");
      },
      mw,
    );

    const compiled = router.compile();
    const handler = (compiled["/test"] as Record<string, RouteHandler>).GET!;
    await handler(new Request("http://localhost:3000/test"));

    expect(calls).toEqual(["mw", "handler"]);
  });

  test("compiled handler runs global middleware", async () => {
    const calls: string[] = [];
    const globalMw: Middleware = async (_ctx, next) => {
      calls.push("global");
      return await next();
    };

    const router = createRouter();
    router.get("/test", (ctx) => {
      calls.push("handler");
      return ctx.text("ok");
    });

    const compiled = router.compile([globalMw]);
    const handler = (compiled["/test"] as Record<string, RouteHandler>).GET!;
    await handler(new Request("http://localhost:3000/test"));

    expect(calls).toEqual(["global", "handler"]);
  });

  test("multiple methods on same path compile to method object", () => {
    const router = createRouter();
    router.get("/users", async (ctx) => ctx.json([]));
    router.post("/users", async (ctx) => ctx.json({ id: 1 }, 201));

    const compiled = router.compile();
    const methods = compiled["/users"] as Record<string, RouteHandler>;
    expect(typeof methods.GET).toBe("function");
    expect(typeof methods.POST).toBe("function");
  });

  test("handler without middleware skips compose", async () => {
    const router = createRouter();
    router.get("/fast", (ctx) => ctx.text("fast"));

    const compiled = router.compile();
    const handler = (compiled["/fast"] as Record<string, RouteHandler>).GET!;
    const res = await handler(new Request("http://localhost:3000/fast"));
    expect(await res.text()).toBe("fast");
  });
});

describe("parseRoutePath", () => {
  test("parses typed param", () => {
    const parsed = parseRoutePath("/users/:id<int>");
    expect(parsed.strippedPath).toBe("/users/:id");
    expect(parsed.params).toHaveLength(1);
    expect(parsed.params[0]).toEqual({ name: "id", type: "int" });
  });

  test("parses typed param with custom regex", () => {
    const parsed = parseRoutePath("/users/:year<int>(\\d{4})");
    expect(parsed.strippedPath).toBe("/users/:year");
    expect(parsed.params[0]).toEqual({ name: "year", type: "int", customRegex: "\\d{4}" });
  });

  test("parses multiple typed params", () => {
    const parsed = parseRoutePath("/users/:id<int>/posts/:slug<string>");
    expect(parsed.strippedPath).toBe("/users/:id/posts/:slug");
    expect(parsed.params).toHaveLength(2);
    expect(parsed.params[0]).toEqual({ name: "id", type: "int" });
    expect(parsed.params[1]).toEqual({ name: "slug", type: "string" });
  });

  test("leaves untyped params unchanged", () => {
    const parsed = parseRoutePath("/users/:id");
    expect(parsed.strippedPath).toBe("/users/:id");
    expect(parsed.params).toHaveLength(0);
  });

  test("throws on unknown param type", () => {
    expect(() => parseRoutePath("/users/:id<bigint>")).toThrow('Unknown param type "bigint"');
  });
});

describe("Router - typed params runtime coercion", () => {
  test("coerces int param to number", async () => {
    const router = createRouter();
    router.get("/users/:id<int>", (ctx) => ctx.json({ id: ctx.params.id, type: typeof ctx.params.id }));

    const compiled = router.compile();
    const handler = (compiled["/users/:id"] as Record<string, RouteHandler>).GET!;

    const req = new Request("http://localhost:3000/users/42");
    Object.defineProperty(req, "params", { value: { id: "42" } });

    const res = await handler(req);
    expect(await res.json()).toEqual({ id: 42, type: "number" });
  });

  test("coerces bool param to boolean", async () => {
    const router = createRouter();
    router.get("/flags/:enabled<bool>", (ctx) => ctx.json({ enabled: ctx.params.enabled, type: typeof ctx.params.enabled }));

    const compiled = router.compile();
    const handler = (compiled["/flags/:enabled"] as Record<string, RouteHandler>).GET!;

    const req = new Request("http://localhost:3000/flags/true");
    Object.defineProperty(req, "params", { value: { enabled: "true" } });

    const res = await handler(req);
    expect(await res.json()).toEqual({ enabled: true, type: "boolean" });
  });

  test("coerces date param to Date", async () => {
    const router = createRouter();
    router.get("/events/:at<date>", (ctx) => ctx.json({ at: (ctx.params.at as Date).toISOString() }));

    const compiled = router.compile();
    const handler = (compiled["/events/:at"] as Record<string, RouteHandler>).GET!;

    const req = new Request("http://localhost:3000/events/2024-01-15T10:30:00Z");
    Object.defineProperty(req, "params", { value: { at: "2024-01-15T10:30:00Z" } });

    const res = await handler(req);
    expect(await res.json()).toEqual({ at: "2024-01-15T10:30:00.000Z" });
  });

  test("returns 400 for invalid int value", async () => {
    const router = createRouter();
    router.get("/users/:id<int>", (ctx) => ctx.json({ id: ctx.params.id }));

    const compiled = router.compile();
    const handler = (compiled["/users/:id"] as Record<string, RouteHandler>).GET!;

    const req = new Request("http://localhost:3000/users/abc");
    Object.defineProperty(req, "params", { value: { id: "abc" } });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  test("uses custom regex for validation", async () => {
    const router = createRouter();
    router.get("/users/:code<string>(^[A-Z]{2}$)", (ctx) => ctx.json({ code: ctx.params.code }));

    const compiled = router.compile();
    const handler = (compiled["/users/:code"] as Record<string, RouteHandler>).GET!;

    const reqOk = new Request("http://localhost:3000/users/AB");
    Object.defineProperty(reqOk, "params", { value: { code: "AB" } });
    const resOk = await handler(reqOk);
    expect(resOk.status).toBe(200);

    const reqBad = new Request("http://localhost:3000/users/ab");
    Object.defineProperty(reqBad, "params", { value: { code: "ab" } });
    const resBad = await handler(reqBad);
    expect(resBad.status).toBe(400);
  });
});

describe("Router - duplicate detection with stripped paths", () => {
  test("throws for same stripped path with different types", () => {
    const router = createRouter();
    router.get("/users/:id<int>", (ctx) => ctx.json({ id: ctx.params.id }));
    router.get("/users/:id<string>", (ctx) => ctx.json({ id: ctx.params.id }));

    expect(() => router.compile()).toThrow("Duplicate route detected: GET /users/:id");
  });

  test("allows same path with different methods even with types", () => {
    const router = createRouter();
    router.get("/users/:id<int>", (ctx) => ctx.json({ id: ctx.params.id }));
    router.post("/users/:id<int>", (ctx) => ctx.json({ id: ctx.params.id }));

    expect(() => router.compile()).not.toThrow();
  });
});
