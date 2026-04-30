/**
 * 工作流任务模型
 */

import { defineModel, column } from "@ventostack/database";

export const WorkflowTaskModel = defineModel("sys_workflow_task", {
  id: column.string({ primary: true }),
  instanceId: column.string(),
  nodeId: column.string(),
  assigneeId: column.string(),
  action: column.string({ nullable: true }),
  comment: column.string({ nullable: true }),
  status: column.number(),
  actedAt: column.string({ nullable: true }),
  createdAt: column.string(),
}, { timestamps: true });
