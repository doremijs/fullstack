/**
 * @ventostack/notify - 测试辅助工具
 */

import { mock } from "bun:test";
import type { NotifyChannel } from "../services/notification";

/** 创建 Mock SqlExecutor */
export function createMockExecutor() {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const results: Map<string, unknown[]> = new Map();

  const executor = mock(async (text: string, params?: unknown[]): Promise<unknown[]> => {
    calls.push({ text, params });
    for (const [pattern, result] of results) {
      if (text.includes(pattern)) return result;
    }
    return [];
  });

  return { executor, calls, results };
}

/** 创建 Mock 通知通道 */
export function createMockChannel(name: string): NotifyChannel & { _sent: Array<{ to: string; title: string; content: string }> } {
  const sent: Array<{ to: string; title: string; content: string }> = [];
  return {
    _sent: sent,
    name,
    send: mock(async (params) => {
      sent.push(params);
      return { success: true };
    }),
  };
}

/** 创建失败的 Mock 通知通道 */
export function createFailingChannel(name: string): NotifyChannel {
  return {
    name,
    send: mock(async () => ({ success: false, error: "Channel error" })),
  };
}

/** 创建 Mock JWTManager */
export function createMockJWTManager() {
  return {
    sign: mock(async (payload: any) =>
      Buffer.from(JSON.stringify(payload)).toString("base64url") + ".mocksig"
    ),
    verify: mock(async (token: string) => {
      const payload = JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString());
      return payload;
    }),
    decode: mock((token: string) => {
      try {
        return JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString());
      } catch {
        return null;
      }
    }),
  };
}
