/**
 * @ventostack/gen - 代码生成服务
 *
 * 导入数据库表结构、管理字段配置、生成代码。
 */

import type { SqlExecutor } from "@ventostack/database";
import type { TableSchemaInfo, ColumnSchemaInfo } from "@ventostack/database";
import { renderModel } from "../templates/model.ts.tmpl";
import { renderService } from "../templates/service.ts.tmpl";
import { renderRoutes } from "../templates/routes.ts.tmpl";
import { renderTypes } from "../templates/types.ts.tmpl";
import { renderTest } from "../templates/test.ts.tmpl";

/** 导入的表信息 */
export interface GenTableInfo {
  id: string;
  tableName: string;
  className: string;
  moduleName: string;
  functionName: string;
  functionAuthor: string | null;
  remark: string | null;
  status: number;
}

/** 导入的列信息 */
export interface GenColumnInfo {
  id: string;
  tableId: string;
  columnName: string;
  columnType: string;
  typescriptType: string;
  fieldName: string;
  fieldComment: string | null;
  isPrimary: boolean;
  isNullable: boolean;
  isList: boolean;
  isInsert: boolean;
  isUpdate: boolean;
  isQuery: boolean;
  queryType: string | null;
  sort: number;
}

/** 生成的文件 */
export interface GeneratedFile {
  filename: string;
  content: string;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 代码生成服务接口 */
export interface GenService {
  importTable(tableName: string, moduleName: string, author?: string): Promise<{ tableId: string }>;
  updateTable(id: string, params: Partial<Pick<GenTableInfo, "className" | "moduleName" | "functionName" | "functionAuthor" | "remark">>): Promise<void>;
  updateColumn(id: string, params: Partial<Pick<GenColumnInfo, "isList" | "isInsert" | "isUpdate" | "isQuery" | "queryType" | "fieldComment">>): Promise<void>;
  getTable(id: string): Promise<GenTableInfo | null>;
  listTables(params?: { page?: number; pageSize?: number }): Promise<PaginatedResult<GenTableInfo>>;
  getColumns(tableId: string): Promise<GenColumnInfo[]>;
  preview(tableId: string): Promise<GeneratedFile[]>;
  generate(tableId: string): Promise<GeneratedFile[]>;
}

/** SQL type → TypeScript type mapping */
function sqlTypeToTs(sqlType: string): string {
  const t = sqlType.toLowerCase();
  if (t.includes("varchar") || t.includes("text") || t.includes("char")) return "string";
  if (t.includes("int") || t.includes("serial") || t.includes("float") || t.includes("double") || t.includes("numeric") || t.includes("decimal") || t.includes("bigint") || t.includes("smallint")) return "number";
  if (t.includes("bool")) return "boolean";
  if (t.includes("timestamp") || t.includes("date") || t.includes("time")) return "string";
  if (t.includes("json") || t.includes("jsonb")) return "Record<string, unknown>";
  return "unknown";
}

/** column_name → fieldName (snake_case → camelCase) */
function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** table_name → ClassName (snake_case → PascalCase) */
function toPascalCase(s: string): string {
  return s
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function createGenService(deps: {
  executor: SqlExecutor;
  /** readTableSchema from @ventostack/database */
  readTableSchema: (executor: SqlExecutor, tableName: string) => Promise<TableSchemaInfo>;
}): GenService {
  const { executor, readTableSchema } = deps;

  return {
    async importTable(tableName, moduleName, author) {
      const tableId = crypto.randomUUID();

      // Read schema from DB
      const schema = await readTableSchema(executor, tableName);
      const className = toPascalCase(tableName.replace(/^sys_/, ""));

      // Insert table record
      await executor(
        `INSERT INTO sys_gen_table (id, table_name, class_name, module_name, function_name, function_author, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW())`,
        [tableId, tableName, className, moduleName, className + "管理", author ?? null],
      );

      // Insert column records
      for (let i = 0; i < schema.columns.length; i++) {
        const col = schema.columns[i]!;
        const colId = crypto.randomUUID();
        const tsType = sqlTypeToTs(col.type);
        await executor(
          `INSERT INTO sys_gen_table_column (id, table_id, column_name, column_type, typescript_type, field_name, field_comment, is_primary, is_nullable, is_list, is_insert, is_update, is_query, sort)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            colId, tableId, col.name, col.type, tsType,
            toCamelCase(col.name), col.comment ?? null,
            col.isPrimary, col.nullable,
            !col.isPrimary, // isList: all non-PK
            !col.isPrimary, // isInsert: all non-PK
            !col.isPrimary, // isUpdate: all non-PK
            false, // isQuery: off by default
            i,
          ],
        );
      }

      return { tableId };
    },

    async updateTable(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.className !== undefined) { fields.push(`class_name = $${idx++}`); values.push(params.className); }
      if (params.moduleName !== undefined) { fields.push(`module_name = $${idx++}`); values.push(params.moduleName); }
      if (params.functionName !== undefined) { fields.push(`function_name = $${idx++}`); values.push(params.functionName); }
      if (params.functionAuthor !== undefined) { fields.push(`function_author = $${idx++}`); values.push(params.functionAuthor); }
      if (params.remark !== undefined) { fields.push(`remark = $${idx++}`); values.push(params.remark); }

      if (fields.length === 0) return;
      fields.push("updated_at = NOW()");
      values.push(id);
      await executor(`UPDATE sys_gen_table SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    },

    async updateColumn(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.isList !== undefined) { fields.push(`is_list = $${idx++}`); values.push(params.isList); }
      if (params.isInsert !== undefined) { fields.push(`is_insert = $${idx++}`); values.push(params.isInsert); }
      if (params.isUpdate !== undefined) { fields.push(`is_update = $${idx++}`); values.push(params.isUpdate); }
      if (params.isQuery !== undefined) { fields.push(`is_query = $${idx++}`); values.push(params.isQuery); }
      if (params.queryType !== undefined) { fields.push(`query_type = $${idx++}`); values.push(params.queryType); }
      if (params.fieldComment !== undefined) { fields.push(`field_comment = $${idx++}`); values.push(params.fieldComment); }

      if (fields.length === 0) return;
      values.push(id);
      await executor(`UPDATE sys_gen_table_column SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    },

    async getTable(id) {
      const rows = await executor(`SELECT * FROM sys_gen_table WHERE id = $1`, [id]);
      const tables = rows as Array<Record<string, unknown>>;
      if (tables.length === 0) return null;
      return rowToTable(tables[0]!);
    },

    async listTables(params) {
      const { page = 1, pageSize = 10 } = params ?? {};
      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_gen_table`);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_gen_table ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToTable);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async getColumns(tableId) {
      const rows = await executor(
        `SELECT * FROM sys_gen_table_column WHERE table_id = $1 ORDER BY sort`,
        [tableId],
      );
      return (rows as Array<Record<string, unknown>>).map(rowToColumn);
    },

    async preview(tableId) {
      const table = await this.getTable(tableId);
      if (!table) throw new Error("Table not found");
      const columns = await this.getColumns(tableId);

      return [
        { filename: `models/${toKebab(table.className)}.ts`, content: renderModel(table, columns) },
        { filename: `services/${toKebab(table.className)}.ts`, content: renderService(table, columns) },
        { filename: `routes/${toKebab(table.className)}.ts`, content: renderRoutes(table, columns) },
        { filename: `types/${toKebab(table.className)}.ts`, content: renderTypes(table, columns) },
        { filename: `__tests__/${toKebab(table.className)}.test.ts`, content: renderTest(table, columns) },
      ];
    },

    async generate(tableId) {
      return this.preview(tableId);
    },
  };
}

function rowToTable(row: Record<string, unknown>): GenTableInfo {
  return {
    id: row.id as string,
    tableName: row.table_name as string,
    className: row.class_name as string,
    moduleName: row.module_name as string,
    functionName: row.function_name as string,
    functionAuthor: (row.function_author as string) ?? null,
    remark: (row.remark as string) ?? null,
    status: row.status as number,
  };
}

function rowToColumn(row: Record<string, unknown>): GenColumnInfo {
  return {
    id: row.id as string,
    tableId: row.table_id as string,
    columnName: row.column_name as string,
    columnType: row.column_type as string,
    typescriptType: row.typescript_type as string,
    fieldName: row.field_name as string,
    fieldComment: (row.field_comment as string) ?? null,
    isPrimary: row.is_primary as boolean,
    isNullable: row.is_nullable as boolean,
    isList: row.is_list as boolean,
    isInsert: row.is_insert as boolean,
    isUpdate: row.is_update as boolean,
    isQuery: row.is_query as boolean,
    queryType: (row.query_type as string) ?? null,
    sort: row.sort as number,
  };
}

function toKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
