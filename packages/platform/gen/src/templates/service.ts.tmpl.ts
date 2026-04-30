/**
 * Service 代码模板
 */

import type { GenTableInfo, GenColumnInfo } from "../services/gen";

export function renderService(table: GenTableInfo, columns: GenColumnInfo[]): string {
  const nonPrimaryCols = columns.filter(c => !c.isPrimary);
  const insertableCols = nonPrimaryCols.filter(c => c.isInsert);
  const updatableCols = nonPrimaryCols.filter(c => c.isUpdate);
  const queryableCols = columns.filter(c => c.isQuery);

  const createParams = insertableCols.map(c =>
    `  ${c.fieldName}${c.isNullable ? "?" : ""}: ${mapTsType(c.typescriptType)};`
  ).join("\n");

  const updateParams = updatableCols.map(c =>
    `  ${c.fieldName}?: ${mapTsType(c.typescriptType)};`
  ).join("\n");

  const listParams = queryableCols.map(c =>
    `  ${c.fieldName}?: ${mapTsType(c.typescriptType)};`
  ).join("\n");

  const insertCols = insertableCols.map(c => c.columnName).join(", ");
  const insertPlaceholders = insertableCols.map((_, i) => `$${i + 1}`).join(", ");
  const insertValues = insertableCols.map(c => c.fieldName).join(", ");

  return `import type { SqlExecutor } from "@ventostack/database";

export interface Create${table.className}Params {
${createParams}
}

export interface Update${table.className}Params {
${updateParams}
}

export interface ${table.className}ListItem {
${columns.map(c => `  ${c.fieldName}: ${mapTsType(c.typescriptType)}${c.isNullable ? " | null" : ""};`).join("\n")}
}

export interface ${table.className}ListParams {
  page?: number;
  pageSize?: number;
${listParams}
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ${table.className}Service {
  create(params: Create${table.className}Params): Promise<{ id: string }>;
  update(id: string, params: Update${table.className}Params): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<${table.className}ListItem | null>;
  list(params: ${table.className}ListParams): Promise<PaginatedResult<${table.className}ListItem>>;
}

export function create${table.className}Service(deps: { executor: SqlExecutor }): ${table.className}Service {
  const { executor } = deps;

  return {
    async create(params) {
      const id = crypto.randomUUID();
      await executor(
        \`INSERT INTO ${table.tableName} (id, ${insertCols}, created_at, updated_at) VALUES (\${[...Array(${insertableCols.length + 1})].map((_, i) => \`$\${i + 1}\`).join(", ")}, NOW(), NOW())\`,
        [id, ${insertValues}],
      );
      return { id };
    },

    async update(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

${updatableCols.map(c => `      if (params.${c.fieldName} !== undefined) { fields.push(\`${c.columnName} = $\${idx++}\`); values.push(params.${c.fieldName}); }`).join("\n")}

      if (fields.length === 0) return;
      fields.push("updated_at = NOW()");
      values.push(id);
      await executor(\`UPDATE ${table.tableName} SET \${fields.join(", ")} WHERE id = $\${idx}\`, values);
    },

    async delete(id) {
      await executor(\`DELETE FROM ${table.tableName} WHERE id = $1\`, [id]);
    },

    async getById(id) {
      const rows = await executor(\`SELECT * FROM ${table.tableName} WHERE id = $1\`, [id]);
      const items = rows as Array<Record<string, unknown>>;
      if (items.length === 0) return null;
      return items[0] as unknown as ${table.className}ListItem;
    },

    async list(params) {
      const { page = 1, pageSize = 10${queryableCols.length > 0 ? ", " + queryableCols.map(c => c.fieldName).join(", ") : ""} } = params;
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

${queryableCols.map(c => `      if (${c.fieldName} !== undefined) { conditions.push(\`${c.columnName} = $\${idx++}\`); values.push(${c.fieldName}); }`).join("\n")}

      const where = conditions.length > 0 ? \`WHERE \${conditions.join(" AND ")}\` : "";
      const countRows = await executor(\`SELECT COUNT(*) as total FROM ${table.tableName} \${where}\`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        \`SELECT * FROM ${table.tableName} \${where} ORDER BY created_at DESC LIMIT $\${idx++} OFFSET $\${idx++}\`,
        [...values, pageSize, offset],
      );

      return {
        items: rows as unknown as ${table.className}ListItem[],
        total, page, pageSize,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
  };
}
`;
}

function mapTsType(pgType: string): string {
  const map: Record<string, string> = {
    varchar: "string", text: "string", char: "string",
    int: "number", integer: "number", smallint: "number", bigint: "number", serial: "number",
    boolean: "bool", bool: "boolean",
    timestamp: "string", timestamptz: "string", date: "string",
    json: "Record<string, unknown>", jsonb: "Record<string, unknown>",
    float: "number", double: "number", numeric: "number", decimal: "number",
  };
  return map[pgType.toLowerCase()] ?? "unknown";
}
