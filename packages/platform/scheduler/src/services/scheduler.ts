/**
 * @ventostack/scheduler - 定时任务管理服务
 *
 * 对接 @ventostack/events 的 Scheduler，提供 DB 持久化、任务 CRUD、执行日志。
 */

import type { SqlExecutor } from "@ventostack/database";
import type { Scheduler } from "@ventostack/events";

/** 任务状态枚举 */
export const JobStatus = { PAUSED: 0, RUNNING: 1 } as const;

/** 日志状态枚举 */
export const LogStatus = { FAILED: 0, SUCCESS: 1, RUNNING: 2 } as const;

/** 创建任务参数 */
export interface CreateJobParams {
  name: string;
  handlerId: string;
  cron?: string;
  params?: Record<string, unknown>;
  description?: string;
}

/** 任务详情 */
export interface ScheduleJob {
  id: string;
  name: string;
  handlerId: string;
  cron: string | null;
  params: Record<string, unknown> | null;
  status: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 任务日志 */
export interface ScheduleJobLog {
  id: string;
  jobId: string;
  startAt: string;
  endAt: string | null;
  status: number;
  result: string | null;
  error: string | null;
  durationMs: number | null;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 任务处理器注册表 */
export type JobHandlerMap = Record<string, (params?: Record<string, unknown>) => Promise<void> | void>;

/** 调度服务接口 */
export interface SchedulerService {
  create(params: CreateJobParams): Promise<{ id: string }>;
  update(id: string, params: Partial<CreateJobParams>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<ScheduleJob | null>;
  list(params?: { status?: number; page?: number; pageSize?: number }): Promise<PaginatedResult<ScheduleJob>>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  executeNow(id: string): Promise<void>;
  listLogs(params: { jobId?: string; status?: number; page?: number; pageSize?: number }): Promise<PaginatedResult<ScheduleJobLog>>;
}

export function createSchedulerService(deps: {
  executor: SqlExecutor;
  scheduler: Scheduler;
  handlers: JobHandlerMap;
}): SchedulerService {
  const { executor, scheduler, handlers } = deps;

  /** In-memory map of running scheduled tasks: jobId -> ScheduledTask */
  const runningTasks = new Map<string, { stop: () => void }>();

  async function writeLog(jobId: string, status: number, result?: string, error?: string, durationMs?: number) {
    await executor(
      `INSERT INTO sys_schedule_job_log (id, job_id, start_at, end_at, status, result, error, duration_ms)
       VALUES ($1, $2, NOW(), NOW(), $3, $4, $5, $6)`,
      [crypto.randomUUID(), jobId, status, result ?? null, error ?? null, durationMs ?? null],
    );
  }

  function getInterval(cron: string | undefined): number {
    if (!cron) return 60_000;
    // Simple cron-to-interval parsing (matches events/scheduler.ts logic)
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return 60_000;
    const [minute, hour] = parts;
    if (minute?.startsWith("*/")) {
      const n = Number.parseInt(minute.slice(2), 10);
      if (n > 0) return n * 60_000;
    }
    if (minute === "0" && hour !== undefined && hour.startsWith("*/")) {
      const n = Number.parseInt(hour.slice(2), 10);
      if (n > 0) return n * 3_600_000;
    }
    if (minute === "*" && hour === "*") return 60_000;
    if (minute === "0" && hour === "*") return 3_600_000;
    if (minute === "0" && hour === "0") return 86_400_000;
    return 60_000;
  }

  async function scheduleJob(job: ScheduleJob) {
    const handler = handlers[job.handlerId];
    if (!handler) return;

    const task = scheduler.schedule(
      {
        name: job.name,
        interval: getInterval(job.cron ?? undefined),
        onBeforeExecute: async () => {
          await writeLog(job.id, LogStatus.RUNNING);
        },
        onAfterExecute: async ({ duration }) => {
          // Update last log entry
          await executor(
            `UPDATE sys_schedule_job_log SET end_at = NOW(), status = $1, duration_ms = $2
             WHERE job_id = $3 AND status = $4 ORDER BY start_at DESC LIMIT 1`,
            [LogStatus.SUCCESS, duration, job.id, LogStatus.RUNNING],
          );
        },
        onError: async ({ error, duration }) => {
          await executor(
            `UPDATE sys_schedule_job_log SET end_at = NOW(), status = $1, error = $2, duration_ms = $3
             WHERE job_id = $4 AND status = $5 ORDER BY start_at DESC LIMIT 1`,
            [LogStatus.FAILED, error.message, duration, job.id, LogStatus.RUNNING],
          );
        },
      },
      async () => {
        const params = job.params as Record<string, unknown> | null ?? undefined;
        await handler(params);
      },
    );

    runningTasks.set(job.id, task);
  }

  return {
    async create(params) {
      const id = crypto.randomUUID();
      const { name, handlerId, cron, params: jobParams, description } = params;

      await executor(
        `INSERT INTO sys_schedule_job (id, name, handler_id, cron, params, status, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, $6, NOW(), NOW())`,
        [id, name, handlerId, cron ?? null, jobParams ? JSON.stringify(jobParams) : null, description ?? null],
      );

      return { id };
    },

    async update(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.name !== undefined) { fields.push(`name = $${idx++}`); values.push(params.name); }
      if (params.handlerId !== undefined) { fields.push(`handler_id = $${idx++}`); values.push(params.handlerId); }
      if (params.cron !== undefined) { fields.push(`cron = $${idx++}`); values.push(params.cron); }
      if (params.params !== undefined) { fields.push(`params = $${idx++}`); values.push(JSON.stringify(params.params)); }
      if (params.description !== undefined) { fields.push(`description = $${idx++}`); values.push(params.description); }

      if (fields.length === 0) return;

      fields.push(`updated_at = NOW()`);
      values.push(id);

      await executor(`UPDATE sys_schedule_job SET ${fields.join(", ")} WHERE id = $${idx}`, values);

      // If running, restart with new config
      const existing = runningTasks.get(id);
      if (existing) {
        existing.stop();
        runningTasks.delete(id);
        const job = await getByIdRaw(executor, id);
        if (job && job.status === JobStatus.RUNNING) {
          await scheduleJob(job);
        }
      }
    },

    async delete(id) {
      const existing = runningTasks.get(id);
      if (existing) {
        existing.stop();
        runningTasks.delete(id);
      }
      await executor(`DELETE FROM sys_schedule_job_log WHERE job_id = $1`, [id]);
      await executor(`DELETE FROM sys_schedule_job WHERE id = $1`, [id]);
    },

    async getById(id) {
      return getByIdRaw(executor, id);
    },

    async list(params) {
      const { status, page = 1, pageSize = 10 } = params ?? {};
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (status !== undefined) {
        conditions.push(`status = $${idx++}`);
        values.push(status);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_schedule_job ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_schedule_job ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToJob);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async start(id) {
      await executor(`UPDATE sys_schedule_job SET status = $1, updated_at = NOW() WHERE id = $2`, [JobStatus.RUNNING, id]);

      const job = await getByIdRaw(executor, id);
      if (job) await scheduleJob(job);
    },

    async stop(id) {
      await executor(`UPDATE sys_schedule_job SET status = $1, updated_at = NOW() WHERE id = $2`, [JobStatus.PAUSED, id]);

      const existing = runningTasks.get(id);
      if (existing) {
        existing.stop();
        runningTasks.delete(id);
      }
    },

    async executeNow(id) {
      const job = await getByIdRaw(executor, id);
      if (!job) throw new Error("Job not found");

      const handler = handlers[job.handlerId];
      if (!handler) throw new Error(`Handler "${job.handlerId}" not registered`);

      const startMs = Date.now();
      await writeLog(id, LogStatus.RUNNING);
      try {
        const params = job.params as Record<string, unknown> | null ?? undefined;
        await handler(params);
        const duration = Date.now() - startMs;
        await executor(
          `UPDATE sys_schedule_job_log SET end_at = NOW(), status = $1, duration_ms = $2
           WHERE job_id = $3 AND status = $4 ORDER BY start_at DESC LIMIT 1`,
          [LogStatus.SUCCESS, duration, id, LogStatus.RUNNING],
        );
      } catch (err) {
        const duration = Date.now() - startMs;
        await executor(
          `UPDATE sys_schedule_job_log SET end_at = NOW(), status = $1, error = $2, duration_ms = $3
           WHERE job_id = $4 AND status = $5 ORDER BY start_at DESC LIMIT 1`,
          [LogStatus.FAILED, (err as Error).message, duration, id, LogStatus.RUNNING],
        );
        throw err;
      }
    },

    async listLogs(params) {
      const { jobId, status, page = 1, pageSize = 10 } = params;
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (jobId) { conditions.push(`job_id = $${idx++}`); values.push(jobId); }
      if (status !== undefined) { conditions.push(`status = $${idx++}`); values.push(status); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_schedule_job_log ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_schedule_job_log ${where} ORDER BY start_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToLog);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },
  };
}

/** Helper: fetch a job by ID from DB */
async function getByIdRaw(executor: SqlExecutor, id: string): Promise<ScheduleJob | null> {
  const rows = await executor(`SELECT * FROM sys_schedule_job WHERE id = $1`, [id]);
  const jobs = rows as Array<Record<string, unknown>>;
  if (jobs.length === 0) return null;
  return rowToJob(jobs[0]!);
}

function rowToJob(row: Record<string, unknown>): ScheduleJob {
  return {
    id: row.id as string,
    name: row.name as string,
    handlerId: row.handler_id as string,
    cron: (row.cron as string) ?? null,
    params: row.params ? JSON.parse(row.params as string) : null,
    status: row.status as number,
    description: (row.description as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToLog(row: Record<string, unknown>): ScheduleJobLog {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    startAt: row.start_at as string,
    endAt: (row.end_at as string) ?? null,
    status: row.status as number,
    result: (row.result as string) ?? null,
    error: (row.error as string) ?? null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
  };
}
