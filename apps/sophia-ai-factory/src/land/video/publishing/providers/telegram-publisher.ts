/**
 * Telegram Publisher Adapter
 * Sends videos/messages to Telegram channels/groups via Bot API.
 * Falls back to mock responses when TELEGRAM_BOT_TOKEN is absent.
 */

import type { Publisher, PublishMeta, PublishResult, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export class TelegramPublisher implements Publisher {
  constructor(private readonly botToken: string, private readonly chatId: string) {}

  private api(method: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${TELEGRAM_API}${this.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async publish(videoUrl: string, meta: PublishMeta): Promise<PublishResult> {
    try {
      const messageId = await this.doPublish(videoUrl, meta);
      return { success: true, externalPostId: messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  private async doPublish(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (!this.botToken) {
      logger.warn('[TelegramPublisher] Mock mode — no bot token');
      return `mock_telegram_${Date.now()}`;
    }

    const caption = meta.caption.slice(0, 1024);

    if (videoUrl) {
      const response = await this.api('sendVideo', {
        chat_id: this.chatId,
        video: videoUrl,
        caption,
        parse_mode: 'MarkdownV2',
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown');
        throw new Error(`Telegram sendVideo failed: ${response.status} ${errText}`);
      }

      const data = (await response.json()) as { ok: boolean; result?: { message_id: number } };

      if (!data.ok || !data.result) {
        throw new Error('Telegram sendVideo returned ok=false');
      }

      logger.info('[TelegramPublisher] Video sent', { messageId: data.result.message_id });
      return String(data.result.message_id);
    }

    const response = await this.api('sendMessage', {
      chat_id: this.chatId,
      text: caption,
      parse_mode: 'MarkdownV2',
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      throw new Error(`Telegram sendMessage failed: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as { ok: boolean; result?: { message_id: number } };

    if (!data.ok || !data.result) {
      throw new Error('Telegram sendMessage returned ok=false');
    }

    return String(data.result.message_id);
  }

  async getStatus(externalPostId: string): Promise<PublishStatus> {
    if (!this.botToken || externalPostId.startsWith('mock_')) {
      return 'live';
    }

    try {
      const response = await this.api('getMessage', {
        chat_id: this.chatId,
        message_id: Number(externalPostId),
      });

      if (!response.ok) {
        if (response.status === 404) return 'failed';
        return 'processing';
      }

      const data = (await response.json()) as {
        ok: boolean;
        result?: { forward_date?: number };
      };

      if (!data.ok || !data.result) return 'processing';
      return 'live';
    } catch {
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (!this.botToken || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }

    try {
      const response = await this.api('getMessage', {
        chat_id: this.chatId,
        message_id: Number(externalPostId),
      });

      if (!response.ok) {
        logger.warn('[TelegramPublisher] getMetrics API non-ok', { status: response.status });
        return { views: 0, likes: 0, comments: 0 };
      }

      const data = (await response.json()) as {
        ok: boolean;
        result?: { views?: number; forward_count?: number };
      };

      if (!data.ok || !data.result) {
        return { views: 0, likes: 0, comments: 0 };
      }

      return {
        views: data.result.views ?? 0,
        likes: 0,
        comments: 0,
        shares: data.result.forward_count ?? 0,
      };
    } catch (err) {
      logger.warn('[TelegramPublisher] getMetrics fetch error', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return { views: 0, likes: 0, comments: 0 };
    }
  }
}
