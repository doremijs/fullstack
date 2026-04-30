/**
 * @ventostack/oss - OSS 服务
 * 文件上传、下载、删除、签名 URL、列表查询
 */

import type { SqlExecutor } from "@ventostack/database";
import type { StorageAdapter } from "../adapters/storage";
import { detectMIME, mimeFromExtension } from "./mime-detect";

/** 上传参数 */
export interface UploadParams {
  filename: string;
  data: Buffer;
  contentType?: string;
  bucket?: string;
}

/** 文件记录 */
export interface OSSFileRecord {
  id: string;
  originalName: string;
  storagePath: string;
  size: number;
  mimeType: string | null;
  extension: string | null;
  bucket: string;
  uploaderId: string | null;
  createdAt: string;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 文件列表查询参数 */
export interface ListParams {
  bucket?: string;
  uploaderId?: string;
  page?: number;
  pageSize?: number;
}

/** OSS 服务接口 */
export interface OSSService {
  upload(params: UploadParams, uploaderId: string): Promise<OSSFileRecord>;
  download(fileId: string): Promise<{ stream: ReadableStream; contentType: string; filename: string } | null>;
  delete(fileId: string): Promise<void>;
  getSignedUrl(fileId: string, expiresIn?: number): Promise<string | null>;
  getById(fileId: string): Promise<OSSFileRecord | null>;
  list(params: ListParams): Promise<PaginatedResult<OSSFileRecord>>;
}

export function createOSSService(deps: {
  executor: SqlExecutor;
  storage: StorageAdapter;
}): OSSService {
  const { executor, storage } = deps;

  return {
    async upload(params, uploaderId) {
      const { filename, data, contentType, bucket = "default" } = params;
      const id = crypto.randomUUID();

      // Detect MIME
      const ext = filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase()}` : null;
      const detectedMime = data.length >= 12 ? detectMIME(data) : null;
      const mime = contentType ?? detectedMime ?? (ext ? mimeFromExtension(ext) : null);

      // Generate storage path: bucket/yyyymmdd/id.ext
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const storagePath = `${bucket}/${date}/${id}${ext ?? ""}`;

      // Write to storage adapter
      await storage.write(storagePath, data, mime ?? undefined);

      // Insert metadata record
      await executor(
        `INSERT INTO sys_oss_file (id, original_name, storage_path, size, mime_type, extension, bucket, uploader_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [id, filename, storagePath, data.length, mime, ext, bucket, uploaderId],
      );

      return {
        id,
        originalName: filename,
        storagePath,
        size: data.length,
        mimeType: mime,
        extension: ext,
        bucket,
        uploaderId,
        createdAt: new Date().toISOString(),
      };
    },

    async download(fileId) {
      const rows = await executor(
        `SELECT id, original_name, storage_path, mime_type FROM sys_oss_file WHERE id = $1`,
        [fileId],
      );
      const files = rows as Array<Record<string, unknown>>;
      if (files.length === 0) return null;

      const file = files[0]!;
      const stream = await storage.read(file.storage_path as string);
      if (!stream) return null;

      return {
        stream,
        contentType: (file.mime_type as string) ?? "application/octet-stream",
        filename: file.original_name as string,
      };
    },

    async delete(fileId) {
      const rows = await executor(
        `SELECT storage_path FROM sys_oss_file WHERE id = $1`,
        [fileId],
      );
      const files = rows as Array<Record<string, unknown>>;
      if (files.length === 0) return;

      await storage.delete(files[0]!.storage_path as string);
      await executor(`DELETE FROM sys_oss_file WHERE id = $1`, [fileId]);
    },

    async getSignedUrl(fileId, expiresIn = 3600) {
      const rows = await executor(
        `SELECT storage_path FROM sys_oss_file WHERE id = $1`,
        [fileId],
      );
      const files = rows as Array<Record<string, unknown>>;
      if (files.length === 0) return null;

      return storage.getSignedUrl(files[0]!.storage_path as string, expiresIn);
    },

    async getById(fileId) {
      const rows = await executor(
        `SELECT id, original_name, storage_path, size, mime_type, extension, bucket, uploader_id, created_at
         FROM sys_oss_file WHERE id = $1`,
        [fileId],
      );
      const files = rows as Array<Record<string, unknown>>;
      if (files.length === 0) return null;

      const row = files[0]!;
      return {
        id: row.id as string,
        originalName: row.original_name as string,
        storagePath: row.storage_path as string,
        size: Number(row.size),
        mimeType: (row.mime_type as string) ?? null,
        extension: (row.extension as string) ?? null,
        bucket: row.bucket as string,
        uploaderId: (row.uploader_id as string) ?? null,
        createdAt: row.created_at as string,
      };
    },

    async list(params) {
      const { bucket, uploaderId, page = 1, pageSize = 10 } = params;
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (bucket) {
        conditions.push(`bucket = $${idx++}`);
        values.push(bucket);
      }
      if (uploaderId) {
        conditions.push(`uploader_id = $${idx++}`);
        values.push(uploaderId);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await executor(`SELECT COUNT(*) as total FROM sys_oss_file ${where}`, values);
      const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

      const offset = (page - 1) * pageSize;
      const rows = await executor(
        `SELECT id, original_name, storage_path, size, mime_type, extension, bucket, uploader_id, created_at
         FROM sys_oss_file ${where}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, pageSize, offset],
      );

      const items = (rows as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        originalName: row.original_name as string,
        storagePath: row.storage_path as string,
        size: Number(row.size),
        mimeType: (row.mime_type as string) ?? null,
        extension: (row.extension as string) ?? null,
        bucket: row.bucket as string,
        uploaderId: (row.uploader_id as string) ?? null,
        createdAt: row.created_at as string,
      }));

      return { items, total, page, pageSize, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
    },
  };
}
