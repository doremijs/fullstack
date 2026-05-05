/**
 * 缓存层初始化
 */

import { createTagLogger } from "@ventostack/core";
import { RedisClient } from "bun";
import { createCache, createMemoryAdapter, createRedisAdapter } from "@ventostack/cache";
import type { Cache } from "@ventostack/cache";
import { env } from "../config";

const log = createTagLogger("cache");

export type { Cache };

export interface CacheInstance {
  cache: Cache;
  /** Redis 客户端引用（仅 redis 驱动时存在，用于健康检查） */
  redisClient?: { get(key: string): Promise<unknown> };
  /** 优雅关闭连接 */
  close(): Promise<void>;
}

/**
 * 创建缓存实例
 * 支持 memory（开发/测试）和 redis（生产）两种驱动
 */
export async function createCacheInstance(): Promise<CacheInstance> {
  switch (env.CACHE_DRIVER) {
    case "redis": {
      const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";
      const client = new RedisClient(redisUrl);
      const cache = createCache(createRedisAdapter({ client, keyPrefix: "admin:" }));
      log.info(`Using Redis adapter (${redisUrl})`);
      return {
        cache,
        redisClient: client,
        close: () => client.send("QUIT", []).then(() => {}, () => {}),
      };
    }
    case "memory":
    default: {
      log.info("Using memory adapter");
      return {
        cache: createCache(createMemoryAdapter()),
        close: async () => {},
      };
    }
  }
}
