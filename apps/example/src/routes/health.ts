import type { Router } from "@aeron/core";
import type { HealthCheck } from "@aeron/observability";

export function registerHealthRoutes(router: Router, health: HealthCheck): void {
  router.get("/health/live", (ctx) => {
    return ctx.json(health.live());
  });

  router.get("/health/ready", async (ctx) => {
    const status = await health.ready();
    const code = status.status === "ok" ? 200 : 503;
    return ctx.json(status, code);
  });
}
