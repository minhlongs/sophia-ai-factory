/**
 * Zero-GAP Audit Runner
 * Orchestrates all 10 audit check categories and yields results as they complete.
 *
 * Score = (sum of weighted pass + 0.5 * weighted warn) / total weight * 100
 *
 * @module lib/audit/zero-gap-runner
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'
import { runEndpointChecks } from '@/tree/audit/checks/endpoint-contract'
import { runJourneyChecks } from '@/tree/audit/checks/customer-journey'
import { runLandingClaimChecks } from '@/tree/audit/checks/landing-claim-coverage'
import { runTestCoverageChecks } from '@/tree/audit/checks/test-coverage'
import { runCronHealthChecks } from '@/tree/audit/checks/cron-health'
import { runProviderChecks } from '@/tree/audit/checks/provider-connectivity'
import { runSecurityChecks } from '@/tree/audit/checks/security-audit'
import { runI18nChecks } from '@/tree/audit/checks/i18n-coverage'
import { runPerfChecks } from '@/tree/audit/checks/performance'
import { runDataIntegrityChecks } from '@/tree/audit/checks/data-integrity'

export type { CheckResult, AuditEnv }

type CheckCategory = {
  id: string
  run: (env: AuditEnv) => Promise<CheckResult[]>
}

const CHECK_CATEGORIES: CheckCategory[] = [
  { id: 'endpoint-contract', run: runEndpointChecks },
  { id: 'customer-journey', run: runJourneyChecks },
  { id: 'landing-claim-coverage', run: runLandingClaimChecks },
  { id: 'test-coverage', run: runTestCoverageChecks },
  { id: 'cron-health', run: runCronHealthChecks },
  { id: 'provider-connectivity', run: runProviderChecks },
  { id: 'security-audit', run: runSecurityChecks },
  { id: 'i18n-coverage', run: runI18nChecks },
  { id: 'performance', run: runPerfChecks },
  { id: 'data-integrity', run: runDataIntegrityChecks },
]

/**
 * Run all audit checks in parallel, yielding results as each category completes.
 * Each check has a 30-second timeout to prevent hangs.
 */
export async function* runFullAudit(
  _userId: string,
  env: AuditEnv,
): AsyncIterable<CheckResult> {
  const TIMEOUT_MS = 29_000

  const categoryPromises = CHECK_CATEGORIES.map(async (cat) => {
    const timeoutPromise = new Promise<CheckResult[]>((resolve) =>
      setTimeout(() => {
        resolve([
          {
            id: cat.id,
            category: cat.id,
            name: `${cat.id} (timed out)`,
            status: 'fail',
            weight: 5,
            score: 0,
            evidence: 'Check timed out after 29s',
            fix: 'Investigate why this check is slow',
            durationMs: TIMEOUT_MS,
          },
        ])
      }, TIMEOUT_MS),
    )

    try {
      const results = await Promise.race([cat.run(env), timeoutPromise])
      return results
    } catch (err) {
      return [
        {
          id: cat.id,
          category: cat.id,
          name: `${cat.id} (error)`,
          status: 'fail' as const,
          weight: 5,
          score: 0,
          evidence: `Check threw error: ${err instanceof Error ? err.message : 'unknown'}`,
          fix: 'Fix the check implementation or underlying dependency',
          durationMs: 0,
        },
      ]
    }
  })

  // Yield results as each category completes (race pattern)
  const remaining = new Set(categoryPromises.map((_, i) => i))
  const settled = new Map<number, CheckResult[]>()

  await Promise.all(
    categoryPromises.map((p, i) =>
      p.then((results) => {
        settled.set(i, results)
        remaining.delete(i)
      }),
    ),
  )

  // Yield all collected results
  for (const results of settled.values()) {
    for (const r of results) {
      yield r
    }
  }
}

/**
 * Run full audit eagerly, collecting all results into an array.
 */
export async function runFullAuditEager(
  userId: string,
  env: AuditEnv,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for await (const r of runFullAudit(userId, env)) {
    results.push(r)
  }
  return results
}
