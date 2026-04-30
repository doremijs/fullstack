/**
 * @ventostack/oss - 文件存储路由
 */

import { createRouter } from "@ventostack/core";
import type { Middleware, Router } from "@ventostack/core";
import type { OSSService } from "../services/oss";
import { ok, okPage, fail, pageOf } from "./common";

/** 上传文件大小限制 (50MB) */
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

export function createOSSRoutes(
  ossService: OSSService,
  authMiddleware: Middleware,
  perm: (resource: string, action: string) => Middleware,
): Router {
  const router = createRouter();
  router.use(authMiddleware);

  // Upload file
  router.post("/api/oss/upload", perm("oss", "file:upload"), async (ctx) => {
    try {
      const contentType = ctx.request.headers.get("Content-Type") ?? "";

      if (!contentType.includes("multipart/form-data")) {
        return fail("Content-Type must be multipart/form-data", 400);
      }

      const formData = await ctx.request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return fail("Missing file field", 400);
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        return fail(`File too large, max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`, 400);
      }

      const bucket = (formData.get("bucket") as string) ?? "default";
      const user = ctx.user as { id: string };
      const arrayBuffer = await file.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      const result = await ossService.upload({
        filename: file.name,
        data,
        contentType: file.type || undefined,
        bucket,
      }, user.id);

      return ok(result);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Upload failed", 400);
    }
  });

  // List files
  router.get("/api/oss", perm("oss", "file:list"), async (ctx) => {
    const q = ctx.query as Record<string, unknown>;
    const { page, pageSize } = pageOf(q);
    const result = await ossService.list({
      bucket: q.bucket as string | undefined,
      uploaderId: q.uploaderId as string | undefined,
      page,
      pageSize,
    });
    return okPage(result.items, result.total, result.page, result.pageSize);
  });

  // Get file metadata
  router.get("/api/oss/:id", perm("oss", "file:query"), async (ctx) => {
    const id = (ctx.params as Record<string, string>).id;
    const file = await ossService.getById(id);
    if (!file) return fail("File not found", 404, 404);
    return ok(file);
  });

  // Download file
  router.get("/api/oss/:id/download", perm("oss", "file:download"), async (ctx) => {
    const id = (ctx.params as Record<string, string>).id;
    const result = await ossService.download(id);
    if (!result) return fail("File not found", 404, 404);

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
      },
    });
  });

  // Get signed URL
  router.get("/api/oss/:id/url", perm("oss", "file:query"), async (ctx) => {
    const id = (ctx.params as Record<string, string>).id;
    const q = ctx.query as Record<string, unknown>;
    const expiresIn = q.expiresIn ? Number(q.expiresIn) : 3600;
    const url = await ossService.getSignedUrl(id, expiresIn);
    if (!url) return fail("File not found", 404, 404);
    return ok({ url, expiresIn });
  });

  // Delete file
  router.delete("/api/oss/:id", perm("oss", "file:delete"), async (ctx) => {
    const id = (ctx.params as Record<string, string>).id;
    await ossService.delete(id);
    return ok(null);
  });

  return router;
}
