/**
 * SMTP 通知通道
 */

import type { NotifyChannel } from "../services/notification";

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
      console.log(`[SMTP] Sending email to ${params.to}: ${params.title}`);
      return { success: true };
    },
  };
}
