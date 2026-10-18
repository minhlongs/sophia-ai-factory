/**
 * Telegram notification adapter for OpenClaw Gateway.
 * Sends campaign publication notifications via existing Telegram bot infrastructure.
 */

import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  PublishResult,
} from "@/tree/gateway/gateway-types";
import {
  CHANNEL_ID,
  sendNotification,
  checkTelegramBotHealth,
} from "./telegram-notification-transport";

export class TelegramNotificationAdapter implements ChannelAdapter {
  private chatId: string;
  private lastPublished: Date | undefined;

  /**
   * @param chatId - Telegram chat ID to send notifications to.
   *                 Typically the admin/owner chat ID from env config.
   */
  constructor(chatId?: string) {
    this.chatId = chatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID ?? "";
  }

  /** Send a campaign distribution notification via Telegram */
  async publish(content: CampaignOutput): Promise<PublishResult> {
    if (!this.chatId) {
      return {
        channelId: CHANNEL_ID,
        success: false,
        error: "No Telegram chat ID configured",
      };
    }

    const message = [
      `*Campaign Published*`,
      `Title: ${content.title}`,
      `Campaign: \`${content.campaignId}\``,
      content.tags.length > 0
        ? `Tags: ${content.tags.map((t) => `#${t}`).join(" ")}`
        : "",
      content.videoUrl ? `[Watch Video](${content.videoUrl})` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const sent = await sendNotification(this.chatId, message);

    if (sent) {
      this.lastPublished = new Date();
    }

    return {
      channelId: CHANNEL_ID,
      success: sent,
      error: sent ? undefined : "Failed to send Telegram notification",
    };
  }

  /** Get current channel status */
  async getStatus(): Promise<ChannelStatus> {
    return {
      channelId: CHANNEL_ID,
      healthy: !!process.env.TELEGRAM_BOT_TOKEN,
      lastPublished: this.lastPublished,
      queueSize: 0,
    };
  }

  /** Check if the Telegram bot connection is healthy */
  async healthCheck(): Promise<boolean> {
    return checkTelegramBotHealth();
  }
}
