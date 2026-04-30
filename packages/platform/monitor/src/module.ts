/**
 * @ventostack/monitor - 模块聚合
 */

import type { JWTManager, RBAC } from "@ventostack/auth";
import type { Router } from "@ventostack/core";
import type { HealthCheck } from "@ventostack/observability";
import { createMonitorService } from "./services/monitor";
import type { MonitorService, CacheStats, DataSourceStatus } from "./services/monitor";
import { createMonitorRoutes } from "./routes/monitor";
import { createAuthMiddleware } from "./middlewares/auth-guard";

export interface MonitorModule {
  services: {
    monitor: MonitorService;
  };
  router: Router;
  init(): Promise<void>;
}

export interface MonitorModuleDeps {
  healthCheck: HealthCheck;
  jwt: JWTManager;
  jwtSecret: string;
  rbac?: RBAC;
  cacheStatsProvider?: () => Promise<CacheStats>;
  dataSourceStatsProvider?: () => Promise<DataSourceStatus>;
}

export function createMonitorModule(deps: MonitorModuleDeps): MonitorModule {
  const { healthCheck, jwt, jwtSecret, rbac, cacheStatsProvider, dataSourceStatsProvider } = deps;

  const monitorService = createMonitorService({ healthCheck, cacheStatsProvider, dataSourceStatsProvider });
  const authMiddleware = createAuthMiddleware(jwt, jwtSecret);

  const perm = (resource: string, action: string) => {
    return async (ctx: any, next: any) => {
      const user = ctx.user as { roles: string[] } | undefined;
      if (!user) {
        return new Response(JSON.stringify({ code: 401, message: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      if (rbac) {
        const allowed = user.roles.some((r: string) => rbac.hasPermission(r, resource, action));
        if (!allowed) {
          return new Response(JSON.stringify({ code: 403, message: `No permission: ${resource}:${action}` }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
      }
      return next();
    };
  };

  const router = createMonitorRoutes(monitorService, authMiddleware, perm as any);

  return {
    services: { monitor: monitorService },
    router,
    async init() {},
  };
}
