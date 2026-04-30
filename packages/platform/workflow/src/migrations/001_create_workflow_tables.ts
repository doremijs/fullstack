/**
 * 创建工作流相关表
 */

import type { Migration } from "@ventostack/database";

export const createWorkflowTables: Migration = {
  name: "001_create_workflow_tables",
  up: async (executor) => {
    await executor(`
      CREATE TABLE IF NOT EXISTS sys_workflow_definition (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) NOT NULL,
        version INT DEFAULT 1,
        description TEXT,
        status SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_wf_def_code
      ON sys_workflow_definition(code)
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_workflow_node (
        id VARCHAR(36) PRIMARY KEY,
        definition_id VARCHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL,
        type VARCHAR(32) NOT NULL,
        assignee_type VARCHAR(16),
        assignee_id VARCHAR(36),
        sort INT DEFAULT 0,
        config JSON,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE INDEX IF NOT EXISTS idx_sys_wf_node_def
      ON sys_workflow_node(definition_id)
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_workflow_instance (
        id VARCHAR(36) PRIMARY KEY,
        definition_id VARCHAR(36) NOT NULL,
        business_type VARCHAR(64),
        business_id VARCHAR(36),
        initiator_id VARCHAR(36) NOT NULL,
        current_node_id VARCHAR(36),
        status SMALLINT DEFAULT 0,
        variables JSON,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_workflow_task (
        id VARCHAR(36) PRIMARY KEY,
        instance_id VARCHAR(36) NOT NULL,
        node_id VARCHAR(36) NOT NULL,
        assignee_id VARCHAR(36) NOT NULL,
        action VARCHAR(16),
        comment TEXT,
        status SMALLINT DEFAULT 0,
        acted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE INDEX IF NOT EXISTS idx_sys_wf_task_instance
      ON sys_workflow_task(instance_id)
    `);

    await executor(`
      CREATE INDEX IF NOT EXISTS idx_sys_wf_task_assignee
      ON sys_workflow_task(assignee_id)
    `);
  },
  down: async (executor) => {
    await executor(`DROP TABLE IF EXISTS sys_workflow_task`);
    await executor(`DROP TABLE IF EXISTS sys_workflow_instance`);
    await executor(`DROP TABLE IF EXISTS sys_workflow_node`);
    await executor(`DROP TABLE IF EXISTS sys_workflow_definition`);
  },
};
