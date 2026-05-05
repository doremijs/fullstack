/**
 * SMS 通知通道
 */

import { getDefaultLogger } from "@ventostack/observability";
import type { NotifyChannel } from "../services/notification";

const log = getDefaultLogger().child({ module: "SMS" });

export interface SMSChannelOptions {
  provider: string;
  apiKey: string;
  apiSecret: string;
  signName: string;
}

export function createSMSChannel(options: SMSChannelOptions): NotifyChannel {
  return {
    name: "sms",

    async send(params) {
      // In production, this would call the SMS provider API (e.g., Twilio, Aliyun SMS)
      log.info(`Sending to ${params.to}: ${params.content}`);
      return { success: true };
    },
  };
}
