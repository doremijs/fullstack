/**
 * @ventostack/monitor - 测试辅助工具
 */

import { mock } from "bun:test";
import type { HealthCheck, HealthStatus } from "@ventostack/observability";

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

/** 创建 Mock HealthCheck */
export function createMockHealthCheck(): HealthCheck {
  return {
    addCheck: mock((_name: string, _checker: () => Promise<boolean | string>) => {}),
    live: mock(() => ({ status: "ok" as const })),
    ready: mock(async (): Promise<HealthStatus> => ({
      status: "ok",
      checks: {
        database: { status: "ok", duration: 5 },
        cache: { status: "ok", duration: 2 },
      },
      uptime: 12345,
    })),
  };
}
