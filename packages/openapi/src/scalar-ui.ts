// @aeron/openapi - Scalar 内嵌页面

import type { AeronApp, Plugin } from "@aeron/core";

export interface ScalarUIOptions {
  /** OpenAPI JSON 端点路径 */
  specUrl?: string;
  /** 页面标题 */
  title?: string;
  /** Scalar CDN 版本 */
  version?: string;
  /** Scalar 挂载路径 */
  path?: string;
}

/**
 * 生成 Scalar HTML 页面。
 * 使用 CDN 加载 Scalar，不需要本地依赖。
 */
export function generateScalarUI(options: ScalarUIOptions = {}): string {
  const { specUrl = "/openapi.json", title = "API Documentation", version = "latest" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlAttr(title)}</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${version}"></script>
  <script>
    Scalar.createApiReference('#app', {
      url: ${JSON.stringify(specUrl)},
    });
  </script>
</body>
</html>`;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 创建 Scalar 路由处理器。
 * 返回一个 handler 可以直接用于路由。
 */
export function createScalarUIHandler(options: ScalarUIOptions = {}): () => Response {
  const html = generateScalarUI(options);
  return () =>
    new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

/**
 * 创建 Scalar UI 插件。
 * 自动注册 /docs 路由并在启动时打印访问地址。
 */
export function createScalarUIPlugin(options: ScalarUIOptions = {}): Plugin {
  const path = options.path ?? "/docs";
  return {
    name: "scalar-ui",
    install(app: AeronApp) {
      app.router.get(path, createScalarUIHandler(options));
      app.addUrl("Scalar UI", path);
    },
  };
}
