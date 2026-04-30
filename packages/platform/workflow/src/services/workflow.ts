/**
 * @ventostack/workflow - 工作流服务
 */

import type { SqlExecutor } from "@ventostack/database";

/** 定义状态 */
export const DefStatus = {
  DRAFT: 0,
  ACTIVE: 1,
  DISABLED: 2,
} as const;

/** 实例状态 */
export const InstanceStatus = {
  RUNNING: 0,
  COMPLETED: 1,
  REJECTED: 2,
  CANCELLED: 3,
} as const;

/** 任务状态 */
export const TaskStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

/** 节点类型 */
export const NodeType = {
  START: "start",
  END: "end",
  APPROVE: "approve",
  NOTIFY: "notify",
  CONDITION: "condition",
} as const;

/** 工作流定义 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  code: string;
  version: number;
  description: string | null;
  status: number;
}

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  definitionId: string;
  name: string;
  type: string;
  assigneeType: string | null;
  assigneeId: string | null;
  sort: number;
  config: Record<string, unknown> | null;
}

/** 工作流实例 */
export interface WorkflowInstance {
  id: string;
  definitionId: string;
  businessType: string | null;
  businessId: string | null;
  initiatorId: string;
  currentNodeId: string | null;
  status: number;
  variables: Record<string, unknown> | null;
  createdAt: string;
}

/** 工作流任务 */
export interface WorkflowTask {
  id: string;
  instanceId: string;
  nodeId: string;
  assigneeId: string;
  action: string | null;
  comment: string | null;
  status: number;
  actedAt: string | null;
  createdAt: string;
}

/** 实例详情 */
export interface WorkflowInstanceDetail {
  instance: WorkflowInstance;
  nodes: WorkflowNode[];
  tasks: WorkflowTask[];
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 工作流服务接口 */
export interface WorkflowService {
  // Definition CRUD
  createDefinition(params: { name: string; code: string; description?: string }): Promise<{ id: string }>;
  updateDefinition(id: string, params: Partial<{ name: string; description: string; status: number }>): Promise<void>;
  deleteDefinition(id: string): Promise<void>;
  getDefinition(id: string): Promise<WorkflowDefinition | null>;
  listDefinitions(params?: { status?: number; page?: number; pageSize?: number }): Promise<PaginatedResult<WorkflowDefinition>>;

  // Node management
  setNodes(definitionId: string, nodes: Array<{ name: string; type: string; assigneeType?: string; assigneeId?: string; sort?: number; config?: Record<string, unknown> }>): Promise<void>;
  getNodes(definitionId: string): Promise<WorkflowNode[]>;

  // Instance operations
  startInstance(params: {
    definitionId: string;
    initiatorId: string;
    businessType?: string;
    businessId?: string;
    variables?: Record<string, unknown>;
  }): Promise<{ instanceId: string }>;

  approveTask(taskId: string, userId: string, comment?: string): Promise<void>;
  rejectTask(taskId: string, userId: string, comment?: string): Promise<void>;

