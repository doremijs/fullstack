/**
 * @ventostack/i18n - 国际化服务
 */

import type { SqlExecutor } from "@ventostack/database";

/** 语言 */
export interface I18nLocale {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  status: number;
}

/** 消息 */
export interface I18nMessage {
  id: string;
  locale: string;
  code: string;
  value: string;
  module: string | null;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 国际化服务接口 */
export interface I18nService {
  // Locale CRUD
  createLocale(params: { code: string; name: string; isDefault?: boolean }): Promise<{ id: string }>;
  updateLocale(id: string, params: Partial<{ name: string; isDefault: boolean; status: number }>): Promise<void>;
  deleteLocale(id: string): Promise<void>;
  listLocales(): Promise<I18nLocale[]>;

  // Message CRUD
  setMessage(locale: string, code: string, value: string, module?: string): Promise<void>;
  getMessage(locale: string, code: string): Promise<string | null>;
  deleteMessage(id: string): Promise<void>;
  listMessages(params: { locale?: string; module?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<I18nMessage>>;

  // Bulk operations
  getLocaleMessages(locale: string, module?: string): Promise<Record<string, string>>;
  importMessages(locale: string, messages: Record<string, string>, module?: string): Promise<number>;
}

export interface I18nServiceDeps {
  executor: SqlExecutor;
}

export function createI18nService(deps: I18nServiceDeps): I18nService {
  const { executor } = deps;

  return {
    async createLocale(params) {
      const id = crypto.randomUUID();
      await executor(
        `INSERT INTO sys_i18n_locale (id, code, name, is_default, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [id, params.code, params.name, params.isDefault ?? false],
      );
      return { id };
    },

    async updateLocale(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.name !== undefined) { fields.push(`name = $${idx++}`); values.push(params.name); }
      if (params.isDefault !== undefined) { fields.push(`is_default = $${idx++}`); values.push(params.isDefault); }
      if (params.status !== undefined) { fields.push(`status = $${idx++}`); values.push(params.status); }

      if (fields.length === 0) return;
      fields.push("updated_at = NOW()");
      values.push(id);
      await executor(`UPDATE sys_i18n_locale SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    },

    async deleteLocale(id) {
      // Also delete all messages for this locale
      const localeRows = await executor(`SELECT code FROM sys_i18n_locale WHERE id = $1`, [id]);
      const locales = localeRows as Array<{ code: string }>;
      if (locales.length > 0) {
        await executor(`DELETE FROM sys_i18n_message WHERE locale = $1`, [locales[0]!.code]);
      }
      await executor(`DELETE FROM sys_i18n_locale WHERE id = $1`, [id]);
    },

    async listLocales() {
      const rows = await executor(`SELECT * FROM sys_i18n_locale ORDER BY is_default DESC, code`);
      return (rows as Array<Record<string, unknown>>).map(rowToLocale);
    },

    async setMessage(locale, code, value, module) {
      const id = crypto.randomUUID();
      await executor(
        `INSERT INTO sys_i18n_message (id, locale, code, value, module, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (locale, code) DO UPDATE SET value = $4, module = $5, updated_at = NOW()`,
        [id, locale, code, value, module ?? null],
      );
    },

    async getMessage(locale, code) {
      const rows = await executor(
        `SELECT value FROM sys_i18n_message WHERE locale = $1 AND code = $2`,
        [locale, code],
      );
      const messages = rows as Array<{ value: string }>;
      return messages.length > 0 ? messages[0]!.value : null;
    },

    async deleteMessage(id) {
      await executor(`DELETE FROM sys_i18n_message WHERE id = $1`, [id]);
    },

    async listMessages(params) {
      const { locale, module, page = 1, pageSize = 10 } = params;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (locale) { conditions.push(`locale = $${idx++}`); values.push(locale); }
      if (module) { conditions.push(`module = $${idx++}`); values.push(module); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_i18n_message ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_i18n_message ${where} ORDER BY code LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToMessage);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async getLocaleMessages(locale, module) {
      const conditions = [`locale = $1`];
      const values: unknown[] = [locale];
      let idx = 2;

      if (module) { conditions.push(`module = $${idx++}`); values.push(module); }

      const rows = await executor(
        `SELECT code, value FROM sys_i18n_message WHERE ${conditions.join(" AND ")}`,
        values,
      );

      const result: Record<string, string> = {};
      for (const row of rows as Array<{ code: string; value: string }>) {
        result[row.code] = row.value;
      }
      return result;
    },

    async importMessages(locale, messages, module) {
      let count = 0;
      for (const [code, value] of Object.entries(messages)) {
        const id = crypto.randomUUID();
        await executor(
          `INSERT INTO sys_i18n_message (id, locale, code, value, module, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (locale, code) DO UPDATE SET value = $4, module = $5, updated_at = NOW()`,
          [id, locale, code, value, module ?? null],
        );
        count++;
      }
      return count;
    },
  };
}

function rowToLocale(row: Record<string, unknown>): I18nLocale {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    isDefault: row.is_default as boolean,
    status: row.status as number,
  };
}

function rowToMessage(row: Record<string, unknown>): I18nMessage {
  return {
    id: row.id as string,
    locale: row.locale as string,
    code: row.code as string,
    value: row.value as string,
    module: (row.module as string) ?? null,
  };
}
