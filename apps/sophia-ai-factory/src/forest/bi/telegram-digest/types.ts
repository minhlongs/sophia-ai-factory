import type { BrandingSettings } from '@/seed/tenant-settings/defaults';

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
export const TELEGRAM_SAFE_CHUNK_LENGTH = 4000;

/** Regex matching all Telegram MarkdownV2 reserved characters requiring a preceding backslash. */
export const TELEGRAM_MARKDOWN_V2_SPECIALS = /([_*[\]()~`>#+\-=|{}.!\\])/g;

export interface TelegramConfig {
  chatId?: string;
  botToken?: string;
  disableWebPagePreview?: boolean;
}

export interface TelegramDigestOptions extends TelegramConfig {
  branding?: Partial<BrandingSettings> | null;
  maxLength?: number;
}

export interface TelegramDigestResult {
  success: boolean;
  totalChunks: number;
  chunksSent: number;
  messageIds: number[];
  error?: string;
  skipped?: boolean;
  reason?: string;
}
