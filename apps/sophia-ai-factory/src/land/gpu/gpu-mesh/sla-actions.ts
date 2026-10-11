'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { createLogger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type SlaPenaltyEscrow,
  type SlaPenaltyEscrowDbRow,
  type PenaltyClaimResult,
  mapRowToSlaPenaltyEscrow,
} from '@/seed/types/edge-gpu-mesh';
import type { ActionError } from './types';
import { assertAuthenticatedUser } from './auth';
import { claimSlaPenalty } from '@/tree/gpu/six-nines-sla-engine';

const log = createLogger('land/gpu');

/**
 * Server Action: Retrieves Six-Nines SLA status and penalty escrow ledger for a tenant.
 */
export async function getSixNinesSlaStatusAction(
  tenantId: string,
  periodMonth: string,
): Promise<Result<SlaPenaltyEscrow, ActionError>> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const row = await db
      .prepare(
        'SELECT * FROM sla_penalty_escrow WHERE tenant_id = ? AND period_month = ?',
      )
      .bind(tenantId, periodMonth)
      .first<SlaPenaltyEscrowDbRow>();

    if (!row) {
      return failure({
        code: 'NOT_FOUND',
        message: `No SLA escrow record found for tenant ${tenantId} and period ${periodMonth}`,
      });
    }

    return success(mapRowToSlaPenaltyEscrow(row));
  } catch (error) {
    const err = toError(error);
    log.error('Failed to query SLA escrow status', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to query SLA escrow status',
    });
  }
}

/**
 * Server Action: Submits a claim against an SLA penalty escrow fund.
 */
export async function claimSlaPenaltyAction(
  escrowId: string,
): Promise<Result<PenaltyClaimResult, ActionError>> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const claimResult = await claimSlaPenalty(db, escrowId);
    log.info('SLA penalty claimed successfully', {
      escrowId,
      claimedCents: claimResult.claimedCents,
    });

    return success(claimResult);
  } catch (error) {
    const err = toError(error);
    log.error('Failed to claim SLA penalty', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to claim SLA penalty',
    });
  }
}
