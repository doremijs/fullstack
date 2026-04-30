/**
 * SMS 通知通道
 */

import type { NotifyChannel } from "../services/notification";

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
      console.log(`[SMS] Sending to ${params.to}: ${params.content}`);
      return { success: true };
    },
  };
}
