/**
 * 工作流定义模型
 */

import { defineModel, column } from "@ventostack/database";

export const WorkflowDefModel = defineModel("sys_workflow_definition", {
  id: column.string({ primary: true }),
  name: column.string(),
  code: column.string(),
  version: column.number(),
  description: column.string({ nullable: true }),
  status: column.number(),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
