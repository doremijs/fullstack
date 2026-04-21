// @aeron/core - 路由系统

import { type Context, createContext } from "./context";
import { type Middleware, compose } from "./middleware";
import { ValidationError } from "./errors";
import { type ParamType, type ParamTypeMap, isValidParamType, paramTypes } from "./param-constraint";

/** 路由处理器类型 */
export type RouteHandler<TParams extends Record<string, unknown> = Record<string, string>> = (
  ctx: Context<TParams>,
) => Promise<Response> | Response;

type BunRouteHandler = (req: Request) => Response | Promise<Response>;

/** 编译后的路由表类型 */
export type CompiledRoutes = Record<string, BunRouteHandler | Record<string, BunRouteHandler>>;

/** 解析后的路由参数定义 */
export interface ParsedParam {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: ParamType;
  /** 自定义正则表达式 */
  customRegex?: string | undefined;
}

/** 解析后的路由信息 */
export interface ParsedRoute {
  /** 原始路径 */
  originalPath: string;
  /** 去除类型约束后的路径 */
  strippedPath: string;
  /** 参数定义列表 */
  params: ParsedParam[];
}

/** 路由定义 */
export interface RouteDefinition {
  /** HTTP 方法 */
  method: string;
  /** 原始路径 */
  path: string;
  /** 去除类型约束后的路径 */
  strippedPath: string;
  /** 路由处理器 */
  handler: RouteHandler;
  /** 路由级中间件 */
  middleware: Middleware[];
  /** 路由元数据（如 OpenAPI 信息） */
  metadata?: Record<string, unknown>;
  /** 参数定义列表 */
  params: ParsedParam[];
}

/** REST 资源处理器集合 */
export interface ResourceHandlers {
  /** 列表查询 */
  index?: RouteHandler;
  /** 详情查询 */
  show?: RouteHandler;
  /** 创建 */
  create?: RouteHandler;
  /** 更新 */
  update?: RouteHandler;
  /** 删除 */
  destroy?: RouteHandler;
}

/** 类型推导工具：从路径字符串字面量提取参数类型 */
export type InferParams<Path extends string> =
  Path extends `${infer _Start}:${infer Name}<${infer Type}>${infer Rest}`
    ? { [K in Name]: ParamTypeMap[Type extends ParamType ? Type : "string"] } & InferParams<Rest>
    : Path extends `${infer _Start}:${infer Name}${infer Rest}`
      ? { [K in Name]: string } & InferParams<Rest>
      : Record<string, never>;

const PARAM_REGEX = /:([a-zA-Z_][a-zA-Z0-9_]*)<([^>]+)>(?:\(([^)]+)\))?/g;

/**
 * 解析路由路径，提取参数名、类型及自定义正则
 * @param path - 路由路径，如 /users/:id<int>
 * @returns 解析后的路由信息
 */
export function parseRoutePath(path: string): ParsedRoute {
  const params: ParsedParam[] = [];
  const replacements: Array<{ start: number; end: number; name: string }> = [];

  let match: RegExpExecArray | null;
  // Reset regex state
  PARAM_REGEX.lastIndex = 0;

  while ((match = PARAM_REGEX.exec(path)) !== null) {
    const name = match[1]!;
    const type = match[2]!;
    const customRegex = match[3];
    if (!isValidParamType(type)) {
      throw new Error(`Unknown param type "${type}" in route "${path}"`);
    }
    params.push({ name, type: type as ParamType, customRegex });
    replacements.push({ start: match.index, end: match.index + match[0].length, name });
  }

  let stripped = "";
  let lastIndex = 0;
  for (const r of replacements) {
    stripped += path.slice(lastIndex, r.start) + `:${r.name}`;
    lastIndex = r.end;
  }
  stripped += path.slice(lastIndex);

  return {
    originalPath: path,
    strippedPath: stripped,
    params,
  };
}

/**
 * 将原始字符串参数按类型约束进行校验与转换
 * @param raw - 原始参数字符串对象
 * @param paramDefs - 参数定义列表
 * @returns 转换后的参数对象
 */
