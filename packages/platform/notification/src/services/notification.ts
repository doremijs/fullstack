/**
 * @ventostack/notify - 通知服务
 */

import type { SqlExecutor } from "@ventostack/database";

/** 通知通道接口 */
export interface NotifyChannel {
  name: string;
  send(params: { to: string; title: string; content: string }): Promise<{ success: boolean; error?: string }>;
}

/** 通知模板 */
export interface NotifyTemplate {
  id: string;
  name: string;
  code: string;
  channel: string;
  title: string | null;
  content: string;
  status: number;
}

/** 通知消息 */
export interface NotifyMessage {
  id: string;
  templateId: string | null;
  channel: string;
  receiverId: string;
  title: string | null;
  content: string;
  variables: Record<string, unknown> | null;
  status: number;
  retryCount: number;
  sendAt: string | null;
  error: string | null;
  createdAt: string;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 消息状态 */
export const MessageStatus = {
  PENDING: 0,
  SENT: 1,
  FAILED: 2,
} as const;

/** 模板状态 */
export const TemplateStatus = {
  DISABLED: 0,
  ACTIVE: 1,
} as const;

/** 通知服务接口 */
export interface NotificationService {
  send(params: {
    templateId?: string;
    receiverId: string;
    channel: string;
    title?: string;
    content: string;
    variables?: Record<string, unknown>;
  }): Promise<{ messageId: string }>;

