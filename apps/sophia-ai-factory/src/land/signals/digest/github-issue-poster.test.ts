/**
 * Tests for GitHub Issue idempotent upsert
 *
 * Mocks globalThis.fetch — no real HTTP calls.
 * Covers: create new issue, update existing issue, missing token skip,
 * API non-OK handling, ISO week helper, title builder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getIsoWeek,
  buildIssueTitle,
  findExistingIssue,
  upsertGithubIssue,
} from './github-issue-poster'

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(responses: Array<{ ok: boolean; status?: number; json?: unknown; text?: string }>) {
  let callIndex = 0
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return {
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 422),
      json: vi.fn().mockResolvedValue(resp.json ?? {}),
      text: vi.fn().mockResolvedValue(resp.text ?? ''),
    }
  }))
}

// ── ISO week helper ───────────────────────────────────────────────────────────

describe('getIsoWeek()', () => {
  it('returns 16 for 2026-04-17 (known Thursday week 16)', () => {
    expect(getIsoWeek(new Date('2026-04-17'))).toBe(16)
  })

  it('returns 1 for first week of year', () => {
    // 2026-01-01 is a Thursday — ISO week 1
    expect(getIsoWeek(new Date('2026-01-01'))).toBe(1)
  })
})

describe('buildIssueTitle()', () => {
  it('produces expected title format', () => {
    const title = buildIssueTitle(new Date('2026-04-17'))
    expect(title).toBe('Weekly Metrics Digest — Week 16 (2026-04-17)')
  })
})

// ── findExistingIssue() ───────────────────────────────────────────────────────

describe('findExistingIssue()', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns matching issue when title found', async () => {
    mockFetch([{
      ok: true,
      json: [
        { number: 42, html_url: 'https://github.com/repo/issues/42', title: 'Weekly Metrics Digest — Week 16 (2026-04-17)' },
        { number: 41, html_url: 'https://github.com/repo/issues/41', title: 'Weekly Metrics Digest — Week 15 (2026-04-10)' },
      ],
    }])

    const result = await findExistingIssue('owner/repo', 'Weekly Metrics Digest — Week 16 (2026-04-17)', 'tok')
    expect(result).toEqual({ number: 42, html_url: 'https://github.com/repo/issues/42' })
  })

  it('returns null when no title match', async () => {
    mockFetch([{
      ok: true,
      json: [
        { number: 41, html_url: 'https://github.com/repo/issues/41', title: 'Weekly Metrics Digest — Week 15 (2026-04-10)' },
      ],
    }])

    const result = await findExistingIssue('owner/repo', 'Weekly Metrics Digest — Week 16 (2026-04-17)', 'tok')
    expect(result).toBeNull()
  })

  it('returns null on non-OK response', async () => {
    mockFetch([{ ok: false, status: 403 }])
    const result = await findExistingIssue('owner/repo', 'any title', 'bad-tok')
    expect(result).toBeNull()
  })
})

// ── upsertGithubIssue() ───────────────────────────────────────────────────────

describe('upsertGithubIssue()', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN_DIGEST = 'test-gh-token'
    process.env.GITHUB_REPO = 'owner/test-repo'
  })

  afterEach(() => {
    delete process.env.GITHUB_TOKEN_DIGEST
    delete process.env.GITHUB_REPO
    vi.unstubAllGlobals()
  })

  it('creates new issue when none exists (POST path)', async () => {
    mockFetch([
      // findExistingIssue → empty list
      { ok: true, json: [] },
      // POST new issue
      { ok: true, json: { number: 10, html_url: 'https://github.com/owner/test-repo/issues/10', title: 'Weekly Metrics Digest — Week 16 (2026-04-17)' } },
    ])

    const result = await upsertGithubIssue({
      title: 'Weekly Metrics Digest — Week 16 (2026-04-17)',
      body: '## Test body',
    })

    expect(result).not.toBeNull()
    expect(result?.action).toBe('created')
    expect(result?.issueNumber).toBe(10)
    expect(result?.url).toBe('https://github.com/owner/test-repo/issues/10')
  })

  it('updates existing issue when same-week issue found (PATCH path)', async () => {
    mockFetch([
      // findExistingIssue → existing issue
      {
        ok: true,
        json: [{ number: 7, html_url: 'https://github.com/owner/test-repo/issues/7', title: 'Weekly Metrics Digest — Week 16 (2026-04-17)' }],
      },
      // PATCH existing issue
      { ok: true, json: { number: 7, html_url: 'https://github.com/owner/test-repo/issues/7', title: 'Weekly Metrics Digest — Week 16 (2026-04-17)' } },
    ])

    const result = await upsertGithubIssue({
      title: 'Weekly Metrics Digest — Week 16 (2026-04-17)',
      body: '## Updated body',
    })

    expect(result?.action).toBe('updated')
    expect(result?.issueNumber).toBe(7)
  })

  it('returns null when GITHUB_TOKEN_DIGEST missing — no throw', async () => {
    delete process.env.GITHUB_TOKEN_DIGEST
    const result = await upsertGithubIssue({ title: 'test', body: 'body' })
    expect(result).toBeNull()
  })

  it('returns null on POST non-OK response — no throw', async () => {
    mockFetch([
      { ok: true, json: [] },        // list → empty
      { ok: false, status: 422 },    // POST → error
    ])

    const result = await upsertGithubIssue({ title: 'test', body: 'body' })
    expect(result).toBeNull()
  })

  it('returns null on PATCH non-OK response — no throw', async () => {
    mockFetch([
      { ok: true, json: [{ number: 5, html_url: 'https://github.com/owner/test-repo/issues/5', title: 'test' }] },
      { ok: false, status: 500 },    // PATCH → error
    ])

    const result = await upsertGithubIssue({ title: 'test', body: 'body' })
    expect(result).toBeNull()
  })
})
