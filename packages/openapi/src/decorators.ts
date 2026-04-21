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

export interface RouteMetadata {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

/**
 * 定义单条路由的 OpenAPI 元数据。
 * 返回原样元数据，可用于后续批量注入生成器。
 */
export function defineRouteDoc(metadata: RouteMetadata): RouteMetadata {
  return metadata;
}

/**
 * 将一组路由元数据批量注入到 OpenAPIGenerator 中。
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
 * 自动将 Router 中已注册的所有路由同步到 OpenAPIGenerator。
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
