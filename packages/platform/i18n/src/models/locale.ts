/**
 * 国际化语言模型
 */

import { defineModel, column } from "@ventostack/database";

export const I18nLocaleModel = defineModel("sys_i18n_locale", {
  id: column.string({ primary: true }),
  code: column.string(),
  name: column.string(),
  isDefault: column.boolean(),
  status: column.number(),
  createdAt: column.string(),
  updatedAt: column.string(),
}, { timestamps: true });
