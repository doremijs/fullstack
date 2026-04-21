// @aeron/observability

/** 创建结构化日志记录器 */
export { createLogger } from "./logger";
export type { Logger, LogLevel, LogEntry, LoggerOptions } from "./logger";

/** 创建指标收集器（计数器、直方图、仪表盘） */
export { createMetrics } from "./metrics";
export type {
  Metrics,
  Counter,
  Histogram,
  HistogramSnapshot,
  MetricsOptions,
  Gauge,
} from "./metrics";

/** 创建健康检查服务 */
export { createHealthCheck } from "./health";
export type { HealthCheck, HealthStatus, HealthCheckOptions, CheckResult } from "./health";

/** 创建分布式追踪器 */
export { createTracer } from "./tracing";
export type { Tracer, Span, SpanContext, SpanHandle } from "./tracing";

/** 创建文件日志记录器 */
export { createFileLogger } from "./file-logger";
export type { FileLogger, FileLoggerOptions } from "./file-logger";

/** 创建审计日志 */
export { createAuditLog } from "./audit";
export type { AuditEntry, AuditStore } from "./audit";

/** 创建 W3C TraceContext 与 B3 传播器 */
export { createW3CTraceContextPropagator, createB3Propagator } from "./trace-context";
export type { TraceContextPropagator } from "./trace-context";

/** 创建审计日志导出器 */
export { createAuditExporter } from "./audit-export";
export type { AuditExporter } from "./audit-export";

/** 创建异步批量写入器 */
export { createAsyncWriter } from "./async-writer";
export type { AsyncWriter, AsyncWriterOptions } from "./async-writer";

/** 创建日志拦截钩子 */
export { createLogHook } from "./log-hook";
export type { LogHook, LogHookConfig, LogEntry as LogHookEntry } from "./log-hook";

/** 创建 OpenTelemetry 兼容追踪器与控制台导出器 */
export { createTracer as createOTelTracer, createConsoleExporter } from "./otel";
export type { OTelSpan, OTelConfig, SpanExporter, Tracer as OTelTracer } from "./otel";

/** 创建链路追踪导出器 */
export { createTraceExporter } from "./trace-exporter";
export type { TraceExporterConfig } from "./trace-exporter";

/** 创建 Grafana Dashboard JSON 模板 */
export { createGrafanaDashboard, createHttpDashboard } from "./grafana";
export type { GrafanaDashboard, GrafanaDashboardConfig, GrafanaPanelConfig } from "./grafana";

/** 创建错误报告器与多种告警通道 */
export {
  createErrorReporter,
  createSentryChannel,
  createDingTalkChannel,
  createWebhookChannel,
} from "./error-reporter";
export type {
  ErrorReporter,
  ErrorReporterConfig,
  ErrorChannel,
  ErrorReport,
} from "./error-reporter";
