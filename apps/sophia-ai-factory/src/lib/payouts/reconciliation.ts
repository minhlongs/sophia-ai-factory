/**
 * Reconciliation — Inngest daily cron
 *
 * Compares sum of paid commission_ledger rows vs confirmed payout_batches.
 * Alerts if discrepancy > $1 (configurable via RECONCILE_ALERT_THRESHOLD_USD env).
 * Runs: 0 4 * * * (04:00 UTC daily)
 *
 * @module payouts/reconciliation
 */

import { inngest } from '@/lib/inngest/client'
import { getD1Raw } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'

const ALERT_THRESHOLD_USD = parseFloat(process.env.RECONCILE_ALERT_THRESHOLD_USD ?? '1')

interface ReconcileResult {
  tenantId: string
  ledgerPaidTotal: number
  batchConfirmedTotal: number
  diff: number
  alert: boolean
}

async function reconcileTenant(tenantId: string): Promise<ReconcileResult> {
  const db = await getD1Raw()

  const ledgerRow = await db
    .prepare(
      `SELECT COALESCE(SUM(commission_usd), 0) AS total
       FROM commission_ledger
       WHERE tenant_id = ? AND status = 'paid'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()

  const batchRow = await db
    .prepare(
      `SELECT COALESCE(SUM(total_usd), 0) AS total
       FROM payout_batches
       WHERE tenant_id = ? AND status = 'confirmed'`,
    )
    .bind(tenantId)
    .first<{ total: number }>()

  const ledgerTotal = ledgerRow?.total ?? 0
  const batchTotal = batchRow?.total ?? 0
  const diff = Math.abs(ledgerTotal - batchTotal)
  const alert = diff > ALERT_THRESHOLD_USD

  return {
    tenantId,
    ledgerPaidTotal: ledgerTotal,
    batchConfirmedTotal: batchTotal,
    diff,
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
        logger.error('[Reconciliation] Discrepancy detected', new Error('Reconciliation mismatch'), {
          tenantId: result.tenantId,
          ledgerTotal: result.ledgerPaidTotal,
          batchTotal: result.batchConfirmedTotal,
          diff: result.diff,
          threshold: ALERT_THRESHOLD_USD,
        })

        await step.sendEvent(`alert-reconcile-${tenantId}`, {
          name: 'payout.reconcile.alert',
          data: {
            tenantId: result.tenantId,
            ledgerTotal: result.ledgerPaidTotal,
            batchTotal: result.batchConfirmedTotal,
            diff: result.diff,
          },
        })
      }
    }

    return { checked: tenants.length, alerts: results.filter((r) => r.alert).length, results }
  },
)
