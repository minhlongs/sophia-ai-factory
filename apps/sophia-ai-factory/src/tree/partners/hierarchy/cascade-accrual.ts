/**
 * Cascade Override Accrual with Escrow Safety Guardrails
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/cascade-accrual
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerSubReseller,
  AccrueCascadeOverrideResult,
} from '@/tree/partners/types';
import { MASTER_CASCADE_OVERRIDE_RATE_PCT } from './cascade-calculator';

/**
 * Accrues the 5% cascade override for a sub-agency's customer transaction.
 * Enforces Escrow Guardrail: If Master Agency is suspended, override is escrowed
 * and NOT credited to the master's pending payout balance.
 *
 * @param db - D1Database instance.
 * @param subPartnerId - Sub-Agency ID that generated the revenue.
 * @param _orderId - Order / Transaction ID.
 * @param mrrCents - Transaction amount in integer cents.
 */
export async function accrueCascadeOverride(
  db: D1Database,
  subPartnerId: string,
  _orderId: string,
  mrrCents: number,
): Promise<AccrueCascadeOverrideResult> {
  if (mrrCents <= 0) {
    return {
      success: true,
      overrideCents: 0,
      masterPartnerId: null,
      escrowed: false,
    };
  }

  // 1. Look up active hierarchy binding
  const binding = await db
    .prepare('SELECT * FROM partner_sub_resellers WHERE sub_partner_id = ? AND status = ?')
    .bind(subPartnerId, 'active')
    .first<PartnerSubReseller>();

  if (!binding) {
    // No upstream master bound; platform keeps 100% of the platform share
    return {
      success: true,
      overrideCents: 0,
      masterPartnerId: null,
      escrowed: false,
    };
  }

  // 2. Fetch master partner profile
  const master = await db
    .prepare('SELECT id, status, total_earnings_cents, pending_payout_cents FROM partner_profiles WHERE id = ?')
    .bind(binding.master_partner_id)
    .first<PartnerProfile>();

  if (!master) {
    return {
      success: false,
      overrideCents: 0,
      masterPartnerId: binding.master_partner_id,
      escrowed: false,
      error: 'MASTER_PARTNER_NOT_FOUND',
    };
  }

  const overrideCents = Math.floor((mrrCents * (binding.override_rate_pct ?? MASTER_CASCADE_OVERRIDE_RATE_PCT)) / 100);
  const now = Date.now();

  // 3. Escrow Guardrail: If master agency is suspended, hold funds in escrow
  if (master.status !== 'active') {
    // Track lifetime override earned for audit, but do NOT add to pending payout
    await db
      .prepare(`
        UPDATE partner_sub_resellers
        SET lifetime_override_cents = lifetime_override_cents + ?1,
            updated_at = ?2
        WHERE id = ?3
      `)
      .bind(overrideCents, now, binding.id)
      .run();

    return {
      success: true,
      overrideCents,
      masterPartnerId: master.id,
      escrowed: true,
      reason: master.status === 'suspended' ? 'MASTER_AGENCY_SUSPENDED' : 'MASTER_AGENCY_NOT_ACTIVE',
    };
  }

  // 4. Master Agency is Active: Credit override to binding and partner pending balances
  await db
    .prepare(`
      UPDATE partner_sub_resellers
      SET lifetime_override_cents = lifetime_override_cents + ?1,
          pending_override_cents = pending_override_cents + ?1,
          updated_at = ?2
      WHERE id = ?3
    `)
    .bind(overrideCents, now, binding.id)
    .run();

  await db
    .prepare(`
      UPDATE partner_profiles
      SET total_earnings_cents = total_earnings_cents + ?1,
          pending_payout_cents = pending_payout_cents + ?1,
          updated_at = ?2
      WHERE id = ?3
    `)
    .bind(overrideCents, now, master.id)
    .run();

  return {
    success: true,
    overrideCents,
    masterPartnerId: master.id,
    escrowed: false,
  };
}
