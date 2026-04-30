/**
 * Payout Batcher — Inngest weekly Sunday cron
 *
 * Aggregates payable commissions per affiliate (≥$10 threshold),
 * creates payout_batch rows, and calls NOWPayments mass payout.
 * Runs: 0 12 * * 0 (Sunday 12:00 UTC)
 *
 * @module payouts/payout-batcher
 */

import { inngest } from '@/lib/inngest/client'
import { getD1Raw } from '@/lib/db/client'
import { getPayableAggregates, getPayableLedgerIds, markLedgerPaid } from './commission-ledger'
import { queueBatch } from './nowpayments-mass-payout'

const MIN_PAYOUT_USD = 10

interface PayoutMethodRow {
  id: string
  method: string
  recipient_addr_encrypted: string
  network: string
}

export const payoutBatcher = inngest.createFunction(
  {
    id: 'payout-batcher-weekly',
    name: 'Payout Batcher — Weekly Sunday',
  },
  { cron: '0 12 * * 0' },
  async ({ step }) => {
    const db = await getD1Raw()

    const tenants = await step.run('fetch-tenants', async () => {
      const result = await db
        .prepare(
          `SELECT DISTINCT tenant_id FROM commission_ledger WHERE status = 'payable'`,
        )
        .all<{ tenant_id: string }>()
      return (result.results ?? []).map((r: { tenant_id: string }) => r.tenant_id)
    })

    const results: { batchId: string; affiliateId: string; totalUsd: number }[] = []

    for (const tenantId of tenants) {
      const aggregates = await step.run(`aggregate-payable-${tenantId}`, async () => {
        return getPayableAggregates(tenantId)
      })

      for (const agg of aggregates) {
        if (agg.total_usd < MIN_PAYOUT_USD) continue

        const method = await step.run(`fetch-payout-method-${agg.affiliate_id}`, async () => {
          const innerDb = await getD1Raw()
          return innerDb
            .prepare(
              `SELECT id, method, recipient_addr_encrypted, network
               FROM payout_methods
               WHERE affiliate_id = ? AND tenant_id = ? AND is_default = 1
               ORDER BY created_at DESC LIMIT 1`,
            )
            .bind(agg.affiliate_id, tenantId)
            .first<PayoutMethodRow>()
        })

        if (!method) continue

        const ledgerIds = await step.run(`fetch-ledger-ids-${agg.affiliate_id}`, async () => {
          return getPayableLedgerIds(tenantId, agg.affiliate_id)
        })

        if (ledgerIds.length === 0) continue

        const batchId = `batch_${tenantId}_${agg.affiliate_id}_${Date.now()}`
        const now = Math.floor(Date.now() / 1000)

        await step.run(`insert-batch-${batchId}`, async () => {
          const innerDb = await getD1Raw()
          await innerDb
            .prepare(
              `INSERT OR IGNORE INTO payout_batches
               (id, tenant_id, affiliate_id, total_usd, ledger_count,
                status, payment_method, network, recipient_addr_encrypted, created_at)
               VALUES (?,?,?,?,?,'queued',?,?,?,?)`,
            )
            .bind(
              batchId,
              tenantId,
              agg.affiliate_id,
              agg.total_usd,
              agg.row_count,
              method.method,
              method.network ?? 'TRC20',
              method.recipient_addr_encrypted,
              now,
            )
            .run()
        })

        const payoutResult = await step.run(`send-payout-${batchId}`, async () => {
          return queueBatch({
            batchId,
            affiliateId: agg.affiliate_id,
            totalUsd: agg.total_usd,
            recipientAddrEncrypted: method.recipient_addr_encrypted,
            network: method.network ?? 'TRC20',
          })
        })

        await step.run(`mark-paid-${batchId}`, async () => {
          await markLedgerPaid(ledgerIds, batchId)
        })

        await step.sendEvent(`emit-payout-batched-${batchId}`, {
          name: 'payout.batched',
          data: {
            batchId,
            affiliateId: agg.affiliate_id,
            totalUsd: agg.total_usd,
            externalPaymentId: payoutResult.externalPaymentId,
          },
        })

        results.push({ batchId, affiliateId: agg.affiliate_id, totalUsd: agg.total_usd })
      }
    }

    return { processed: results.length, batches: results }
  },
)
