/**
 * 工作流节点模型
 */

import { defineModel, column } from "@ventostack/database";

export const WorkflowNodeModel = defineModel("sys_workflow_node", {
  id: column.string({ primary: true }),
  definitionId: column.string(),
  name: column.string(),
  type: column.string(),
  assigneeType: column.string({ nullable: true }),
  assigneeId: column.string({ nullable: true }),
  sort: column.number(),
  config: column.json({ nullable: true }),
  createdAt: column.string(),
}, { timestamps: true });
