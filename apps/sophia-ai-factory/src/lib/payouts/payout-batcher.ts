/**
 * Payout Batcher — Inngest weekly Sunday cron
 *
 * Aggregates payable commissions per affiliate (≥$10 / 1000 cents threshold),
 * claims rows atomically, creates payout_batch rows, calls NOWPayments.
 * Rollback to 'payable' on failure — no silent double-pay.
 * Runs: 0 12 * * 0 (Sunday 12:00 UTC)
 *
 * @module payouts/payout-batcher
 */

import { inngest } from '@/lib/inngest/client'
import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import {
  getPayableAggregates,
  getPayableLedgerIds,
  claimLedgerRows,
  markLedgerPaid,
  rollbackPayingRows,
} from './commission-ledger'
import { queueBatch } from './nowpayments-mass-payout'
import { deterministicBatchId } from './commission-cents'

const MIN_PAYOUT_CENTS = 1000 // $10.00

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

    const results: { batchId: string; affiliateId: string; totalCents: number }[] = []

    for (const tenantId of tenants) {
      const aggregates = await step.run(`aggregate-payable-${tenantId}`, async () => {
        return getPayableAggregates(tenantId)
      })

      for (const agg of aggregates) {
        if (agg.total_cents < MIN_PAYOUT_CENTS) continue

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

        // C3: deterministic batch_id — stable within ISO week, safe for Inngest retry
        const batchId = await step.run(`gen-batch-id-${agg.affiliate_id}`, async () => {
          return deterministicBatchId(tenantId, agg.affiliate_id, new Date())
        })

        const now = Math.floor(Date.now() / 1000)

        // C3: atomic claim — only rows not yet claimed are flipped to 'paying'
        const claimed = await step.run(`claim-rows-${batchId}`, async () => {
          return claimLedgerRows(ledgerIds, batchId)
        })

        if (claimed === 0) {
          // All rows already claimed by a concurrent/retried invocation — skip
          logger.warn('[PayoutBatcher] All rows already claimed, skipping duplicate', {
            batchId,
            affiliateId: agg.affiliate_id,
          })
          continue
        }

        await step.run(`insert-batch-${batchId}`, async () => {
          const innerDb = await getD1Raw()
          await innerDb
            .prepare(
              `INSERT OR IGNORE INTO payout_batches
               (id, tenant_id, affiliate_id, total_cents, ledger_count,
                status, payment_method, network, recipient_addr_encrypted, created_at)
               VALUES (?,?,?,?,?,'queued',?,?,?,?)`,
            )
            .bind(
              batchId,
              tenantId,
              agg.affiliate_id,
              agg.total_cents,
              agg.row_count,
              method.method,
              method.network ?? 'TRC20',
              method.recipient_addr_encrypted,
              now,
            )
            .run()
        })

        const payoutResult = await step.run(`send-payout-${batchId}`, async () => {
          try {
            return await queueBatch({
              batchId,
              affiliateId: agg.affiliate_id,
              totalCents: agg.total_cents,
              recipientAddrEncrypted: method.recipient_addr_encrypted,
              network: method.network ?? 'TRC20',
            })
          } catch (err) {
            // C3: rollback on failure — flip paying → payable so next run retries
            await rollbackPayingRows(batchId)
            logger.error('[PayoutBatcher] Payout failed, rolled back', err instanceof Error ? err : new Error(String(err)), {
              batchId,
              affiliateId: agg.affiliate_id,
            })
            throw err
          }
        })

        // C3: only mark paid after NOWPayments confirms
        await step.run(`mark-paid-${batchId}`, async () => {
          await markLedgerPaid(ledgerIds, batchId)
        })

        await step.sendEvent(`emit-payout-batched-${batchId}`, {
          name: 'payout.batched',
          data: {
            batchId,
            affiliateId: agg.affiliate_id,
            totalCents: agg.total_cents,
            externalPaymentId: payoutResult.externalPaymentId,
          },
        })

        results.push({ batchId, affiliateId: agg.affiliate_id, totalCents: agg.total_cents })
      }
    }

    return { processed: results.length, batches: results }
  },
)
