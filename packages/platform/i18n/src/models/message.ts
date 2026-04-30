/**
 * 国际化消息模型
 */

import { defineModel, column } from "@ventostack/database";

export const I18nMessageModel = defineModel("sys_i18n_message", {
  id: column.string({ primary: true }),
  locale: column.string(),
  code: column.string(),
  value: column.string(),
  module: column.string({ nullable: true }),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
