// @aeron/core - 插件系统

import type { AeronApp } from "./app";

/** 插件接口 */
export interface Plugin {
  /** 插件名称 */
  name: string;
  /**
   * 安装插件到应用
   * @param app - Aeron 应用实例
   */
  install(app: AeronApp): void | Promise<void>;
}
