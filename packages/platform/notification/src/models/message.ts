/**
 * 通知消息模型
 */

import { defineModel, column } from "@ventostack/database";

export const NotifyMessageModel = defineModel("sys_notify_message", {
  id: column.string({ primary: true }),
  templateId: column.string({ nullable: true }),
  channel: column.string(),
  receiverId: column.string(),
  title: column.string({ nullable: true }),
  content: column.string(),
  variables: column.json({ nullable: true }),
  status: column.number(),
  retryCount: column.number(),
  sendAt: column.string({ nullable: true }),
  error: column.string({ nullable: true }),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
