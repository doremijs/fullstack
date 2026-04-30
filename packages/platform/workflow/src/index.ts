/**
 * @ventostack/workflow — 工作流引擎
 *
 * 流程定义、节点配置、实例流转、审批任务。
 */

// Models
export { WorkflowDefModel } from "./models/definition";
export { WorkflowNodeModel } from "./models/node";
export { WorkflowInstanceModel } from "./models/instance";
export { WorkflowTaskModel } from "./models/task";

// Services
export { createWorkflowService } from "./services/workflow";
export type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowInstance,
  WorkflowTask,
  WorkflowInstanceDetail,
  PaginatedResult,
  WorkflowService,
  WorkflowServiceDeps,
} from "./services/workflow";
export { DefStatus, InstanceStatus, TaskStatus, NodeType } from "./services/workflow";

// Routes
export { createWorkflowRoutes } from "./routes/workflow";

// Module
export { createWorkflowModule } from "./module";
export type { WorkflowModule, WorkflowModuleDeps } from "./module";

// Migrations
export { createWorkflowTables } from "./migrations/001_create_workflow_tables";
