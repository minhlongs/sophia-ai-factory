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

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'
import {
  GhIssueSchema,
  GhIssueListSchema,
  type UpsertIssueParams,
  type UpsertIssueResult,
  getIsoWeek,
  buildIssueTitle,
  ghHeaders,
} from './github-issue-helpers'

export type { UpsertIssueParams, UpsertIssueResult }
export { getIsoWeek, buildIssueTitle }

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
    return null
  }
  const url = `https://api.github.com/repos/${repo}/issues?labels=metrics%3Aweekly&state=open&per_page=20`

  const res = await fetch(url, { headers: ghHeaders(token) })
  if (!res.ok) {
    logger.warn('[digest/gh] list issues non-OK', { status: res.status })
    recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
    return null
  }

  recordSuccess('github')
  const raw = await res.json()
  const parsed = GhIssueListSchema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('[digest/gh] issue list parse error', { error: parsed.error.message })
    return null
  }

  const match = parsed.data.find((i) => i.title === title)
  return match ? { number: match.number, html_url: match.html_url } : null
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
        logger.warn('[digest/gh] PATCH issue non-OK', { status: res.status })
        recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
        return null
      }
      const updated = GhIssueSchema.parse(await res.json())
      logger.info('[digest/gh] issue updated', { number: updated.number })
      recordSuccess('github')
      return { url: updated.html_url, action: 'updated', issueNumber: updated.number }
    }

    // POST new issue
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: ghHeaders(token),
      body: JSON.stringify({ title, body, labels }),
    })
    if (!res.ok) {
      logger.warn('[digest/gh] POST issue non-OK', { status: res.status })
      recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
      return null
    }
    const created = GhIssueSchema.parse(await res.json())
    logger.info('[digest/gh] issue created', { number: created.number })
    recordSuccess('github')
    return { url: created.html_url, action: 'created', issueNumber: created.number }
  } catch (err) {
    recordFailure('github', classifyError(err))
    logger.warn('[digest/gh] upsert failed', {
      error: getErrorMessage(err),
    })
    return null
  }
}
