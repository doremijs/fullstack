/**
 * @ventostack/oss - 模块聚合
 */

import { createRouter } from "@ventostack/core";
import type { Router } from "@ventostack/core";
import type { SqlExecutor } from "@ventostack/database";
import type { JWTManager, RBAC } from "@ventostack/auth";
import type { StorageAdapter } from "./adapters/storage";
import { createOSSService } from "./services/oss";
import { createOSSRoutes } from "./routes/oss";
import { createAuthMiddleware } from "./middlewares/auth-guard";

export interface OSSModule {
  services: {
    oss: ReturnType<typeof createOSSService>;
  };
  router: Router;
  init(): Promise<void>;
}

export interface OSSModuleDeps {
  executor: SqlExecutor;
  storage: StorageAdapter;
  jwt: JWTManager;
  jwtSecret: string;
  rbac?: RBAC;
}

export function createOSSModule(deps: OSSModuleDeps): OSSModule {
  const { executor, storage, jwt, jwtSecret, rbac } = deps;

  const ossService = createOSSService({ executor, storage });
  const authMiddleware = createAuthMiddleware(jwt, jwtSecret);

  // Permission middleware — integrates with RBAC if provided
  const perm = (resource: string, action: string) => {
    return async (ctx: any, next: any) => {
      const user = ctx.user as { roles: string[] } | undefined;
      if (!user) {
        return new Response(
          JSON.stringify({ code: 401, message: "Not authenticated" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      if (rbac) {
        const allowed = user.roles.some((r: string) => rbac.hasPermission(r, resource, action));
        if (!allowed) {
          return new Response(
            JSON.stringify({ code: 403, message: `No permission: ${resource}:${action}` }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      return next();
    };
  };

  const router = createOSSRoutes(ossService, authMiddleware, perm as any);

  return {
    services: { oss: ossService },
    router,
    async init() {
      // No initialization needed
    },
  };
}
