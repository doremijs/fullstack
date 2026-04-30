/**
 * @ventostack/monitor - 监控路由
 */

import { createRouter } from "@ventostack/core";
import type { Middleware, Router } from "@ventostack/core";
import type { MonitorService } from "../services/monitor";
import { ok, fail } from "./common";

export function createMonitorRoutes(
  monitorService: MonitorService,
  authMiddleware: Middleware,
  perm: (resource: string, action: string) => Middleware,
): Router {
  const router = createRouter();
  router.use(authMiddleware);

  // 服务器状态
  router.get("/api/monitor/server", perm("monitor", "server:query"), async () => {
    const status = await monitorService.getServerStatus();
    return ok(status);
  });

  // 缓存统计
  router.get("/api/monitor/cache", perm("monitor", "cache:query"), async () => {
    const stats = await monitorService.getCacheStats();
    return ok(stats);
  });

  // 数据源状态
  router.get("/api/monitor/datasource", perm("monitor", "datasource:query"), async () => {
    const status = await monitorService.getDataSourceStatus();
    return ok(status);
  });

  // 健康检查
  router.get("/api/monitor/health", async () => {
    const health = await monitorService.getHealthStatus();
    return ok(health);
  });

  return router;
}
