/**
 * Payout Batcher — Inngest weekly Sunday cron
 *
 * Aggregates payable commissions per affiliate (≥$10 / 1000 cents threshold),
 * claims rows atomically, creates payout_batch rows, dispatches via:
 *   - Stripe Transfer (fiat USD) if affiliate has Stripe Connect enabled
 *   - NOWPayments (USDT crypto) otherwise
 * Rollback to 'payable' on failure — no silent double-pay.
 * Runs: 0 12 * * 0 (Sunday 12:00 UTC)
 *
 * Moved from land/payouts/payout-batcher to forest/jobs (orchestration layer).
 * Forest→Land imports are allowed per cross-layer-orchestration.md.
 *
 * @module forest/jobs/payout-batcher
 */

import { inngest } from '@/seed/inngest/client'
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import {
  getPayableAggregates,
  getPayableLedgerIds,
  claimLedgerRows,
  markLedgerPaid,
  rollbackPayingRows,
} from '@/land/payouts/commission-ledger'
import { queueBatch } from '@/land/payouts/nowpayments-mass-payout'
import { transferToConnectedAccount } from '@/land/payouts/stripe-connect'
import { resolvePayoutMethod, type ResolvedPayoutMethod } from '@/land/payouts/resolve-payout-method'
import { deterministicBatchId } from '@/land/payouts/commission-cents'

const MIN_PAYOUT_CENTS = 1000 // $10.00
const STRIPE_RECIPIENT_PLACEHOLDER = 'stripe_connect' // recipient_addr_encrypted is NOT NULL; Stripe has no encrypted addr

export const payoutBatcher = inngest.createFunction(
  {
    id: 'payout-batcher-weekly',
    name: 'Payout Batcher — Weekly Sunday',
  },
  { cron: '0 12 * * 0' },
  async ({ step }) => {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;

    const tenants = await step.run('fetch-tenants', async () => {
      const result = await db
        .prepare(
          `SELECT DISTINCT tenant_id FROM commission_ledger WHERE status = 'payable'`,
        )
        .all<{ tenant_id: string }>()
      return (result.results ?? []).map((r: { tenant_id: string }) => r.tenant_id)
    })

    const results: { batchId: string; affiliateId: string; totalCents: number; rail: 'stripe' | 'usdt' }[] = []

    for (const tenantId of tenants) {
      const aggregates = await step.run(`aggregate-payable-${tenantId}`, async () => {
        return getPayableAggregates(tenantId)
      })

      for (const agg of aggregates) {
        if (agg.total_cents < MIN_PAYOUT_CENTS) continue

        const method = await step.run(`resolve-method-${agg.affiliate_id}`, async () => {
          return resolvePayoutMethod(tenantId, agg.affiliate_id)
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
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          const innerDb = _db;
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
              method.kind === 'stripe' ? 'stripe_connect' : method.method,
              method.kind === 'stripe' ? 'STRIPE' : method.network,
              method.kind === 'stripe' ? STRIPE_RECIPIENT_PLACEHOLDER : method.recipientAddrEncrypted,
              now,
            )
            .run()
        })

        const dispatch = await step.run(`send-payout-${batchId}`, async () => {
          try {
            return await dispatchPayout(batchId, agg, method)
          } catch (err) {
            // C3: rollback on failure — flip paying → payable so next run retries
            await rollbackPayingRows(batchId)
            logger.error('[PayoutBatcher] Payout failed, rolled back', err instanceof Error ? err : new Error(String(err)), {
              batchId,
              affiliateId: agg.affiliate_id,
              rail: method.kind,
            })
            throw err
          }
        })

        // C3: only mark paid after rail confirms
        await step.run(`mark-paid-${batchId}`, async () => {
          await markLedgerPaid(ledgerIds, batchId)
        })

        await step.sendEvent(`emit-payout-batched-${batchId}`, {
          name: 'payout.batched',
          data: {
            batchId,
            affiliateId: agg.affiliate_id,
            totalCents: agg.total_cents,
            externalPaymentId: dispatch.externalPaymentId,
            rail: method.kind,
          },
        })

        results.push({ batchId, affiliateId: agg.affiliate_id, totalCents: agg.total_cents, rail: method.kind })
      }
    }

    return { processed: results.length, batches: results }
  },
)

/**
 * Dispatch payout via the resolved rail.
 * Stripe Transfer uses batchId as idempotency key (NOWPayments uses extra_id internally).
 */
async function dispatchPayout(
  batchId: string,
  agg: { affiliate_id: string; total_cents: number },
  method: ResolvedPayoutMethod,
): Promise<{ externalPaymentId: string }> {
  if (method.kind === 'stripe') {
    const result = await transferToConnectedAccount({
      destinationAccountId: method.stripeAccountId,
      amountCents: agg.total_cents,
      idempotencyKey: batchId,
      description: `Sophia affiliate payout ${batchId}`,
      metadata: {
        batch_id: batchId,
        affiliate_id: agg.affiliate_id,
      },
    })
    return { externalPaymentId: result.transferId }
  }

  return queueBatch({
    batchId,
    affiliateId: agg.affiliate_id,
    totalCents: agg.total_cents,
    recipientAddrEncrypted: method.recipientAddrEncrypted,
    network: method.network,
  })
}
