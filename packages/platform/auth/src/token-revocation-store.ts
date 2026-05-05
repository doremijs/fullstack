/**
 * @ventostack/auth - Token Revocation Store
 * 提供 Token 吊销状态存储的抽象接口，支持内存与 Redis 实现
 * 内存实现适用于开发环境，Redis 实现适用于生产环境
 */

/**
 * Token 吊销状态存储接口
 * 定义吊销 Token JTI 的添加与查询能力
 */
export interface TokenRevocationStore {
  /**
   * 将指定 JTI 加入吊销列表
   * @param jti JWT ID
   * @param ttl 存活时间（毫秒），过期后自动清理
   */
  add(jti: string, ttl: number): Promise<void>;

  /**
   * 判断指定 JTI 是否已被吊销
   * @param jti JWT ID
   * @returns 已吊销返回 true，否则返回 false
   */
  has(jti: string): Promise<boolean>;
}

/**
 * Redis Token 吊销存储客户端最小接口
 * 基于 Bun.RedisClient 设计
 */
export interface RedisRevocationClientLike {
  /** 设置键值 */
  set(key: string, value: string): Promise<unknown>;
  /** 设置键的过期时间（毫秒），返回是否设置成功 */
  pexpire(key: string, milliseconds: number): Promise<number>;
  /** 判断键是否存在 */
  exists(key: string): Promise<boolean>;
}

/**
 * 创建内存 Token 吊销存储实例
 * 基于 Map 实现，支持 TTL 过期检查与清理
 * 适用于开发环境或单实例部署
 * @returns 内存 Token 吊销存储实例
 */
export function createMemoryRevocationStore(): TokenRevocationStore {
  const revoked = new Map<string, number>();

  return {
    async add(jti: string, ttl: number): Promise<void> {
      const expiry = Date.now() + ttl;
      revoked.set(jti, expiry);
    },

    async has(jti: string): Promise<boolean> {
      const expiry = revoked.get(jti);
      if (!expiry) return false;

      if (expiry <= Date.now()) {
        revoked.delete(jti);
        return false;
      }

      return true;
    },
  };
}

/**
 * 创建 Redis Token 吊销存储实例
 * 基于 Redis SET + PEXPIRE 实现 TTL 自动过期
 * 适用于生产环境与分布式部署
 *
 * @example
 * ```typescript
 * import { createRedisRevocationStore } from "@ventostack/auth";
 * import { RedisClient } from "bun";
 *
 * const redis = new RedisClient("redis://localhost:6379");
 * const store = createRedisRevocationStore(redis, "token_revocation:");
 * ```
 *
 * @param client Redis 客户端实例
 * @param prefix 键前缀，默认 "token_revocation:"
 * @returns Redis Token 吊销存储实例
 */
export function createRedisRevocationStore(
  client: RedisRevocationClientLike,
  prefix = "token_revocation:",
): TokenRevocationStore {
  return {
    async add(jti: string, ttl: number): Promise<void> {
      const key = `${prefix}${jti}`;
      await client.set(key, "1");
      await client.pexpire(key, ttl);
    },

    async has(jti: string): Promise<boolean> {
      return client.exists(`${prefix}${jti}`);
    },
  };
}
