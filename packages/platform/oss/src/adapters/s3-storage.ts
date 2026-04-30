/**
 * S3 兼容存储适配器
 *
 * 通过 presigned URL 实现签名访问。
 * 实际写入/读取需要外部 HTTP 客户端或 SDK。
 * 此处提供接口骨架，实际部署时接入具体 S3 SDK。
 */

import type { StorageAdapter } from "./storage";

export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 公开访问 base URL，若设置则 getSignedUrl 返回此 URL 而非签名 */
  publicBaseUrl?: string;
}

export function createS3Storage(options: S3StorageOptions): StorageAdapter {
  const { bucket, publicBaseUrl } = options;

  return {
    async write(_key, _data, _contentType) {
      // TODO: 接入 S3 SDK (AWS, MinIO, R2 等)
      throw new Error("S3 storage write not implemented — integrate S3 SDK");
    },

    async read(_key) {
      // TODO: 接入 S3 SDK
      throw new Error("S3 storage read not implemented — integrate S3 SDK");
    },

    async delete(_key) {
      // TODO: 接入 S3 SDK
      throw new Error("S3 storage delete not implemented — integrate S3 SDK");
    },

    async exists(_key) {
      // TODO: 接入 S3 SDK
      throw new Error("S3 storage exists not implemented — integrate S3 SDK");
    },

    async getSignedUrl(key, expiresIn = 3600) {
      if (publicBaseUrl) {
        return `${publicBaseUrl}/${key}`;
      }
      // TODO: 生成 presigned URL
      throw new Error("S3 storage getSignedUrl not implemented — integrate S3 SDK");
    },
  };
}
