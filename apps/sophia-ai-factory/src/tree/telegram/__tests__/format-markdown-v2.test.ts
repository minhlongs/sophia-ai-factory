/**
 * Unit tests for Telegram MarkdownV2 formatting utilities
 * @module tree/telegram/__tests__/format-markdown-v2.test
 */

import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2, truncateMarkdownV2Safely } from '../format-markdown-v2';

describe('TelegramMarkdownV2', () => {
  describe('escapeMarkdownV2', () => {
    it('should escape all special characters', () => {
      const input = 'Hello _world* with [brackets] and (parens) ~backticks` >hash# plus+ minus- equal= pipe| brace{}. exclamation! and backslash\\';
      const result = escapeMarkdownV2(input);

      expect(result).toContain('\\_');
      expect(result).toContain('\\*');
      expect(result).toContain('\\[');
      expect(result).toContain('\\]');
      expect(result).toContain('\\(');
      expect(result).toContain('\\)');
      expect(result).toContain('\\~');
      expect(result).toContain('\\`');
      expect(result).toContain('\\>');
      expect(result).toContain('\\#');
      expect(result).toContain('\\+');
      expect(result).toContain('\\-');
      expect(result).toContain('\\=');
      expect(result).toContain('\\|');
      expect(result).toContain('\\{');
      expect(result).toContain('\\}');
      expect(result).toContain('\\.');
      expect(result).toContain('\\!');
      expect(result).toContain('\\\\'); // backslash itself
    });

    it('should handle empty string', () => {
      expect(escapeMarkdownV2('')).toBe('');
    });

    it('should handle strings with no special characters', () => {
      const input = 'Hello world plain text';
      expect(escapeMarkdownV2(input)).toBe(input);
    });

    it('should escape backslash itself', () => {
      expect(escapeMarkdownV2('\\')).toBe('\\\\');
    });

    it('should handle repeated special characters', () => {
      const input = '***';
      const result = escapeMarkdownV2(input);
      expect(result).toBe('\\*\\*\\*');
    });

    it('should not double-escape already escaped characters (not idempotent by design)', () => {
      const input = '\\_already escaped\\_';
      const result = escapeMarkdownV2(input);

      // Double escape will happen: \_ -> \\\_
      expect(result).toContain('\\\\\\_');
    });

    it('should handle Vietnamese characters with special chars', () => {
      const input = 'Xin chào_việt_nam* với [nhóm]';
      const result = escapeMarkdownV2(input);

      expect(result).toContain('\\_');
      expect(result).toContain('\\*');
      expect(result).toContain('\\[');
      expect(result).toContain('\\]');
      expect(result).toContain('Xin chào'); // Vietnamese preserved
    });
  });

  describe('truncateMarkdownV2Safely', () => {
    it('should return original string if within maxLen', () => {
      const input = 'Short text';
      expect(truncateMarkdownV2Safely(input, 20)).toBe(input);
    });

    it('should truncate string to maxLen', () => {
      const input = 'This is a long text that should be truncated';
      const result = truncateMarkdownV2Safely(input, 20);

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toBe('This is a long text ');
    });

    it('should drop dangling single backslash', () => {
      // Already escaped text ending with \ (single backslash = incomplete escape)
      const input = 'Hello\\_World\\';
      const result = truncateMarkdownV2Safely(input, 12);

      expect(result.endsWith('\\')).toBe(false);
    });

    it('should keep even number of trailing backslashes', () => {
      // Two backslashes = literal backslash, valid
      const input = 'Hello\\\\';
      const result = truncateMarkdownV2Safely(input, 8);

      expect(result.endsWith('\\\\')).toBe(true);
    });

    it('should drop dangling backslash after truncation', () => {
      const input = 'Hello _World* [Test]\\';
      const escaped = escapeMarkdownV2(input);
      // escaped ends with \\ (since \ was escaped to \\)
      const result = truncateMarkdownV2Safely(escaped, 15);

      // Check that result doesn't end with incomplete escape
      const trailingBackslashes = (result.match(/\\+$/) ?? [""])[0];
      expect(trailingBackslashes.length % 2).toBe(0);
    });

    it('should handle maxLen of 0', () => {
      const input = 'Hello World';
      const result = truncateMarkdownV2Safely(input, 0);

      expect(result).toBe('');
    });

    it('should handle already truncated text with no trailing backslash', () => {
      const input = 'Hello World';
      const result = truncateMarkdownV2Safely(input, 5);

      expect(result).toBe('Hello');
    });

    it('should handle complex escaped sequence', () => {
      const input = 'Test \\*with\\* multiple \\_escaped\\_ chars\\\\';
      const result = truncateMarkdownV2Safely(input, 25);

      // Verify no dangling escape
      const trailingBackslashes = (result.match(/\\+$/) ?? [""])[0];
      expect(trailingBackslashes.length % 2).toBe(0);
    });

    it('should preserve escaped characters within truncated text', () => {
      const input = 'Hello\\_Amazing\\_World';
      const result = truncateMarkdownV2Safely(input, 14);

      expect(result).toContain('\\_');
    });
  });

  describe('Integration: escape then truncate', () => {
    it('should produce valid MarkdownV2 for Telegram', () => {
      const input = 'Check this out: _bold* and [link](url)';
      const escaped = escapeMarkdownV2(input);
      const truncated = truncateMarkdownV2Safely(escaped, 30);

      // Result should be valid - no unescaped special chars at the end
      const lastChar = truncated[truncated.length - 1];
      const specialChars = '_*[]()~`>#+-=|{}.!\\';

      // If last char is a special char, it should be escaped (preceded by backslash)
      if (specialChars.includes(lastChar)) {
        expect(truncated[truncated.length - 2]).toBe('\\');
      }
    });

    it('should handle edge case: maxLen cuts mid-escape', () => {
      const input = 'Text with \\_escape\\_ in middle';
      const escaped = escapeMarkdownV2(input);
      // Force cut at position that leaves dangling escape
      const result = truncateMarkdownV2Safely(escaped, 18);

      // The function should have removed the dangling escape
      const endsWithBackslash = result.endsWith('\\');
      const secondLastIsBackslash = result.length > 1 && result[result.length - 2] === '\\';

      // Either doesn't end with backslash, or ends with even number of them
      const trailingBackslashes = (result.match(/\\+$/) ?? [""])[0];
      expect(trailingBackslashes.length % 2).toBe(0);
    });
  });
});
