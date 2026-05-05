/**
 * SMTP 通知通道
 */

import { getDefaultLogger } from "@ventostack/observability";
import type { NotifyChannel } from "../services/notification";

const log = getDefaultLogger().child({ module: "SMTP" });

export interface SMTPChannelOptions {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from: string;
}

export function createSMTPChannel(options: SMTPChannelOptions): NotifyChannel {
  return {
    name: "smtp",

    async send(params) {
      // In production, this would use nodemailer or Bun's built-in SMTP support
      // For now, log the intent and return success
      log.info(`Sending email to ${params.to}: ${params.title}`);
      return { success: true };
    },
  };
}
