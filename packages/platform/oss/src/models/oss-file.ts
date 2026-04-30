import { defineModel, column } from '@ventostack/database';

export const OSSFileModel = defineModel('sys_oss_file', {
  id: column.varchar({ primary: true, length: 36 }),
  originalName: column.varchar({ length: 256 }),
  storagePath: column.varchar({ length: 512 }),
  size: column.bigint(),
  mimeType: column.varchar({ length: 128, nullable: true }),
  extension: column.varchar({ length: 16, nullable: true }),
  bucket: column.varchar({ length: 64, default: 'default' }),
  uploaderId: column.varchar({ length: 36, nullable: true }),
  refCount: column.int({ default: 0 }),
  metadata: column.json({ nullable: true }),
}, { timestamps: true });
