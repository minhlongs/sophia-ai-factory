/**
 * Unit tests: format-markdown-v2 helpers.
 *
 * Covers all 19 MarkdownV2 special chars + safe truncation edge cases.
 */

import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2, truncateMarkdownV2Safely } from '../format-markdown-v2';

describe('escapeMarkdownV2', () => {
  const specials: Array<[string, string]> = [
    ['_', '\\_'],
    ['*', '\\*'],
    ['[', '\\['],
    [']', '\\]'],
    ['(', '\\('],
    [')', '\\)'],
    ['~', '\\~'],
    ['`', '\\`'],
    ['>', '\\>'],
    ['#', '\\#'],
    ['+', '\\+'],
    ['-', '\\-'],
    ['=', '\\='],
    ['|', '\\|'],
    ['{', '\\{'],
    ['}', '\\}'],
    ['.', '\\.'],
    ['!', '\\!'],
    ['\\', '\\\\'],
  ];

  it.each(specials)('escapes %s correctly', (input, expected) => {
    expect(escapeMarkdownV2(input)).toBe(expected);
  });

  it('passes through plain alphanumerics unchanged', () => {
    expect(escapeMarkdownV2('Hello World 123')).toBe('Hello World 123');
  });

  it('escapes a sentence with mixed specials', () => {
    expect(escapeMarkdownV2('Check out *amazing* video!')).toBe('Check out \\*amazing\\* video\\!');
  });

  it('escapes URL-like text containing dots and parens', () => {
    expect(escapeMarkdownV2('See example.com (great)')).toBe('See example\\.com \\(great\\)');
  });

  it('escapes Vietnamese with diacritics + period', () => {
    expect(escapeMarkdownV2('Xin chào, thế giới.')).toBe('Xin chào, thế giới\\.');
  });

  it('escapes existing backslash so source `\\n` becomes `\\\\n`', () => {
    expect(escapeMarkdownV2('line\\nbreak')).toBe('line\\\\nbreak');
  });

  it('idempotent? — escaping twice double-escapes (so caller must escape ONCE)', () => {
    const once = escapeMarkdownV2('foo.bar');
    expect(once).toBe('foo\\.bar');
    const twice = escapeMarkdownV2(once);
    expect(twice).toBe('foo\\\\\\.bar');
  });
});

describe('truncateMarkdownV2Safely', () => {
  it('returns unchanged when shorter than maxLen', () => {
    expect(truncateMarkdownV2Safely('hello', 100)).toBe('hello');
  });

  it('slices when longer than maxLen', () => {
    expect(truncateMarkdownV2Safely('abcdefgh', 4)).toBe('abcd');
  });

  it('drops trailing single backslash (broken escape)', () => {
    // 'abc\\' has odd-count trailing backslash → drop
    expect(truncateMarkdownV2Safely('abc\\xyz', 4)).toBe('abc');
  });

  it('keeps even-count trailing backslashes (literal backslash escape sequence)', () => {
    // 'a\\\\' = a + literal backslash escape — even count, safe
    expect(truncateMarkdownV2Safely('a\\\\xyz', 3)).toBe('a\\\\');
  });

  it('handles maxLen=0 edge', () => {
    expect(truncateMarkdownV2Safely('abc', 0)).toBe('');
  });

  it('preserves a complete \\. escape pair just under maxLen', () => {
    // 'foo\\.' = 5 chars → slice at 5 keeps it
    expect(truncateMarkdownV2Safely('foo\\.bar', 5)).toBe('foo\\.');
  });
});
