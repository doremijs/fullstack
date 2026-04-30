/**
 * @ventostack/monitor - 监控服务测试
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMonitorService } from "../services/monitor";
import { createMockHealthCheck } from "./helpers";

describe("MonitorService", () => {
  let healthCheck: ReturnType<typeof createMockHealthCheck>;
  let service: ReturnType<typeof createMonitorService>;

  beforeEach(() => {
    healthCheck = createMockHealthCheck();
    service = createMonitorService({ healthCheck });
  });

  describe("getServerStatus", () => {
    it("should return server status", async () => {
      const status = await service.getServerStatus();

      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.memory.total).toBeGreaterThan(0);
      expect(status.memory.used).toBeGreaterThan(0);
      expect(status.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(status.memory.usagePercent).toBeLessThanOrEqual(100);
      expect(status.cpu.cores).toBeGreaterThan(0);
      expect(status.cpu.model).toBeTruthy();
      expect(status.cpu.loadAvg.length).toBe(3);
      expect(status.runtime).toContain("Bun");
      expect(status.pid).toBeGreaterThan(0);
    });
  });

  describe("getCacheStats", () => {
    it("should return disconnected when no provider", async () => {
      const stats = await service.getCacheStats();
      expect(stats.connected).toBe(false);
    });

    it("should use provider when available", async () => {
      const provider = async () => ({
        connected: true,
        hits: 100,
        misses: 10,
        hitRate: 90.9,
      });

      service = createMonitorService({ healthCheck, cacheStatsProvider: provider });
      const stats = await service.getCacheStats();
      expect(stats.connected).toBe(true);
      expect(stats.hits).toBe(100);
      expect(stats.misses).toBe(10);
    });
  });

  describe("getDataSourceStatus", () => {
    it("should return disconnected when no provider", async () => {
      const status = await service.getDataSourceStatus();
      expect(status.connected).toBe(false);
    });

    it("should use provider when available", async () => {
      const provider = async () => ({
        connected: true,
        poolSize: 10,
        activeConnections: 3,
        idleConnections: 7,
        waitingCount: 0,
      });

      service = createMonitorService({ healthCheck, dataSourceStatsProvider: provider });
      const status = await service.getDataSourceStatus();
      expect(status.connected).toBe(true);
      expect(status.poolSize).toBe(10);
      expect(status.activeConnections).toBe(3);
    });
  });

  describe("getHealthStatus", () => {
    it("should return health status", async () => {
      const health = await service.getHealthStatus();

      expect(health.status).toBe("ok");
      expect(health.checks).toHaveProperty("database");
      expect(health.checks).toHaveProperty("cache");
      expect(health.uptime).toBe(12345);
      expect(healthCheck.ready).toHaveBeenCalled();
    });

    it("should reflect degraded status", async () => {
      (healthCheck.ready as any).mockResolvedValueOnce({
        status: "degraded",
        checks: {
          database: { status: "ok" },
          cache: { status: "error", message: "Connection refused" },
        },
        uptime: 5000,
      });

      const health = await service.getHealthStatus();
      expect(health.status).toBe("degraded");
      expect(health.checks.cache).toHaveProperty("status", "error");
    });
  });
});
