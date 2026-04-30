/**
 * @ventostack/oss - 测试辅助工具
 */

import { mock } from "bun:test";
import type { StorageAdapter } from "../adapters/storage";

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

/** 创建 Mock 存储适配器 */
export function createMockStorage(): StorageAdapter & { _files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();

  return {
    _files: files,
    write: mock(async (key: string, data: Buffer | ReadableStream, _contentType?: string) => {
      if (data instanceof Buffer) {
        files.set(key, data);
      } else {
        const chunks: Uint8Array[] = [];
        const reader = data.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        files.set(key, Buffer.concat(chunks));
      }
    }),
    read: mock(async (key: string) => {
      const buf = files.get(key);
      if (!buf) return null;
      return new Blob([buf]).stream();
    }),
    delete: mock(async (key: string) => {
      files.delete(key);
    }),
    exists: mock(async (key: string) => {
      return files.has(key);
    }),
    getSignedUrl: mock(async (key: string, expiresIn?: number) => {
      return `https://example.com/files/${key}?expires=${expiresIn ?? 3600}`;
    }),
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
