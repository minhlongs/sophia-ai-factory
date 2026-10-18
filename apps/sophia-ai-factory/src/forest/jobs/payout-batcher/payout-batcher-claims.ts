import { logger } from '@/seed/utils/logger-utility';
import {
  MIN_PAYOUT_THRESHOLD_CENTS,
  type PayableCommissionRow,
} from './types';

export interface ClaimedCommissionsSummary {
  claimedRowIds: string[];
  totalAmountCents: number;
  recipientCount: number;
}

export async function queryPayableCommissions(
  db: D1Database,
): Promise<{ rows: PayableCommissionRow[]; error?: string }> {
  try {
    const result = await db
      .prepare(
        `SELECT id, affiliate_id, commission_cents
         FROM commission_ledger
         WHERE status = 'payable' AND payout_batch_id IS NULL`,
      )
      .all<PayableCommissionRow>();
    return { rows: result.results ?? [] };
  } catch (err) {
    logger.error(
      '[PayoutBatcher] Failed to query payable rows',
      err instanceof Error ? err : new Error(String(err)),
    );
    return {
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function claimPayableRows(
  db: D1Database,
  batchId: string,
  payableRows: PayableCommissionRow[],
): Promise<ClaimedCommissionsSummary> {
  const claimedRowIds: string[] = [];
  let totalAmountCents = 0;
  const uniqueRecipients = new Set<string>();

  for (const row of payableRows) {
    if (row.commission_cents >= MIN_PAYOUT_THRESHOLD_CENTS) {
      try {
        const claimResult = await db
          .prepare(
            `UPDATE commission_ledger
             SET status = 'paying', payout_batch_id = ?
             WHERE id = ? AND status = 'payable' AND payout_batch_id IS NULL`,
          )
          .bind(batchId, row.id)
          .run();

        if ((claimResult.meta?.changes ?? 0) > 0) {
          claimedRowIds.push(row.id);
          totalAmountCents += row.commission_cents;
          uniqueRecipients.add(row.affiliate_id);
        }
      } catch (claimErr) {
        logger.warn('[PayoutBatcher] CAS claim error on row', {
          rowId: row.id,
          error: String(claimErr),
        });
      }
    }
  }

  return {
    claimedRowIds,
    totalAmountCents,
    recipientCount: uniqueRecipients.size,
  };
}
