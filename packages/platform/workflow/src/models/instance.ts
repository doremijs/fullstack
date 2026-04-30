/**
 * 工作流实例模型
 */

import { defineModel, column } from "@ventostack/database";

export const WorkflowInstanceModel = defineModel("sys_workflow_instance", {
  id: column.string({ primary: true }),
  definitionId: column.string(),
  businessType: column.string({ nullable: true }),
  businessId: column.string({ nullable: true }),
  initiatorId: column.string(),
  currentNodeId: column.string({ nullable: true }),
  status: column.number(),
  variables: column.json({ nullable: true }),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
