/**
 * Reconciliation — Inngest daily cron
 *
 * Compares sum of paid commission_ledger cents vs confirmed payout_batches cents.
 * Alerts if discrepancy > threshold (default 100 cents / $1.00).
 * Runs: 0 4 * * * (04:00 UTC daily)
 *
 * Moved from land/payouts/reconciliation to forest/jobs (orchestration layer).
 * Forest→Land imports are allowed per cross-layer-orchestration.md.
 *
 * @module forest/jobs/reconciliation
 */

import { inngest } from '@/forest/inngest/client'
import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { fromCents } from '@/land/payouts/commission-cents'

// Threshold in cents (default 100 = $1.00)
const ALERT_THRESHOLD_CENTS = Math.round(
  parseFloat(process.env.RECONCILE_ALERT_THRESHOLD_USD ?? '1') * 100,
)

interface ReconcileResult {
  tenantId: string
  ledgerPaidCents: number
  batchConfirmedCents: number
  diffCents: number
  alert: boolean
}

async function reconcileTenant(tenantId: string): Promise<ReconcileResult> {
  const db = await getD1Raw()

  const ledgerRow = await db
    .prepare(
      `SELECT COALESCE(SUM(commission_cents - withheld_cents), 0) AS total
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()

  const batchRow = await db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total
       FROM payout_batches
       WHERE tenant_id = ? AND status = 'confirmed'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()

  const ledgerCents = ledgerRow?.total ?? 0
  const batchCents = batchRow?.total ?? 0
  const diffCents = Math.abs(ledgerCents - batchCents)
  const alert = diffCents > ALERT_THRESHOLD_CENTS

  return {
    tenantId,
    ledgerPaidCents: ledgerCents,
    batchConfirmedCents: batchCents,
    diffCents,
    alert,
  }
}

export const reconciliationCron = inngest.createFunction(
  {
    id: 'reconciliation-daily',
    name: 'Payout Reconciliation — Daily',
  },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const db = await getD1Raw()

    const tenants = await step.run('fetch-tenants', async () => {
      const result = await db
        .prepare(
          `SELECT DISTINCT tenant_id FROM commission_ledger WHERE status = 'paid'`,
        )
        .all<{ tenant_id: string }>()
      return (result.results ?? []).map((r: { tenant_id: string }) => r.tenant_id)
    })

    const results: ReconcileResult[] = []

    for (const tenantId of tenants) {
      const result = await step.run(`reconcile-${tenantId}`, async () => {
        return reconcileTenant(tenantId)
      })

      results.push(result)

      if (result.alert) {
        logger.error(
          '[Reconciliation] Discrepancy detected',
          new Error('Reconciliation mismatch'),
          {
            tenantId: result.tenantId,
            ledgerTotalUsd: fromCents(result.ledgerPaidCents),
            batchTotalUsd: fromCents(result.batchConfirmedCents),
            diffUsd: fromCents(result.diffCents),
            thresholdUsd: fromCents(ALERT_THRESHOLD_CENTS),
          },
        )

        await step.sendEvent(`alert-reconcile-${tenantId}`, {
          name: 'payout.reconcile.alert',
          data: {
            tenantId: result.tenantId,
            ledgerTotalCents: result.ledgerPaidCents,
            batchTotalCents: result.batchConfirmedCents,
            diffCents: result.diffCents,
          },
        })
      }
    }

    return {
      checked: tenants.length,
      alerts: results.filter((r) => r.alert).length,
      results,
    }
  },
)
