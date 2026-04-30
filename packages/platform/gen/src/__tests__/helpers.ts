/**
 * @ventostack/gen - 测试辅助工具
 */

import { mock } from "bun:test";

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

/** 创建 Mock readTableSchema */
export function createMockReadTableSchema() {
  return mock(async (_executor: any, tableName: string) => ({
    tableName,
    columns: [
      { name: "id", type: "VARCHAR(36)", isPrimary: true, nullable: false, comment: "主键" },
      { name: "name", type: "VARCHAR(128)", isPrimary: false, nullable: false, comment: "名称" },
      { name: "description", type: "TEXT", isPrimary: false, nullable: true, comment: "描述" },
      { name: "status", type: "SMALLINT", isPrimary: false, nullable: false, comment: "状态" },
      { name: "created_at", type: "TIMESTAMP", isPrimary: false, nullable: false, comment: null },
    ],
    indexes: [],
  }));
}