  // Query
  getMyTasks(userId: string, params?: { status?: number; page?: number; pageSize?: number }): Promise<PaginatedResult<WorkflowTask>>;
  getInstanceDetail(instanceId: string): Promise<WorkflowInstanceDetail | null>;
}

export interface WorkflowServiceDeps {
  executor: SqlExecutor;
}

export function createWorkflowService(deps: WorkflowServiceDeps): WorkflowService {
  const { executor } = deps;

  return {
    async createDefinition(params) {
      const id = crypto.randomUUID();
      await executor(
        `INSERT INTO sys_workflow_definition (id, name, code, version, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, 1, $4, ${DefStatus.ACTIVE}, NOW(), NOW())`,
        [id, params.name, params.code, params.description ?? null],
      );
      return { id };
    },

    async updateDefinition(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.name !== undefined) { fields.push(`name = $${idx++}`); values.push(params.name); }
      if (params.description !== undefined) { fields.push(`description = $${idx++}`); values.push(params.description); }
      if (params.status !== undefined) { fields.push(`status = $${idx++}`); values.push(params.status); }

      if (fields.length === 0) return;
      fields.push("updated_at = NOW()");
      values.push(id);
      await executor(`UPDATE sys_workflow_definition SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    },

    async deleteDefinition(id) {
      // Delete nodes, instances, and tasks
      await executor(`DELETE FROM sys_workflow_task WHERE instance_id IN (SELECT id FROM sys_workflow_instance WHERE definition_id = $1)`, [id]);
      await executor(`DELETE FROM sys_workflow_instance WHERE definition_id = $1`, [id]);
      await executor(`DELETE FROM sys_workflow_node WHERE definition_id = $1`, [id]);
      await executor(`DELETE FROM sys_workflow_definition WHERE id = $1`, [id]);
    },

    async getDefinition(id) {
      const rows = await executor(`SELECT * FROM sys_workflow_definition WHERE id = $1`, [id]);
      const defs = rows as Array<Record<string, unknown>>;
      if (defs.length === 0) return null;
      return rowToDefinition(defs[0]!);
    },

    async listDefinitions(params) {
      const { status, page = 1, pageSize = 10 } = params ?? {};

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (status !== undefined) { conditions.push(`status = $${idx++}`); values.push(status); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_workflow_definition ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_workflow_definition ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToDefinition);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async setNodes(definitionId, nodes) {
      // Delete existing nodes
      await executor(`DELETE FROM sys_workflow_node WHERE definition_id = $1`, [definitionId]);

      // Insert new nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        const id = crypto.randomUUID();
        await executor(
          `INSERT INTO sys_workflow_node (id, definition_id, name, type, assignee_type, assignee_id, sort, config, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [id, definitionId, node.name, node.type, node.assigneeType ?? null, node.assigneeId ?? null, node.sort ?? i, node.config ? JSON.stringify(node.config) : null],
        );
      }
    },

    async getNodes(definitionId) {
      const rows = await executor(
        `SELECT * FROM sys_workflow_node WHERE definition_id = $1 ORDER BY sort`,
        [definitionId],
      );
      return (rows as Array<Record<string, unknown>>).map(rowToNode);
    },

    async startInstance(params) {
      const instanceId = crypto.randomUUID();

      // Get nodes to find start node
      const nodes = await this.getNodes(params.definitionId);
      if (nodes.length === 0) throw new Error("No nodes defined");

      const startNode = nodes.find(n => n.type === NodeType.START);
      if (!startNode) throw new Error("No start node found");

      // Find next node after start
      const startIdx = nodes.indexOf(startNode);
      const nextNode = nodes[startIdx + 1];

      await executor(
        `INSERT INTO sys_workflow_instance (id, definition_id, business_type, business_id, initiator_id, current_node_id, status, variables, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, ${InstanceStatus.RUNNING}, $7, NOW(), NOW())`,
        [instanceId, params.definitionId, params.businessType ?? null, params.businessId ?? null, params.initiatorId, nextNode?.id ?? null, params.variables ? JSON.stringify(params.variables) : null],
      );

      // Create first task if there's an approve node
      if (nextNode && nextNode.type === NodeType.APPROVE) {
        const taskId = crypto.randomUUID();
        await executor(
          `INSERT INTO sys_workflow_task (id, instance_id, node_id, assignee_id, status, created_at)
           VALUES ($1, $2, $3, $4, ${TaskStatus.PENDING}, NOW())`,
          [taskId, instanceId, nextNode.id, nextNode.assigneeId ?? ""],
        );
      }

      return { instanceId };
    },

    async approveTask(taskId, userId, comment) {
      // Get task
      const taskRows = await executor(`SELECT * FROM sys_workflow_task WHERE id = $1`, [taskId]);
      const tasks = taskRows as Array<Record<string, unknown>>;
      if (tasks.length === 0) throw new Error("Task not found");
      const task = tasks[0]!;

      if (task.status !== TaskStatus.PENDING) {
        throw new Error("Task already processed");
      }

      // Update task
      await executor(
        `UPDATE sys_workflow_task SET status = ${TaskStatus.APPROVED}, action = 'approve', comment = $1, acted_at = NOW() WHERE id = $2`,
        [comment ?? null, taskId],
      );

      // Move to next node
      await advanceInstance(executor, task.instance_id as string, task.node_id as string);
    },

    async rejectTask(taskId, userId, comment) {
      const taskRows = await executor(`SELECT * FROM sys_workflow_task WHERE id = $1`, [taskId]);
      const tasks = taskRows as Array<Record<string, unknown>>;
      if (tasks.length === 0) throw new Error("Task not found");
      const task = tasks[0]!;

      if (task.status !== TaskStatus.PENDING) {
        throw new Error("Task already processed");
      }

      // Update task
      await executor(
        `UPDATE sys_workflow_task SET status = ${TaskStatus.REJECTED}, action = 'reject', comment = $1, acted_at = NOW() WHERE id = $2`,
        [comment ?? null, taskId],
      );

      // Mark instance as rejected
      await executor(
        `UPDATE sys_workflow_instance SET status = ${InstanceStatus.REJECTED}, updated_at = NOW() WHERE id = $1`,
        [task.instance_id],
      );
    },

    async getMyTasks(userId, params) {
      const { status, page = 1, pageSize = 10 } = params ?? {};

      const conditions = [`assignee_id = $1`];
      const values: unknown[] = [userId];
      let idx = 2;

      if (status !== undefined) { conditions.push(`status = $${idx++}`); values.push(status); }

      const where = `WHERE ${conditions.join(" AND ")}`;

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_workflow_task ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_workflow_task ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToTask);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async getInstanceDetail(instanceId) {
      const instanceRows = await executor(`SELECT * FROM sys_workflow_instance WHERE id = $1`, [instanceId]);
      const instances = instanceRows as Array<Record<string, unknown>>;
      if (instances.length === 0) return null;

      const instance = rowToInstance(instances[0]!);
      const nodes = await this.getNodes(instance.definitionId);

      const taskRows = await executor(
        `SELECT * FROM sys_workflow_task WHERE instance_id = $1 ORDER BY created_at`,
        [instanceId],
      );
      const tasks = (taskRows as Array<Record<string, unknown>>).map(rowToTask);

      return { instance, nodes, tasks };
    },
  };
}