  listMessages(params: {
    receiverId?: string;
    channel?: string;
    status?: number;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<NotifyMessage>>;

  getUnreadCount(userId: string): Promise<number>;
  markRead(userId: string, messageId: string): Promise<void>;
  markBatchRead(userId: string, messageIds: string[]): Promise<void>;
  retry(messageId: string): Promise<void>;

  // Template CRUD
  createTemplate(params: {
    name: string;
    code: string;
    channel: string;
    title?: string;
    content: string;
  }): Promise<{ id: string }>;

  updateTemplate(id: string, params: Partial<{ name: string; title: string; content: string; status: number }>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  listTemplates(params?: { channel?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<NotifyTemplate>>;
}

/** 通知服务依赖 */
export interface NotificationServiceDeps {
  executor: SqlExecutor;
  channels: Map<string, NotifyChannel>;
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const { executor, channels } = deps;

  async function renderTemplate(templateId: string, variables?: Record<string, unknown>): Promise<{ title: string; content: string } | null> {
    const rows = await executor(`SELECT * FROM sys_notify_template WHERE id = $1`, [templateId]);
    const templates = rows as Array<Record<string, unknown>>;
    if (templates.length === 0) return null;
    const tpl = templates[0]!;

    let title = (tpl.title as string) ?? "";
    let content = tpl.content as string;

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        title = title.replace(placeholder, String(value));
        content = content.replace(placeholder, String(value));
      }
    }

    return { title, content };
  }

  return {
    async send(params) {
      const messageId = crypto.randomUUID();
      let { title, content } = params;

      // If templateId provided, render template
      if (params.templateId) {
        const rendered = await renderTemplate(params.templateId, params.variables);
        if (rendered) {
          title = rendered.title;
          content = rendered.content;
        }
      }

      // Send via channel
      const channel = channels.get(params.channel);
      let status = MessageStatus.PENDING;
      let sendAt: string | null = null;
      let error: string | null = null;

      if (channel) {
        const result = await channel.send({
          to: params.receiverId,
          title: title ?? "",
          content,
        });
        status = result.success ? MessageStatus.SENT : MessageStatus.FAILED;
        sendAt = result.success ? new Date().toISOString() : null;
        error = result.error ?? null;
      }

      // Insert message record
      await executor(
        `INSERT INTO sys_notify_message (id, template_id, channel, receiver_id, title, content, variables, status, retry_count, send_at, error, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, NOW(), NOW())`,
        [messageId, params.templateId ?? null, params.channel, params.receiverId, title ?? null, content, params.variables ? JSON.stringify(params.variables) : null, status, sendAt, error],
      );

      return { messageId };
    },

    async listMessages(params) {
      const { receiverId, channel, status, page = 1, pageSize = 10 } = params;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (receiverId) { conditions.push(`receiver_id = $${idx++}`); values.push(receiverId); }
      if (channel) { conditions.push(`channel = $${idx++}`); values.push(channel); }
      if (status !== undefined) { conditions.push(`status = $${idx++}`); values.push(status); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_notify_message ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_notify_message ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToMessage);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },

    async getUnreadCount(userId) {
      // Unread = messages for user that are SENT but have no read record
      const rows = await executor(
        `SELECT COUNT(*) as total FROM sys_notify_message m
         WHERE m.receiver_id = $1 AND m.status = ${MessageStatus.SENT}
         AND NOT EXISTS (SELECT 1 FROM sys_notify_user_read r WHERE r.user_id = $1 AND r.message_id = m.id)`,
        [userId],
      );
      return Number((rows as Array<{ total: number }>)[0]?.total ?? 0);
    },

    async markRead(userId, messageId) {
      const id = crypto.randomUUID();
      await executor(
        `INSERT INTO sys_notify_user_read (id, user_id, message_id, read_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, message_id) DO NOTHING`,
        [id, userId, messageId],
      );
    },

    async markBatchRead(userId, messageIds) {
      for (const messageId of messageIds) {
        const id = crypto.randomUUID();
        await executor(
          `INSERT INTO sys_notify_user_read (id, user_id, message_id, read_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, message_id) DO NOTHING`,
          [id, userId, messageId],
        );
      }
    },

    async retry(messageId) {
      // Get message
      const rows = await executor(`SELECT * FROM sys_notify_message WHERE id = $1`, [messageId]);
      const messages = rows as Array<Record<string, unknown>>;
      if (messages.length === 0) throw new Error("Message not found");
      const msg = messages[0]!;

      const channel = channels.get(msg.channel as string);
      if (!channel) {
        await executor(
          `UPDATE sys_notify_message SET status = ${MessageStatus.FAILED}, error = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2`,
          ["Channel not found", messageId],
        );
        return;
      }

      const result = await channel.send({
        to: msg.receiver_id as string,
        title: (msg.title as string) ?? "",
        content: msg.content as string,
      });

      const status = result.success ? MessageStatus.SENT : MessageStatus.FAILED;
      const sendAt = result.success ? new Date().toISOString() : null;

      await executor(
        `UPDATE sys_notify_message SET status = $1, send_at = $2, error = $3, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $4`,
        [status, sendAt, result.error ?? null, messageId],
      );
    },

    async createTemplate(params) {
      const id = crypto.randomUUID();
      await executor(
        `INSERT INTO sys_notify_template (id, name, code, channel, title, content, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, ${TemplateStatus.ACTIVE}, NOW(), NOW())`,
        [id, params.name, params.code, params.channel, params.title ?? null, params.content],
      );
      return { id };
    },

    async updateTemplate(id, params) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (params.name !== undefined) { fields.push(`name = $${idx++}`); values.push(params.name); }
      if (params.title !== undefined) { fields.push(`title = $${idx++}`); values.push(params.title); }
      if (params.content !== undefined) { fields.push(`content = $${idx++}`); values.push(params.content); }
      if (params.status !== undefined) { fields.push(`status = $${idx++}`); values.push(params.status); }

      if (fields.length === 0) return;
      fields.push("updated_at = NOW()");
      values.push(id);
      await executor(`UPDATE sys_notify_template SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    },

    async deleteTemplate(id) {
      await executor(`DELETE FROM sys_notify_template WHERE id = $1`, [id]);
    },

    async listTemplates(params) {
      const { channel, page = 1, pageSize = 10 } = params ?? {};

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (channel) { conditions.push(`channel = $${idx++}`); values.push(channel); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_notify_template ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT * FROM sys_notify_template ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map(rowToTemplate);
      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },
  };
}

function rowToMessage(row: Record<string, unknown>): NotifyMessage {
  return {
    id: row.id as string,
    templateId: (row.template_id as string) ?? null,
    channel: row.channel as string,
    receiverId: row.receiver_id as string,
    title: (row.title as string) ?? null,
    content: row.content as string,
    variables: (row.variables as Record<string, unknown>) ?? null,
    status: row.status as number,
    retryCount: row.retry_count as number,
    sendAt: (row.send_at as string) ?? null,
    error: (row.error as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToTemplate(row: Record<string, unknown>): NotifyTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    channel: row.channel as string,
    title: (row.title as string) ?? null,
    content: row.content as string,
    status: row.status as number,
  };
}
