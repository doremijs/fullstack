/**
 * 存储适配器接口
 */
export interface StorageAdapter {
  write(key: string, data: Buffer | ReadableStream, contentType?: string): Promise<void>;
  read(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
