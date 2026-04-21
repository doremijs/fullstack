// @aeron/events

/** 创建内存事件总线与事件定义工具 */
export { createEventBus, defineEvent } from "./event-bus";
export type { EventBus, EventDefinition, EventHandler } from "./event-bus";

/** 创建任务调度器与 Cron 表达式解析 */
export { createScheduler, parseCronToInterval } from "./scheduler";
export type { Scheduler, ScheduleOptions, ScheduledTask } from "./scheduler";

/** 创建内存消息队列 */
export { createMemoryQueue } from "./message-queue";
export type { Message, MessageHandler, MessageQueue, QueueOptions } from "./message-queue";

/** 创建延迟队列 */
export { createDelayedQueue } from "./delayed-queue";
export type { DelayedMessage, DelayedQueue } from "./delayed-queue";

/** 创建领域事件注册表 */
export { createDomainEventRegistry } from "./domain-events";
export type {
  DomainEvent,
  DomainEventHandler,
  DomainEventRegistry,
  DomainEventType,
} from "./domain-events";

/** 创建内存事件溯源存储 */
export { createMemoryEventStore } from "./event-sourcing";
export type { EventStore, StoredEvent } from "./event-sourcing";

/** 创建内存 MQ 适配器与适配器工厂 */
export { createMemoryMQAdapter, createMQAdapterFactory } from "./mq-adapter";
export type { MQAdapter, MQMessage, MQMessageHandler, MQAdapterConfig } from "./mq-adapter";

/** 创建可靠投递封装 */
export { createReliableDelivery } from "./reliable-delivery";
export type {
  ReliableDelivery,
  ReliableMessage,
  ReliableDeliveryOptions,
} from "./reliable-delivery";

/** 创建分布式调度器 */
export { createDistributedScheduler } from "./distributed-scheduler";
export type {
  DistributedScheduler,
  DistributedTask,
  TaskLock,
  DistributedSchedulerOptions,
} from "./distributed-scheduler";

/** 创建任务监控器 */
export { createTaskMonitor } from "./task-monitor";
export type { TaskMonitor, TaskRecord, TaskLogEntry, TaskStatus } from "./task-monitor";

/** 创建事件队列 */
export { createEventQueue } from "./event-queue";
export type { EventQueue, QueuedEvent, EventQueueOptions } from "./event-queue";

/** 创建 Saga 编排器与 TCC 编排器 */
export { createSaga, createTCC } from "./saga";
export type {
  SagaOrchestrator,
  SagaStep,
  SagaResult,
  SagaStatus,
  TCCOrchestrator,
  TCCStep,
} from "./saga";
