/**
 * Template Activation Engine with OCC CAS Royalty Accrual
 *
 * Layer: tree/creator-royalties/template-activation
 */

import type {
  TemplateActivationInput,
  TemplateActivationResult,
} from '@/seed/types/creator-marketplace';
import { accrueCreatorLedgerEntryCAS } from '../attribution';
import {
  calculateTemplateRoyalty,
  isSelfTemplateActivation,
} from './royalty-calculator';
import {
  recordTemplateActivationSideEffects,
  resolveTemplateActivationMetadata,
  type ResolvedTemplateMetadata,
} from './activation-metadata-lookup';

export {
  recordTemplateActivationSideEffects,
  resolveTemplateActivationMetadata,
  type ResolvedTemplateMetadata,
};

/**
 * Executes template activation with 70/30 royalty attribution,
 * anti-fraud self-activation checks, and OCC CAS ledger accrual.
 */
export async function activateTemplateWithRoyaltyCAS(
  db: D1Database,
  input: TemplateActivationInput,
  nowMs = Date.now(),
): Promise<TemplateActivationResult> {
  // 1. Anti-circular self-activation guard
  if (isSelfTemplateActivation(input.creatorId, input.activatingUserId)) {
    return {
      success: false,
      activationId: '',
      creatorCents: 0,
      platformCents: 0,
      ledgerId: '',
      sequenceNum: 0,
      newBalanceCents: 0,
      error: 'SELF_TEMPLATE_ACTIVATION_PROHIBITED',
    };
  }

  // 2. Lookup template metadata if table exists
  const resolved = await resolveTemplateActivationMetadata(db, input);
  if (!resolved.ok) {
    return {
      success: false,
      activationId: '',
      creatorCents: 0,
      platformCents: 0,
      ledgerId: '',
      sequenceNum: 0,
      newBalanceCents: 0,
      error: resolved.error ?? 'TEMPLATE_NOT_APPROVED',
    };
  }

  const { creatorId, priceCents, royaltyPct } = resolved;

  // 3. Compute 70/30 integer royalty split
  const split = calculateTemplateRoyalty(priceCents, royaltyPct);
  const activationId = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  // 4. Accrue in creator_earnings_ledger via OCC CAS
  const ledgerResult = await accrueCreatorLedgerEntryCAS(
    db,
    {
      creatorId,
      amountCents: split.creatorCents,
      currency: 'USD',
      eventType: 'royalty_accrual',
      sourceType: 'template_activation',
      referenceId: activationId,
      status: 'pending',
      metadata: {
        templateId: input.templateId,
        activatingUserId: input.activatingUserId,
        tenantId: input.tenantId,
        videoJobId: input.videoJobId,
        priceCents,
        creatorCents: split.creatorCents,
        platformCents: split.platformCents,
        royaltyPct,
      },
    },
    8,
    nowMs,
  );

  if (!ledgerResult.success) {
    return {
      success: false,
      activationId,
      creatorCents: split.creatorCents,
      platformCents: split.platformCents,
      ledgerId: '',
      sequenceNum: 0,
      newBalanceCents: 0,
      error: ledgerResult.error ?? 'LEDGER_ACCRUAL_FAILED',
    };
  }

  // 5. Update template use_count and creator_profiles total_earnings_cents
  await recordTemplateActivationSideEffects({
    db,
    templateId: input.templateId,
    creatorId,
    creatorCents: split.creatorCents,
    nowMs,
  });

  return {
    success: true,
    activationId,
    creatorCents: split.creatorCents,
    platformCents: split.platformCents,
    ledgerId: ledgerResult.ledgerId,
    sequenceNum: ledgerResult.sequenceNum,
    newBalanceCents: ledgerResult.newBalanceCents,
  };
}
