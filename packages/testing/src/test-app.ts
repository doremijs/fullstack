/**
 * @aeron/testing - 测试应用工具
 * 提供测试应用启动、随机端口分配与生命周期管理能力
 */

import type { AeronApp } from "@aeron/core";

/** 测试应用实例接口 */
export interface TestAppInstance {
  /** Aeron 应用实例 */
  readonly app: AeronApp;
  /** 监听端口 */
  readonly port: number;
  /** 基础访问 URL */
  readonly baseUrl: string;
  /**
   * 关闭测试应用
   */
  close(): Promise<void>;
}

/**
 * 查找可用随机端口
 * 通过启动临时 Bun 服务获取系统分配的端口
 * @returns 可用端口号
 */
async function findFreePort(): Promise<number> {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response("");
    },
  });
  const port = server.port ?? 0;
  server.stop(true);
  return port;
}

/**
 * 创建测试应用实例
 * 自动分配随机端口并启动应用，提供基础 URL 与关闭能力
 * @param app Aeron 应用实例
 * @returns 测试应用实例
 */
export async function createTestApp(app: AeronApp): Promise<TestAppInstance> {
  const port = await findFreePort();
  await app.listen(port);

  return {
    app,
    port,
    baseUrl: `http://localhost:${port}`,
    async close() {
      await app.close();
    },
  };
}
