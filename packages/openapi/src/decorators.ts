// ============================================================
// @aeron/openapi — Route Metadata (decorators.ts)
// 函数式路由元数据定义与 OpenAPI 转换
// ============================================================

import type { Router } from "@aeron/core";
import type {
  OpenAPIGenerator,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIRequestBody,
  OpenAPIResponse,
} from "./generator";

/** 路由元数据，用于描述单条路由的 OpenAPI 文档信息 */
export interface RouteMetadata {
  /** 路由路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** 接口摘要 */
  summary?: string;
  /** 接口详细描述 */
  description?: string;
  /** 标签分类 */
  tags?: string[];
  /** 操作唯一标识 */
  operationId?: string;
  /** 路径/查询/头参数定义 */
  parameters?: OpenAPIParameter[];
  /** 请求体定义 */
  requestBody?: OpenAPIRequestBody;
  /** 响应定义 */
  responses?: Record<string, OpenAPIResponse>;
  /** 安全要求 */
  security?: Array<Record<string, string[]>>;
  /** 是否已废弃 */
  deprecated?: boolean;
}

/**
 * 定义单条路由的 OpenAPI 元数据
 * @param metadata - 路由元数据对象
 * @returns 原样返回的元数据对象，便于链式使用
 */
export function defineRouteDoc(metadata: RouteMetadata): RouteMetadata {
  return metadata;
}

/**
 * 将一组路由元数据批量注入到 OpenAPIGenerator 中
 * @param routes - 路由元数据数组
 * @param generator - OpenAPI 生成器实例
 */
export function routesToOpenAPI(routes: RouteMetadata[], generator: OpenAPIGenerator): void {
  for (const route of routes) {
    const operation: OpenAPIOperation = {
      responses: route.responses ?? {
        "200": { description: "Success" },
      },
    };

    if (route.summary !== undefined) operation.summary = route.summary;
    if (route.description !== undefined) operation.description = route.description;
    if (route.tags !== undefined) operation.tags = route.tags;
    if (route.operationId !== undefined) operation.operationId = route.operationId;
    if (route.parameters !== undefined) operation.parameters = route.parameters;
    if (route.requestBody !== undefined) operation.requestBody = route.requestBody;
    if (route.security !== undefined) operation.security = route.security;
    if (route.deprecated !== undefined) operation.deprecated = route.deprecated;

    generator.addPath(route.path, route.method, operation);
  }
}

/**
 * 自动将 Router 中已注册的所有路由同步到 OpenAPIGenerator
 * @param router - Aeron 路由实例
 * @param generator - OpenAPI 生成器实例
 *
 * 会读取每条路由的 metadata?.openapi 作为详细文档；
 * 如果没有声明 openapi 元数据，则生成一个仅含默认 200 响应的基础 operation。
 */
export function syncRouterToOpenAPI(router: Router, generator: OpenAPIGenerator): void {
  for (const route of router.routes()) {
    const openapiMeta = route.metadata?.openapi as Partial<OpenAPIOperation> | undefined;
    const operation: OpenAPIOperation = {
      responses: openapiMeta?.responses ?? {
        "200": { description: "Success" },
      },
    };

    if (openapiMeta?.summary !== undefined) operation.summary = openapiMeta.summary;
    if (openapiMeta?.description !== undefined) operation.description = openapiMeta.description;
    if (openapiMeta?.tags !== undefined) operation.tags = openapiMeta.tags;
    if (openapiMeta?.operationId !== undefined) operation.operationId = openapiMeta.operationId;
    if (openapiMeta?.parameters !== undefined) operation.parameters = openapiMeta.parameters;
    if (openapiMeta?.requestBody !== undefined) operation.requestBody = openapiMeta.requestBody;
    if (openapiMeta?.security !== undefined) operation.security = openapiMeta.security;
    if (openapiMeta?.deprecated !== undefined) operation.deprecated = openapiMeta.deprecated;

    generator.addPath(route.path, route.method, operation);
  }
}
