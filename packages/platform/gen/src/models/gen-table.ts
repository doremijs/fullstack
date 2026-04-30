import { defineModel, column } from '@ventostack/database';

export const GenTableModel = defineModel('sys_gen_table', {
  id: column.varchar({ primary: true, length: 36 }),
  tableName: column.varchar({ length: 128 }),
  className: column.varchar({ length: 128 }),
  moduleName: column.varchar({ length: 64 }),
  functionName: column.varchar({ length: 128 }),
  functionAuthor: column.varchar({ length: 64, nullable: true }),
  remark: column.varchar({ length: 512, nullable: true }),
  status: column.int({ default: 0 }),
}, { timestamps: true });
