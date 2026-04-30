import { defineModel, column } from '@ventostack/database';

export const ScheduleJobLogModel = defineModel('sys_schedule_job_log', {
  id: column.varchar({ primary: true, length: 36 }),
  jobId: column.varchar({ length: 36 }),
  startAt: column.timestamp(),
  endAt: column.timestamp({ nullable: true }),
  status: column.int(),
  result: column.text({ nullable: true }),
  error: column.text({ nullable: true }),
  durationMs: column.int({ nullable: true }),
}, { timestamps: false });
