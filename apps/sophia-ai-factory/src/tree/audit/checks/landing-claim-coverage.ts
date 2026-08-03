/**
 * Landing Claim Coverage Checks
 * Verifies each marketing claim on landing page has matching code evidence.
 *
 * @module lib/audit/checks/landing-claim-coverage
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface ClaimCheck {
 claim: string
 description: string
 check: (d1: D1Database) => Promise<boolean>
}

function fileExists(relativePath: string): boolean {
 // Lazy require to avoid NFT tracer resolving fs/path at module scope
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const { existsSync } = require('node:fs') as typeof import('node:fs')
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const { join } = require('node:path') as typeof import('node:path')

 const APP_ROOT = join(process.cwd(), 'src')
 return existsSync(join(APP_ROOT, relativePath))
}

const CLAIM_CHECKS: ClaimCheck[] = [
 {
   claim: 'REST API /api/v1/missions',
   description: 'Mission API route file exists',
   check: async () => fileExists('app/api/v1/missions/route.ts') || fileExists('app/api/v1/missions/[id]/route.ts'),
 },
 {
   claim: 'TypeScript SDK',
   description: 'SDK index file exists',
   check: async () => fileExists('sdk/index.ts') || fileExists('sdk/sophia-sdk.ts'),
 },
 {
   claim: 'SSE streaming',
   description: 'SSE/stream route exists',
   check: async () =>
     fileExists('app/api/v1/missions/[id]/stream/route.ts') || fileExists('app/api/analytics/realtime/route.ts'),
 },
 {
   claim: 'Telegram bot',
   description: 'Telegram webhook route exists',
   check: async () => fileExists('app/api/webhooks/telegram/route.ts') || fileExists('lib/telegram'),
 },
 {
   claim: 'MCU credits transparent',
   description: 'MCU credits repo exists',
   check: async () => fileExists('lib/mcu/credits-repo.ts') || fileExists('lib/usage-metering'),
 },
 {
   claim: '5 video templates in DB',
   description: 'At least 5 official SOP templates',
   check: async (d1) => {
     try {
       const row = await d1
         .prepare(`SELECT COUNT(*) as cnt FROM sop_templates WHERE is_official = 1`)
         .first<{ cnt: number }>()
       return (row?.cnt ?? 0) >= 5
     } catch {
       return false
     }
   },
 },
 {
   claim: 'Outbound webhooks',
   description: 'Webhook fire utility exists',
   check: async () => fileExists('lib/missions/fire-webhook.ts') || fileExists('lib/webhooks'),
 },
 {
   claim: 'NOWPayments integration',
   description: 'NOWPayments IPN webhook route exists',
   check: async () => fileExists('app/api/webhooks/nowpayments/route.ts') || fileExists('app/api/billing'),
 },
]

export async function runLandingClaimChecks(env: AuditEnv): Promise<CheckResult[]> {
 const start = Date.now()
 const checks = await Promise.all(
   CLAIM_CHECKS.map(async (c) => {
     const ok = await c.check(env.d1).catch(() => false)
     return { claim: c.claim, description: c.description, ok }
   }),
 )

 const passed = checks.filter((c) => c.ok)
 const failed = checks.filter((c) => !c.ok)

 const status = failed.length === 0 ? 'pass' : failed.length <= 2 ? 'warn' : 'fail'
 const evidence =
   failed.length === 0
     ? `All ${checks.length} landing claims have code evidence`
     : `${passed.length}/${checks.length} verified. Missing: ${failed.map((c) => c.claim).join(', ')}`

 return [
   {
     id: 'landing-claim-coverage',
     category: 'Landing Claims',
     name: 'Feature Claims Backed by Code',
     status,
     weight: 7,
     score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
     evidence,
     fix:
       failed.length > 0
         ? `Create missing files/routes for: ${failed.map((c) => c.claim).join(', ')}`
         : undefined,
     durationMs: Date.now() - start,
   },
 ]
}