function coerceParams(
  raw: Record<string, string>,
  paramDefs: ParsedParam[],
): Record<string, unknown> {
  const coerced: Record<string, unknown> = { ...raw };

  for (const def of paramDefs) {
    const rawValue = raw[def.name];
    if (rawValue === undefined) continue;

    const typeDef = paramTypes[def.type];
    const pattern = def.customRegex ? new RegExp(`^(?:${def.customRegex})$`) : typeDef.pattern;

    if (!pattern.test(rawValue)) {
      throw new ValidationError(
        `Invalid value for param ":${def.name}": ${typeDef.message ?? "does not match expected format"}`,
      );
    }

    coerced[def.name] = typeDef.coerce(rawValue);
  }

  return coerced;
}

/** 路由器接口 */
export interface Router {
  /**
   * 注册 GET 路由
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  get<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  /**
   * 注册 POST 路由
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  post<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  /**
   * 注册 PUT 路由
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  put<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  /**
   * 注册 PATCH 路由
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  patch<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  /**
   * 注册 DELETE 路由
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  delete<Path extends string>(path: Path, handler: RouteHandler<InferParams<Path>>, ...middleware: Middleware[]): Router;
  /**
   * 创建路由分组
   * @param prefix - 分组前缀
   * @param callback - 分组路由注册回调
   * @param middleware - 分组中间件
   */
  group(prefix: string, callback: (group: Router) => void, ...middleware: Middleware[]): Router;
  /**
   * 注册全局中间件
   * @param middleware - 中间件列表
   */
  use(...middleware: Middleware[]): Router;
  /**
   * 注册 REST 资源路由
   * @param prefix - 资源前缀
   * @param handlers - 资源处理器
   * @param middleware - 可选中间件
   */
  resource(prefix: string, handlers: ResourceHandlers, ...middleware: Middleware[]): Router;
  /**
   * 注册命名路由
   * @param name - 路由名称
   * @param method - HTTP 方法
   * @param path - 路径
   * @param handler - 处理器
   * @param middleware - 可选中间件
   */
  namedRoute(
    name: string,
    method: string,
    path: string,
    handler: RouteHandler,
    ...middleware: Middleware[]
  ): Router;
  /**
   * 根据命名路由生成 URL
   * @param name - 路由名称
   * @param params - 路径参数
   * @returns 生成的 URL 路径
   */
  url(name: string, params?: Record<string, string>): string;
  /** 获取所有路由定义 */
  routes(): readonly RouteDefinition[];
  /**
   * 编译路由为 Bun 可识别的格式
   * @param globalMiddleware - 全局中间件
   */
  compile(globalMiddleware?: Middleware[]): CompiledRoutes;
  /**
   * 为已有路由附加元数据（如 OpenAPI 文档信息）
   * @param method - HTTP 方法
   * @param path - 路径
   * @param metadata - 元数据对象
   */
  doc(method: string, path: string, metadata: Record<string, unknown>): Router;
  /**
   * 将另一个 Router 的路由合并到当前 Router
   * @param router - 要合并的路由器
   */
  merge(router: Router): Router;
}

/**
 * 创建路由器实例
 * @returns Router 实例
 */
