/**
 * 通知模板模型
 */

import { defineModel, column } from "@ventostack/database";

export const NotifyTemplateModel = defineModel("sys_notify_template", {
  id: column.string({ primary: true }),
  name: column.string(),
  code: column.string(),
  channel: column.string(),
  title: column.string({ nullable: true }),
  content: column.string(),
  status: column.number(),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