/** Advance to next node after approval */
async function advanceInstance(executor: SqlExecutor, instanceId: string, currentNodeId: string) {
  // Get instance
  const instanceRows = await executor(`SELECT * FROM sys_workflow_instance WHERE id = $1`, [instanceId]);
  const instances = instanceRows as Array<Record<string, unknown>>;
  if (instances.length === 0) return;
  const instance = instances[0]!;

  // Get all nodes for this definition
  const nodeRows = await executor(
    `SELECT * FROM sys_workflow_node WHERE definition_id = $1 ORDER BY sort`,
    [instance.definition_id],
  );
  const nodes = nodeRows as Array<Record<string, unknown>>;

  // Find current node index
  const currentIdx = nodes.findIndex(n => n.id === currentNodeId);
  if (currentIdx === -1) return;

  const nextNode = nodes[currentIdx + 1];

  if (!nextNode || nextNode.type === NodeType.END) {
    // Workflow completed
    await executor(
      `UPDATE sys_workflow_instance SET status = ${InstanceStatus.COMPLETED}, current_node_id = $1, updated_at = NOW() WHERE id = $2`,
      [nextNode?.id ?? null, instanceId],
    );
    return;
  }

  // Update current node
  await executor(
    `UPDATE sys_workflow_instance SET current_node_id = $1, updated_at = NOW() WHERE id = $2`,
    [nextNode.id, instanceId],
  );

  // Create task for next approve node
  if (nextNode.type === NodeType.APPROVE) {
    const taskId = crypto.randomUUID();
    await executor(
      `INSERT INTO sys_workflow_task (id, instance_id, node_id, assignee_id, status, created_at)
       VALUES ($1, $2, $3, $4, ${TaskStatus.PENDING}, NOW())`,
      [taskId, instanceId, nextNode.id, nextNode.assignee_id ?? ""],
    );
  }

  // For notify nodes, just advance again
  if (nextNode.type === NodeType.NOTIFY) {
    await advanceInstance(executor, instanceId, nextNode.id as string);
  }
}

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    version: row.version as number,
    description: (row.description as string) ?? null,
    status: row.status as number,
  };
}

function rowToNode(row: Record<string, unknown>): WorkflowNode {
  return {
    id: row.id as string,
    definitionId: row.definition_id as string,
    name: row.name as string,
    type: row.type as string,
    assigneeType: (row.assignee_type as string) ?? null,
    assigneeId: (row.assignee_id as string) ?? null,
    sort: row.sort as number,
    config: (row.config as Record<string, unknown>) ?? null,
  };
}

function rowToInstance(row: Record<string, unknown>): WorkflowInstance {
  return {
    id: row.id as string,
    definitionId: row.definition_id as string,
    businessType: (row.business_type as string) ?? null,
    businessId: (row.business_id as string) ?? null,
    initiatorId: row.initiator_id as string,
    currentNodeId: (row.current_node_id as string) ?? null,
    status: row.status as number,
    variables: (row.variables as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToTask(row: Record<string, unknown>): WorkflowTask {
  return {
    id: row.id as string,
    instanceId: row.instance_id as string,
    nodeId: row.node_id as string,
    assigneeId: row.assignee_id as string,
    action: (row.action as string) ?? null,
    comment: (row.comment as string) ?? null,
    status: row.status as number,
    actedAt: (row.acted_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}
