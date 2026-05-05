/**
 * @ventostack/core — 标签日志工具
 *
 * 用于启动阶段、CLI、种子脚本等场景的轻量日志，
 * 统一 `[tag] message` 格式，无需初始化 Logger 实例。
 *
 * ```ts
 * const log = createTagLogger("cache");
 * log.info("Using Redis adapter");
 * // → [cache] Using Redis adapter
 * ```
 */

export interface TagLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * 创建带标签的轻量日志器
 * @param tag 日志标签，如 "cache"、"migrations"、"seeds"
 */
export function createTagLogger(tag: string): TagLogger {
  return {
    info(message: string): void {
      console.log(`[${tag}] ${message}`);
    },
    warn(message: string): void {
      console.warn(`[${tag}] ${message}`);
    },
    error(message: string): void {
      console.error(`[${tag}] ${message}`);
    },
  };
}
