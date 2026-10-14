/**
 * GitHub Issue Digest Formatter & Request Helpers
 *
 * Extracted from github-issue-poster.ts: ISO week helpers, canonical title builder,
 * request headers, and Zod response schemas.
 */

import { z } from 'zod'

// ── Zod schemas for GH API responses ─────────────────────────────────────────

export const GhIssueSchema = z.object({
  number: z.number(),
  html_url: z.string().url(),
  title: z.string(),
})

export const GhIssueListSchema = z.array(GhIssueSchema)

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

// ── GH API headers ────────────────────────────────────────────────────────────

export function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}
