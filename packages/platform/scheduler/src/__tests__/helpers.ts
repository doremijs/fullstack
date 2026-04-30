/**
 * @ventostack/scheduler - 测试辅助工具
 */

import { mock } from "bun:test";
import type { Scheduler, ScheduledTask } from "@ventostack/events";

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

/** 创建 Mock Scheduler */
export function createMockScheduler(): Scheduler & { _tasks: Map<string, ScheduledTask> } {
  const tasks: ScheduledTask[] = [];

  return {
    _tasks: new Map(),
    schedule: mock((options: any, handler: any) => {
      const task: ScheduledTask = {
        name: options.name,
        running: true,
        stop: mock(() => { (task as any).running = false; }),
      };
      tasks.push(task);
      return task;
    }),
    stopAll: mock(() => {
      for (const t of tasks) t.stop();
    }),
    list: mock(() => tasks),
  };
}
