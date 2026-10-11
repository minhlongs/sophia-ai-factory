import { TELEGRAM_MAX_MESSAGE_LENGTH } from './types';

/**
 * Splits an already-escaped or formatted MarkdownV2 string into chunks conforming to Telegram limits.
 * Guarantees that:
 * 1. No chunk exceeds maxLength (default 4096).
 * 2. Cuts prefer natural boundaries: paragraph (\n\n) -> newline (\n) -> space ( ).
 * 3. Never splits between a backslash and the escaped character (odd trailing backslash guard).
 * 4. Never splits inside a UTF-16 surrogate pair (emoji guard).
 */
export function splitTelegramMarkdownV2(
  text: string,
  maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let cutIndex = maxLength;
    const window = remaining.slice(0, maxLength);

    // 1. Prefer natural boundaries: paragraph -> newline -> space
    const doubleNewline = window.lastIndexOf('\n\n');
    const singleNewline = window.lastIndexOf('\n');
    const space = window.lastIndexOf(' ');

    if (doubleNewline >= maxLength * 0.3) {
      cutIndex = doubleNewline + 2;
    } else if (singleNewline >= maxLength * 0.3) {
      cutIndex = singleNewline + 1;
    } else if (space >= maxLength * 0.3) {
      cutIndex = space + 1;
    }

    // 2. Guard against surrogate pair splitting (high surrogate code unit)
    if (cutIndex > 0) {
      const prevCode = remaining.charCodeAt(cutIndex - 1);
      if (prevCode >= 0xd800 && prevCode <= 0xdbff) {
        cutIndex -= 1;
      }
    }

    // 3. Guard against severed escape sequences (odd trailing backslashes)
    let backslashCount = 0;
    for (let i = cutIndex - 1; i >= 0 && remaining[i] === '\\'; i--) {
      backslashCount++;
    }
    if (backslashCount % 2 === 1) {
      cutIndex -= 1;
    }

    const currentChunk = remaining.slice(0, cutIndex).trimEnd();
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    remaining = remaining.slice(cutIndex).trimStart();
  }

  return chunks;
}
