/**
 * 创建国际化相关表
 */

import type { Migration } from "@ventostack/database";

export const createI18nTables: Migration = {
  name: "001_create_i18n_tables",
  up: async (executor) => {
    await executor(`
      CREATE TABLE IF NOT EXISTS sys_i18n_locale (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(16) NOT NULL,
        name VARCHAR(64) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        status SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_i18n_locale_code
      ON sys_i18n_locale(code)
    `);

    await executor(`
      CREATE TABLE IF NOT EXISTS sys_i18n_message (
        id VARCHAR(36) PRIMARY KEY,
        locale VARCHAR(16) NOT NULL,
        code VARCHAR(256) NOT NULL,
        value TEXT NOT NULL,
        module VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await executor(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_i18n_msg_locale_code
      ON sys_i18n_message(locale, code)
    `);
  },
  down: async (executor) => {
    await executor(`DROP TABLE IF EXISTS sys_i18n_message`);
    await executor(`DROP TABLE IF EXISTS sys_i18n_locale`);
  },
};
