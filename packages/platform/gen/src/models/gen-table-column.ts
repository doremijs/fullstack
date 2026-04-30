import { defineModel, column } from '@ventostack/database';

export const GenTableColumnModel = defineModel('sys_gen_table_column', {
  id: column.varchar({ primary: true, length: 36 }),
  tableId: column.varchar({ length: 36 }),
  columnName: column.varchar({ length: 128 }),
  columnType: column.varchar({ length: 64 }),
  typescriptType: column.varchar({ length: 64 }),
  fieldName: column.varchar({ length: 128 }),
  fieldComment: column.varchar({ length: 256, nullable: true }),
  isPrimary: column.boolean({ default: false }),
  isNullable: column.boolean({ default: false }),
  isList: column.boolean({ default: true }),
  isInsert: column.boolean({ default: true }),
  isUpdate: column.boolean({ default: true }),
  isQuery: column.boolean({ default: false }),
  queryType: column.varchar({ length: 32, nullable: true }),
  sort: column.int({ default: 0 }),
}, { timestamps: false });
