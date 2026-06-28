/**
 * Tests for audit Markdown report generator (Zero-GAP run → downloadable .md).
 *
 * Pure formatter — pins header metadata, traffic-light verdict, per-category
 * tables, top-5 fixes by weight, evidence pipe-escaping + 120-char cap,
 * empty-fix branch omission.
 */

import { describe, it, expect } from 'vitest'
import { generateMarkdownReport } from './report-generator'
import type { AuditRunSummary, CheckResult, CheckStatus } from './zero-gap-types'

function check(
  over: Partial<CheckResult> & { status?: CheckStatus; weight?: number; id?: string },
): CheckResult {
  const status = over.status ?? 'pass'
  return {
    id: over.id ?? 'c-1',
    category: over.category ?? 'security',
    name: over.name ?? 'Test Check',
    status,
    weight: over.weight ?? 5,
    score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
    evidence: over.evidence ?? '',
    fix: over.fix,
    durationMs: over.durationMs ?? 100,
  }
}

function makeRun(over: Partial<AuditRunSummary> = {}): AuditRunSummary {
  return {
    id: 'audit-abc',
    triggeredByUserId: 'admin-1',
    startedAt: 1_700_000_000,
    completedAt: 1_700_000_020,
    totalScore: 85,
    totalChecks: 1,
    passed: 1,
    warned: 0,
    failed: 0,
    results: [check({ status: 'pass' })],
    ...over,
  }
}

describe('generateMarkdownReport — header', () => {
  it('includes audit ID, ISO date from startedAt*1000, duration, triggeredByUserId', () => {
    const md = generateMarkdownReport(makeRun())
    expect(md).toContain('**Audit ID**: `audit-abc`')
    expect(md).toContain('**Date**: 2023-11-14T22:13:20.000Z')
    expect(md).toContain('**Duration**: 20s')
    expect(md).toContain('**Triggered by**: `admin-1`')
  })

  it('shows ? for duration when completedAt is missing', () => {
    const md = generateMarkdownReport(makeRun({ completedAt: undefined }))
    expect(md).toContain('**Duration**: ?s')
  })

  it('starts with H1 heading', () => {
    expect(generateMarkdownReport(makeRun()).startsWith('# Zero-GAP Platform Audit')).toBe(true)
  })
})

describe('generateMarkdownReport — verdict from trafficLight', () => {
  it('shows GREEN for score ≥ 90', () => {
    expect(generateMarkdownReport(makeRun({ totalScore: 95 }))).toContain('🟢 GREEN')
  })

  it('shows YELLOW for 70 ≤ score < 90', () => {
    expect(generateMarkdownReport(makeRun({ totalScore: 75 }))).toContain('🟡 YELLOW')
  })

  it('shows RED for score < 70', () => {
    expect(generateMarkdownReport(makeRun({ totalScore: 40 }))).toContain('🔴 RED')
  })

  it('includes score in section heading (## Score: N/100)', () => {
    expect(generateMarkdownReport(makeRun({ totalScore: 85 }))).toContain('## Score: 85/100 — 🟡 YELLOW')
  })
})

describe('generateMarkdownReport — summary table', () => {
  it('lists passed/warned/failed/total counts', () => {
    const md = generateMarkdownReport(
      makeRun({ passed: 5, warned: 2, failed: 1, totalChecks: 8 }),
    )
    expect(md).toContain('| ✅ Passed | 5 |')
    expect(md).toContain('| ⚠️ Warnings | 2 |')
    expect(md).toContain('| ❌ Failed | 1 |')
    expect(md).toContain('| Total Checks | 8 |')
  })
})

