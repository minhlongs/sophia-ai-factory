import { toError } from '@/seed/utils/to-error';
import type { QueryResult } from '@/seed/db/d1-query-types';
import type { D1Database } from '@cloudflare/workers-types';
import { withD1Retry } from '@/seed/db/d1-retry';

export async function debitMcuBalance(
  db: D1Database,
  orgId: string,
  amount: number,
  feature: string,
): Promise<QueryResult<unknown>> {
  const batchResults = await withD1Retry(() =>
    db.batch([
      db
        .prepare(
          `UPDATE org_balances SET balance = balance - ?, updated_at = datetime('now') WHERE org_id = ? AND balance >= ?`,
        )
        .bind(amount, orgId, amount),
      db
        .prepare('INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)')
        .bind(orgId, -amount, 'debit', feature),
    ]),
  );

  const updateResult = batchResults[0];
  if (!updateResult.meta?.rows_written || updateResult.meta.rows_written === 0) {
    return { data: null, error: { message: 'Insufficient balance' } };
  }

  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];
    if ((result as unknown as { error?: { message: string } }).error) {
      return {
        data: null,
        error: {
          message: `Batch statement ${i} failed: ${(result as unknown as { error: { message: string } }).error.message}`,
        },
      };
    }
  }

  const rowsAffected = batchResults.reduce(
    (sum, result) => sum + (result.meta?.rows_written ?? 0),
    0,
  );
  if (rowsAffected !== 2) {
    return {
      data: null,
      error: { message: `Expected 2 rows affected, got ${rowsAffected}` },
    };
  }

  return { data: { success: true }, error: null };
}

export async function creditMcuBalance(
  db: D1Database,
  orgId: string,
  amount: number,
  subscriptionId: string,
): Promise<QueryResult<unknown>> {
  try {
    const batchResults = await withD1Retry(() =>
      db.batch([
        db
          .prepare(
            "INSERT INTO org_balances (org_id, balance, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(org_id) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')",
          )
          .bind(orgId, amount, amount),
        db
          .prepare(
            'INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)',
          )
          .bind(orgId, amount, 'credit', subscriptionId),
      ]),
    );

    if (!batchResults || batchResults.length !== 2) {
      return {
        data: null,
        error: { message: `Unexpected batch result length: ${batchResults?.length ?? 'undefined'}` },
      };
    }

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      if ((result as unknown as { error?: { message: string } }).error) {
        return {
          data: null,
          error: { message: `Batch statement ${i} failed: ${(result as unknown as { error: { message: string } }).error.message}` },
        };
      }
    }

    const rowsAffected = batchResults.reduce(
      (sum, result) => sum + (result.meta?.rows_written ?? 0),
      0,
    );
    if (rowsAffected !== 2) {
      return {
        data: null,
        error: { message: `Expected 2 rows affected, got ${rowsAffected}` },
      };
    }

    return { data: { success: true }, error: null };
  } catch (err) {
    return { data: null, error: { message: toError(err).message } };
  }
}
