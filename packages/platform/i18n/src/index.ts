/**
 * @ventostack/i18n — 国际化
 *
 * 语言管理、消息翻译、批量导入导出。
 */

// Models
export { I18nLocaleModel } from "./models/locale";
export { I18nMessageModel } from "./models/message";

// Services
export { createI18nService } from "./services/i18n";
export type {
  I18nLocale,
  I18nMessage,
  PaginatedResult,
  I18nService,
  I18nServiceDeps,
} from "./services/i18n";

// Routes
export { createI18nRoutes } from "./routes/i18n";

// Module
export { createI18nModule } from "./module";
export type { I18nModule, I18nModuleDeps } from "./module";

// Migrations
export { createI18nTables } from "./migrations/001_create_i18n_tables";
