import { escapeMarkdownV2, truncateMarkdownV2Safely } from '@/tree/telegram/format-markdown-v2';

export const TELEGRAM_CAPTION_MAX = 1024;

/**
 * Sanitize caption for MarkdownV2 mode.
 * Backslash-escape so user captions render literally.
 */
export function sanitizeCaption(text: string): string {
  const escaped = escapeMarkdownV2(text.trim());
  return truncateMarkdownV2Safely(escaped, TELEGRAM_CAPTION_MAX);
}

/**
 * Mask bot token in logs: show only first 6 chars.
 * Format: bot<6chars>...
 */
export function maskToken(token: string): string {
  return `bot${token.slice(0, 6)}...`;
}

export function buildTelegramMessageUrl(chat: { id: number; username?: string }, messageId: number): string {
  if (chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }
  if (String(chat.id).startsWith('-100')) {
    const channelNumeric = String(chat.id).replace(/^-100/, '');
    return `https://t.me/c/${channelNumeric}/${messageId}`;
  }
  return `https://t.me/message/${messageId}`;
}
