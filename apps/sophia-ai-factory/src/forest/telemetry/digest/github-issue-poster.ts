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
  getIsoWeek,
  buildIssueTitle,
  ghHeaders,
  type UpsertIssueParams,
  type UpsertIssueResult,
} from './github-issue-formatter'

export {
  GhIssueSchema,
  GhIssueListSchema,
  getIsoWeek,
  buildIssueTitle,
  ghHeaders,
  type UpsertIssueParams,
  type UpsertIssueResult,
}

/** Find existing open issue by label + title prefix. Returns first match or null. */
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

    recordSuccess('github')
    const parsed = GhIssueListSchema.safeParse(await res.json())
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

/** Idempotent upsert: search by title -> PATCH body if exists, POST new if not. */
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
    const isUpdate = Boolean(existing)
    const url = existing
      ? `https://api.github.com/repos/${repo}/issues/${existing.number}`
      : `https://api.github.com/repos/${repo}/issues`
    const res = await fetch(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: ghHeaders(token),
      body: JSON.stringify(isUpdate ? { body } : { title, body, labels }),
    })
    if (!res.ok) {
      recordFailure('github', classifyError(new Error(`HTTP ${res.status}`)))
      logger.warn(`[digest/gh] ${isUpdate ? 'PATCH' : 'POST'} issue non-OK`, { status: res.status })
      return null
    }
    recordSuccess('github')
    const issue = GhIssueSchema.parse(await res.json())
    const action = isUpdate ? 'updated' : 'created'
    logger.info(`[digest/gh] issue ${action}`, { number: issue.number })
    return { url: issue.html_url, action, issueNumber: issue.number }
  } catch (err) {
    recordFailure('github', classifyError(err))
    logger.warn('[digest/gh] upsert failed', { error: getErrorMessage(err) })
    return null
  }
}
