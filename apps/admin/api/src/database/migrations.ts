/**
 * 数据库迁移注册与执行
 */

import { createTagLogger } from "@ventostack/core";
import { createMigrationRunner, type SqlExecutor } from "@ventostack/database";
import { createSysTables } from "./migrations/001_create_sys_tables";
import { addPasswordChangedAt } from "./migrations/003_password_changed_at";

const log = createTagLogger("migrations");

/**
 * 注册并执行所有迁移
 */
export async function runMigrations(executor: SqlExecutor): Promise<void> {
  const runner = createMigrationRunner(executor);

  runner.addMigration(createSysTables);
  runner.addMigration(addPasswordChangedAt);

  const executed = await runner.up();

  if (executed.length > 0) {
    log.info(`Executed: ${executed.join(", ")}`);
  } else {
    log.info("All up to date");
  }
}
