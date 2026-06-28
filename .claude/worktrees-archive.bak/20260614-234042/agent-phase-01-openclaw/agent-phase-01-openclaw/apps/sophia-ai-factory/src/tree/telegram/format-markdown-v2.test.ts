/**
 * Telegram MarkdownV2 escaping helper tests
 *
 * Telegram Bot API rejects malformed escapes — these tests pin the contract
 * for the @Sophia_Bbot integration (PROTECTED FLOW per CLAUDE.md).
 */

import { describe, it, expect } from 'vitest'
import { escapeMarkdownV2, truncateMarkdownV2Safely } from './format-markdown-v2'

describe('escapeMarkdownV2', () => {
  it('escapes every MarkdownV2 special char with a leading backslash', () => {
    const specials = '_*[]()~`>#+-=|{}.!\\'
    const escaped = escapeMarkdownV2(specials)
    for (const ch of specials) {
      expect(escaped).toContain(`\\${ch}`)
    }
  })

  it('returns plain text unchanged', () => {
    expect(escapeMarkdownV2('Hello world')).toBe('Hello world')
    expect(escapeMarkdownV2('Sophia AI Factory 2026')).toBe('Sophia AI Factory 2026')
  })

  it('returns empty string for empty input', () => {
    expect(escapeMarkdownV2('')).toBe('')
  })

  it('escapes multiple specials in a row', () => {
    expect(escapeMarkdownV2('***')).toBe('\\*\\*\\*')
    expect(escapeMarkdownV2('!?.')).toBe('\\!?\\.')
  })

  it('escapes specials embedded in text', () => {
    expect(escapeMarkdownV2('Hello, world!')).toBe('Hello, world\\!')
    expect(escapeMarkdownV2('Visit https://example.com')).toBe('Visit https://example\\.com')
  })

  it('does not double-escape (not idempotent — caller must call once)', () => {
    const once = escapeMarkdownV2('a.b')      // 'a\\.b'
    const twice = escapeMarkdownV2(once)       // 'a\\\\.b' (backslash itself escaped)
    expect(once).toBe('a\\.b')
    expect(twice).toBe('a\\\\\\.b')
  })

  it('handles unicode and emoji without escaping them', () => {
    expect(escapeMarkdownV2('Tiếng Việt')).toBe('Tiếng Việt')
    expect(escapeMarkdownV2('hello 👋')).toBe('hello 👋')
  })
})

describe('truncateMarkdownV2Safely', () => {
  it('returns text unchanged when length is at or below maxLen', () => {
    expect(truncateMarkdownV2Safely('short', 10)).toBe('short')
    expect(truncateMarkdownV2Safely('exact', 5)).toBe('exact')
  })

  it('truncates clean text to exact maxLen', () => {
    expect(truncateMarkdownV2Safely('abcdefghij', 5)).toBe('abcde')
  })

  it('drops dangling single backslash to avoid malformed escape', () => {
    // 'abc\\d' (5 chars), truncate to 4 → 'abc\\' (dangling) → must become 'abc'
    expect(truncateMarkdownV2Safely('abc\\d', 4)).toBe('abc')
  })

  it('preserves even-count trailing backslashes (literal \\)', () => {
    // '\\\\' (literal backslash = 2 chars in source). Truncate to 2 keeps both.
    expect(truncateMarkdownV2Safely('aa\\\\', 4)).toBe('aa\\\\')
  })

  it('handles empty string', () => {
    expect(truncateMarkdownV2Safely('', 10)).toBe('')
  })

  it('handles maxLen larger than string length', () => {
    expect(truncateMarkdownV2Safely('short', 1000)).toBe('short')
  })

  it('returns empty when maxLen is 0', () => {
    expect(truncateMarkdownV2Safely('anything', 0)).toBe('')
  })

  it('drops backslash if it would be the last surviving char', () => {
    expect(truncateMarkdownV2Safely('\\abc', 1)).toBe('')
  })

  it('escape + truncate composes cleanly for user captions', () => {
    const raw = 'Hello, world!'
    const escaped = escapeMarkdownV2(raw)               // 'Hello, world\\!'
    const truncated = truncateMarkdownV2Safely(escaped, 12) // 'Hello, world' (drops dangling \\)
    expect(truncated).toBe('Hello, world')
  })
})
