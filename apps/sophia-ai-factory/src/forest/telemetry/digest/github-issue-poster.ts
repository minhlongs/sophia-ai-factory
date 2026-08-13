/**
 * GitHub Issue Poster — Idempotent Weekly Digest Upsert
 *
 * Creates a new GH Issue or updates the existing one for the current ISO week.
 * Title format: "Weekly Metrics Digest — Week {ISO_WEEK} ({YYYY-MM-DD})"
 * Label: "metrics:weekly"
 *
 * Idempotency: search open issues by label + title prefix; PATCH if found, POST if not.
 * SECURITY: GITHUB_TOKEN_DIGEST stored as CF secret, never logged.
 */

import { z } from 'zod'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

// ── Zod schemas for GH API responses ─────────────────────────────────────────

const GhIssueSchema = z.object({
  number: z.number(),
  html_url: z.string().url(),
  title: z.string(),
})

const GhIssueListSchema = z.array(GhIssueSchema)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpsertIssueParams {
  title: string
  body: string
  labels?: string[]
}

export interface UpsertIssueResult {
  url: string
  action: 'created' | 'updated'
  issueNumber: number
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

/** Returns ISO week number (1–53) for a given Date */
export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Build canonical issue title for a given date */
export function buildIssueTitle(date = new Date()): string {
  const week = getIsoWeek(date)
  const dateStr = date.toISOString().slice(0, 10)
  return `Weekly Metrics Digest — Week ${week} (${dateStr})`
}

// ── GH API helpers ────────────────────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/**
 * Find existing open issue by label + title prefix.
 * Returns the first match or null.
 */
export async function findExistingIssue(
  repo: string,
  title: string,
  token: string,
): Promise<{ number: number; html_url: string } | null> {
  if (!shouldAllowRequest('github')) {
    logger.warn('[digest/gh] Circuit breaker open for github, skipping')
    return null
  }
  const url = `https://api.github.com/repos/${repo}/issues?labels=metrics%3Aweekly&state=open&per_page=20`

  try {
    const res = await fetch(url, { headers: ghHeaders(token) })
    if (!res.ok) {
      recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
      logger.warn('[digest/gh] list issues non-OK', { status: res.status })
      return null
    }

    recordSuccess('github');
    const raw = await res.json()
    const parsed = GhIssueListSchema.safeParse(raw)
    if (!parsed.success) {
      logger.warn('[digest/gh] issue list parse error', { error: parsed.error.message })
      return null
    }

    const match = parsed.data.find((i) => i.title === title)
    return match ? { number: match.number, html_url: match.html_url } : null
  } catch (err) {
    recordFailure('github', classifyError(err))
    logger.warn('[digest/gh] findExistingIssue failed', { error: getErrorMessage(err) })
    return null
  }
}

/**
 * Idempotent upsert: search by title → PATCH body if exists, POST new if not.
 * Returns issue URL + action taken.
 *
 * Missing token → logs warn + returns null (caller skips gracefully).
 */
export async function upsertGithubIssue(
  params: UpsertIssueParams,
): Promise<UpsertIssueResult | null> {
  const token = process.env.GITHUB_TOKEN_DIGEST
  const repo = process.env.GITHUB_REPO ?? 'longtho638-jpg/sophia-ai-factory'

  if (!token) {
    logger.warn('[digest/gh] GITHUB_TOKEN_DIGEST not set — skipping GH Issue')
    return null
  }

  const { title, body, labels = ['metrics:weekly'] } = params

  if (!shouldAllowRequest('github')) {
    logger.warn('[digest/gh] Circuit breaker open for github, skipping')
    return null
  }

  try {
    const existing = await findExistingIssue(repo, title, token)

    if (existing) {
      // PATCH existing issue body
      const res = await fetch(
        `https://api.github.com/repos/${repo}/issues/${existing.number}`,
        {
          method: 'PATCH',
          headers: ghHeaders(token),
          body: JSON.stringify({ body }),
        },
      )
      if (!res.ok) {
        recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
        logger.warn('[digest/gh] PATCH issue non-OK', { status: res.status })
        return null
      }
      recordSuccess('github');
      const updated = GhIssueSchema.parse(await res.json())
      logger.info('[digest/gh] issue updated', { number: updated.number })
      return { url: updated.html_url, action: 'updated', issueNumber: updated.number }
    }

    // POST new issue
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: ghHeaders(token),
      body: JSON.stringify({ title, body, labels }),
    })
    if (!res.ok) {
      recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
      logger.warn('[digest/gh] POST issue non-OK', { status: res.status })
      return null
    }
    recordSuccess('github');
    const created = GhIssueSchema.parse(await res.json())
    logger.info('[digest/gh] issue created', { number: created.number })
    return { url: created.html_url, action: 'created', issueNumber: created.number }
  } catch (err) {
    recordFailure('github', classifyError(err))
    logger.warn('[digest/gh] upsert failed', {
      error: getErrorMessage(err),
    })
    return null
  }
}
