/**
 * 用户已读记录模型
 */

import { defineModel, column } from "@ventostack/database";

export const NotifyUserReadModel = defineModel("sys_notify_user_read", {
  id: column.string({ primary: true }),
  userId: column.string(),
  messageId: column.string(),
  readAt: column.string(),
}, { timestamps: false });
