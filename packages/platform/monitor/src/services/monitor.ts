/**
 * @ventostack/monitor - 系统监控服务
 *
 * 纯运行时聚合，无数据库表。
 */

import type { HealthCheck, HealthStatus } from "@ventostack/observability";

/** 在线用户 */
export interface OnlineUser {
  userId: string;
  username: string;
  loginAt: number;
  lastActiveAt: number;
  ip: string;
}

/** 服务器状态 */
export interface ServerStatus {
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  cpu: {
    cores: number;
    model: string;
    loadAvg: number[];
  };
  runtime: string;
  pid: number;
}

/** 缓存统计 */
export interface CacheStats {
  connected: boolean;
  keys?: number;
  hits?: number;
  misses?: number;
  hitRate?: number;
  memoryUsed?: string;
}

/** 数据源状态 */
export interface DataSourceStatus {
  connected: boolean;
  poolSize?: number;
  activeConnections?: number;
  idleConnections?: number;
  waitingCount?: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 监控服务接口 */
export interface MonitorService {
  getServerStatus(): Promise<ServerStatus>;
  getCacheStats(): Promise<CacheStats>;
  getDataSourceStatus(): Promise<DataSourceStatus>;
  getHealthStatus(): Promise<HealthStatus>;
}

/** 监控服务依赖 */
export interface MonitorServiceDeps {
  healthCheck: HealthCheck;
  cacheStatsProvider?: () => Promise<CacheStats>;
  dataSourceStatsProvider?: () => Promise<DataSourceStatus>;
}

export function createMonitorService(deps: MonitorServiceDeps): MonitorService {
  const { healthCheck, cacheStatsProvider, dataSourceStatsProvider } = deps;

  return {
    async getServerStatus() {
      const mem = process.memoryUsage();
      const totalMem = mem.heapTotal;
      const usedMem = mem.heapUsed;

      // Use os module via Bun for system memory
      let systemTotal = 0;
      let systemFree = 0;
      try {
        const os = await import("node:os");
        systemTotal = os.totalmem();
        systemFree = os.freemem();
      } catch {
        // fallback to process memory
        systemTotal = totalMem;
        systemFree = totalMem - usedMem;
      }

      const systemUsed = systemTotal - systemFree;

      // CPU info
      let cpuModel = "unknown";
      let cpuCores = 1;
      try {
        const os = await import("node:os");
        const cpus = os.cpus();
        cpuCores = cpus.length;
        cpuModel = cpus[0]?.model ?? "unknown";
      } catch {
        // ignore
      }

      return {
        uptime: Math.floor(process.uptime()),
        memory: {
          total: systemTotal,
          free: systemFree,
          used: systemUsed,
          usagePercent: systemTotal > 0 ? Math.round((systemUsed / systemTotal) * 100) : 0,
        },
        cpu: {
          cores: cpuCores,
          model: cpuModel,
          loadAvg: (() => {
            try {
              const os = require("node:os") as { loadavg: () => number[] };
              return os.loadavg();
            } catch {
              return [0, 0, 0];
            }
          })(),
        },
        runtime: `Bun ${Bun.version}`,
        pid: process.pid,
      };
    },

    async getCacheStats() {
      if (cacheStatsProvider) {
        return cacheStatsProvider();
      }
      return { connected: false };
    },

    async getDataSourceStatus() {
      if (dataSourceStatsProvider) {
        return dataSourceStatsProvider();
      }
      return { connected: false };
    },

    async getHealthStatus() {
      return healthCheck.ready();
    },
  };
}
