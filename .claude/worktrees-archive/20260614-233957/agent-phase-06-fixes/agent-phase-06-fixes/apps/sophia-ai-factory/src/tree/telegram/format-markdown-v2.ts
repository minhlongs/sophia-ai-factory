/**
 * Telegram MarkdownV2 escaping helpers.
 *
 * Wave 20 Phase 01 (7A): replaces the previous strip approach in `sanitizeCaption`.
 * Per Telegram Bot API spec, the following chars MUST be escaped with backslash
 * when sending with `parse_mode: 'MarkdownV2'`:
 *
 *   _ * [ ] ( ) ~ ` > # + - = | { } . ! \
 *
 * https://core.telegram.org/bots/api#markdownv2-style
 *
 * @module tree/telegram/format-markdown-v2
 */

/** Regex matches every MarkdownV2 special character that needs escaping. */
const MARKDOWN_V2_SPECIALS = /([_*[\]()~`>#+\-=|{}.!\\])/g;

/**
 * Escape ALL MarkdownV2 special characters with a leading backslash so the
 * Telegram Bot API renders user text literally instead of attempting to parse
 * formatting. Idempotent only on already-escaped strings is NOT guaranteed —
 * call once on raw user input.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIALS, '\\$1');
}

/**
 * Slice an already-escaped MarkdownV2 string to `maxLen`, dropping a dangling
 * single backslash at the end so we never send `...\\` (which Telegram rejects
 * as malformed escape).
 */
export function truncateMarkdownV2Safely(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  let sliced = text.slice(0, maxLen);
  // Count trailing backslashes — even count is safe (\\=literal backslash),
  // odd count means a dangling escape we must drop.
  let trailing = 0;
  for (let i = sliced.length - 1; i >= 0 && sliced[i] === '\\'; i--) trailing++;
  if (trailing % 2 === 1) sliced = sliced.slice(0, -1);
  return sliced;
}