export function createRouter(): Router {
  const routeDefs: RouteDefinition[] = [];
  const routerMiddleware: Middleware[] = [];
  const namedRoutes = new Map<string, string>();

  function addRoute(
    method: string,
    path: string,
    handler: RouteHandler,
    middleware: Middleware[],
  ): Router {
    const parsed = parseRoutePath(path);
    routeDefs.push({
      method: method.toUpperCase(),
      path,
      strippedPath: parsed.strippedPath,
      handler,
      middleware,
      params: parsed.params,
    });
    return router;
  }

  const router: Router = {
    get: (path, handler, ...mw) => addRoute("GET", path, handler as RouteHandler, mw),
    post: (path, handler, ...mw) => addRoute("POST", path, handler as RouteHandler, mw),
    put: (path, handler, ...mw) => addRoute("PUT", path, handler as RouteHandler, mw),
    patch: (path, handler, ...mw) => addRoute("PATCH", path, handler as RouteHandler, mw),
    delete: (path, handler, ...mw) => addRoute("DELETE", path, handler as RouteHandler, mw),

    group(prefix, callback, ...groupMiddleware) {
      const subRouter = createRouter();
      callback(subRouter);
      for (const route of subRouter.routes()) {
        routeDefs.push({
          ...route,
          path: prefix + route.path,
          strippedPath: prefix + route.strippedPath,
          middleware: [...groupMiddleware, ...route.middleware],
        });
      }
      return router;
    },

    use(...mw) {
      routerMiddleware.push(...mw);
      return router;
    },

    resource(prefix, handlers, ...mw) {
      if (handlers.index) {
        addRoute("GET", prefix, handlers.index, mw);
      }
      if (handlers.create) {
        addRoute("POST", prefix, handlers.create, mw);
      }
      if (handlers.show) {
        addRoute("GET", `${prefix}/:id`, handlers.show, mw);
      }
      if (handlers.update) {
        addRoute("PUT", `${prefix}/:id`, handlers.update, mw);
      }
      if (handlers.destroy) {
        addRoute("DELETE", `${prefix}/:id`, handlers.destroy, mw);
      }
      return router;
    },

    namedRoute(name, method, path, handler, ...mw) {
      if (namedRoutes.has(name)) {
        throw new Error(`Route name "${name}" is already registered`);
      }
      const parsed = parseRoutePath(path);
      namedRoutes.set(name, parsed.strippedPath);
      addRoute(method.toUpperCase(), path, handler, mw);
      return router;
    },

    url(name, params) {
      const path = namedRoutes.get(name);
      if (path === undefined) {
        throw new Error(`Route name "${name}" not found`);
      }
      if (!params) {
        return path;
      }
      let result = path;
      for (const [key, value] of Object.entries(params)) {
        result = result.replace(`:${key}`, value);
      }
      return result;
    },

    routes(): readonly RouteDefinition[] {
      return routeDefs.map((route) => ({
        ...route,
        middleware: [...routerMiddleware, ...route.middleware],
      }));
    },

    doc(method: string, path: string, metadata: Record<string, unknown>): Router {
      const upper = method.toUpperCase();
      const target = routeDefs.find((r) => r.method === upper && r.path === path);
      if (target) {
        target.metadata = { ...target.metadata, ...metadata };
      }
      return router;
    },

    merge(other: Router): Router {
      for (const route of other.routes()) {
        const entry: RouteDefinition = {
          method: route.method,
          path: route.path,
          strippedPath: route.strippedPath,
          handler: route.handler,
          middleware: route.middleware,
          params: route.params,
        };
        if (route.metadata !== undefined) {
          entry.metadata = route.metadata;
        }
        routeDefs.push(entry);
      }
      return router;
    },

    compile(globalMiddleware: Middleware[] = []): CompiledRoutes {
      const finalRoutes = router.routes();

      // 路由冲突检测（基于 strippedPath）
      const seen = new Set<string>();
      for (const route of finalRoutes) {
        const key = `${route.method} ${route.strippedPath || "/"}`;
        if (seen.has(key)) {
          throw new Error(`Duplicate route detected: ${route.method} ${route.strippedPath || "/"}`);
        }
        seen.add(key);
      }

      const compiled: Record<string, Record<string, BunRouteHandler>> = {};

      for (const route of finalRoutes) {
        const path = route.strippedPath || "/";
        if (!compiled[path]) {
          compiled[path] = {};
        }

        const allMiddleware = [...globalMiddleware, ...route.middleware];

        compiled[path]![route.method] = (req: Request): Promise<Response> => {
          const rawParams = (req as Request & { params?: Record<string, string> }).params ?? {};
          let coerced: Record<string, unknown>;
          try {
            coerced = coerceParams(rawParams, route.params);
          } catch (err) {
            if (err instanceof ValidationError) {
              return Promise.resolve(
                new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: err.message }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                }),
              );
            }
            throw err;
          }
          const ctx = createContext(req, coerced) as Context<Record<string, string>>;

          if (allMiddleware.length === 0) {
            return Promise.resolve(route.handler(ctx));
          }

          return compose(allMiddleware)(ctx, () => Promise.resolve(route.handler(ctx)));
        };
      }

      return compiled as CompiledRoutes;
    },
  };

  return router;
}
