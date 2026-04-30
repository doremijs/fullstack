/**
 * 创建通知相关表
 */

import type { Migration } from "@ventostack/database";

export const createNotifyTables: Migration = {
  name: "001_create_notify_tables",
  up: async (executor) => {
    await executor(`
      CREATE TABLE IF NOT EXISTS sys_notify_template (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) NOT NULL,
        channel VARCHAR(32) NOT NULL,
        title VARCHAR(256),
        content TEXT NOT NULL,
        status SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_notify_tpl_code_channel
      ON sys_notify_template(code, channel)
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_notify_message (
        id VARCHAR(36) PRIMARY KEY,
        template_id VARCHAR(36),
        channel VARCHAR(32) NOT NULL,
        receiver_id VARCHAR(36) NOT NULL,
        title VARCHAR(256),
        content TEXT NOT NULL,
        variables JSON,
        status SMALLINT DEFAULT 0,
        retry_count INT DEFAULT 0,
        send_at TIMESTAMP,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE INDEX IF NOT EXISTS idx_sys_notify_msg_receiver
      ON sys_notify_message(receiver_id)
    `);

    await executor(`
      CREATE INDEX IF NOT EXISTS idx_sys_notify_msg_status
      ON sys_notify_message(status)
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_notify_user_read (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        message_id VARCHAR(36) NOT NULL,
        read_at TIMESTAMP NOT NULL
      )
    `);

    await executor(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_notify_read_user_msg
      ON sys_notify_user_read(user_id, message_id)
    `);
  },
  down: async (executor) => {
    await executor(`DROP TABLE IF EXISTS sys_notify_user_read`);
    await executor(`DROP TABLE IF EXISTS sys_notify_message`);
    await executor(`DROP TABLE IF EXISTS sys_notify_template`);
  },
};
