// @aeron/database
export { createDatabase } from "./database";
export type { Database, DatabaseConfig, QueryExecutor, SqlExecutor } from "./database";
export { defineModel, column } from "./model";
export type { ModelDefinition, ColumnDef, ColumnOptions, ModelOptions } from "./model";
export { createQueryBuilder } from "./query-builder";
export type {
  QueryBuilder,
  WhereCondition,
  OrderByClause,
  HavingCondition,
  VersionClause,
} from "./query-builder";
export { createMigrationRunner } from "./migration";
export type { Migration, MigrationRunner, MigrationStatus } from "./migration";
export { defineRelation, buildJoinSQL, buildEagerLoadSQL } from "./relation";
export type { RelationDefinition, RelationType } from "./relation";
export { createSeedRunner } from "./seed";
export type { Seed, SeedRunner } from "./seed";

export { createTransactionManager } from "./transaction";
export type { TransactionManager, TransactionOptions } from "./transaction";

export { createDriverAdapter } from "./driver";
export type { DatabaseDriver, DriverConfig, DriverAdapter } from "./driver";

export { createReadWriteSplit } from "./read-write-split";
export type {
  ReadWriteSplitOptions,
  ReadWriteSplitExecutor,
  MultiDataSourceOptions,
  MultiDataSource,
} from "./read-write-split";

export { createConnectionPool } from "./connection-pool";
export type { ConnectionPool, ConnectionPoolOptions, PoolStats } from "./connection-pool";

export type { SchemaDiff, TableDiff, ColumnSchema, TableSchema, ColumnDiff } from "./schema-diff";