describe('generateMarkdownReport — top priority fixes', () => {
  it('selects top 5 non-pass results sorted by weight desc', () => {
    const results = [
      check({ id: '1', status: 'fail', weight: 10, fix: 'fix-W10' }),
      check({ id: '2', status: 'warn', weight: 7, fix: 'fix-W7' }),
      check({ id: '3', status: 'fail', weight: 5, fix: 'fix-W5' }),
      check({ id: '4', status: 'fail', weight: 3, fix: 'fix-W3' }),
      check({ id: '5', status: 'warn', weight: 2, fix: 'fix-W2' }),
      check({ id: '6', status: 'fail', weight: 1, fix: 'fix-W1' }),
      check({ id: '7', status: 'pass', weight: 9, fix: 'should-not-appear' }),
    ]
    const md = generateMarkdownReport(makeRun({ results, totalChecks: results.length }))

    // Scope to Top Priority Fixes block only (per-category breakdown also lists fixes as blockquotes)
    const topBlock = md.split('## Top Priority Fixes')[1].split('---')[0]

    expect(topBlock).toContain('- fix-W10')
    expect(topBlock).toContain('- fix-W7')
    expect(topBlock).toContain('- fix-W5')
    expect(topBlock).toContain('- fix-W3')
    expect(topBlock).toContain('- fix-W2')
    // 6th excluded from top-5 (regex prevents substring match against fix-W10), passing fix excluded entirely
    expect(topBlock).not.toMatch(/- fix-W1$/m)
    // Passing fix never appears outside raw JSON dump
    const beforeRaw = md.split('## Raw Results')[0]
    expect(beforeRaw).not.toContain('should-not-appear')
  })

  it('omits the Top Priority Fixes section when no non-pass results have fix', () => {
    const md = generateMarkdownReport(makeRun())
    expect(md).not.toContain('## Top Priority Fixes')
  })

  it('omits results without fix field from top-5 list', () => {
    const results = [
      check({ id: '1', status: 'fail', weight: 10 }), // no fix
      check({ id: '2', status: 'fail', weight: 5, fix: 'has-fix' }),
    ]
    const md = generateMarkdownReport(makeRun({ results }))
    expect(md).toContain('- has-fix')
    expect(md.match(/## Top Priority Fixes[\s\S]*?---/)?.[0]).not.toMatch(/^- (?!has-fix)/m)
  })
})

describe('generateMarkdownReport — per-category breakdown', () => {
  it('groups checks by category with table per group', () => {
    const results = [
      check({ id: 'a', category: 'security', name: 'XSS check' }),
      check({ id: 'b', category: 'security', name: 'CSRF check' }),
      check({ id: 'c', category: 'performance', name: 'LCP check' }),
    ]
    const md = generateMarkdownReport(makeRun({ results }))
    expect(md).toContain('### security')
    expect(md).toContain('### performance')
    expect(md).toContain('| XSS check |')
    expect(md).toContain('| LCP check |')
  })

  it('falls back to id when category is missing', () => {
    const result = check({ id: 'orphan-check' })
    const noCategoryResult = { ...result, category: undefined } as unknown as CheckResult
    const md = generateMarkdownReport(makeRun({ results: [noCategoryResult] }))
    expect(md).toContain('### orphan-check')
  })

  it('formats score as round(score × weight)/weight', () => {
    const md = generateMarkdownReport(
      makeRun({
        results: [check({ status: 'warn', weight: 10 })], // 0.5 * 10 = 5
      }),
    )
    expect(md).toContain('| 5/10 |')
  })

  it('escapes pipe chars in evidence', () => {
    const md = generateMarkdownReport(
      makeRun({
        results: [check({ evidence: 'has | pipe | inside' })],
      }),
    )
    expect(md).toContain('has \\| pipe \\| inside')
  })

  it('truncates evidence to 120 chars in category table (raw JSON keeps full value)', () => {
    const longEvidence = 'a'.repeat(200)
    const md = generateMarkdownReport(
      makeRun({
        results: [check({ evidence: longEvidence })],
      }),
    )
    // Scope to the category breakdown section (Raw Results JSON also contains the full 200 a's)
    const breakdownBlock = md
      .split('## Per-Category Breakdown')[1]
      .split('## Raw Results')[0]
    expect(breakdownBlock).toContain('a'.repeat(120))
    expect(breakdownBlock).not.toContain('a'.repeat(121))
  })

  it('emits per-check Fix blockquote for each failing check with fix', () => {
    const md = generateMarkdownReport(
      makeRun({
        results: [check({ status: 'fail', fix: 'Apply migration 0107' })],
      }),
    )
    expect(md).toContain('> **Fix**: Apply migration 0107')
  })

  it('omits Fix blockquotes when all checks in a category pass', () => {
    const md = generateMarkdownReport(
      makeRun({
        results: [check({ status: 'pass', fix: 'should-not-appear' })],
      }),
    )
    expect(md).not.toContain('> **Fix**:')
  })
})

describe('generateMarkdownReport — raw results + footer', () => {
  it('appends raw JSON inside fenced ```json block', () => {
    const result = check({ id: 'r-1' })
    const md = generateMarkdownReport(makeRun({ results: [result] }))
    expect(md).toContain('## Raw Results')
    expect(md).toContain('```json')
    expect(md).toContain('"id": "r-1"')
    expect(md).toContain('```')
  })

  it('ends with attribution footer', () => {
    expect(generateMarkdownReport(makeRun())).toContain(
      '*Generated by Sophia Zero-GAP Audit System*',
    )
  })
})
