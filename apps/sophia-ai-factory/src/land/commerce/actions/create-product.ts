/**
 * Server Action: create a digital product in the commerce catalog.
 *
 * Auth via getCurrentUser() + org_members membership (IDOR prevention),
 * shared in ./commerce-action-auth. Tier gating (commerce = PREMIUM+) is
 * wired at this call-site by the billing consolidation phase.
 *
 * @module land/commerce/actions/create-product
 */

'use server';

import { z } from 'zod/v4';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getUserTier } from '@/seed/db/get-user-tier';
import { canUsePhase4Feature, type FeatureGateResult } from '@/seed/config/tiers/phase4-feature-gate';
import { createProduct, type CommerceProduct } from '../product-catalog';
import { requireWorkspaceAccess, type CommerceActionError } from './commerce-action-auth';

const schema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  deliveryAssetId: z.string().min(1).optional(),
});

export async function createProductAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; value: CommerceProduct } | { ok: false; error: CommerceActionError }> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const access = await requireWorkspaceAccess(parsed.data.workspaceId);
    if (!access.ok) return access;

    // Phase 4 feature gate: commerce catalog requires PREMIUM+
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }
    const tier = await getUserTier(user.id);
    const gate: FeatureGateResult = canUsePhase4Feature(tier, 'enable_commerce_catalog');
    if (!gate.allowed) {
      return failure({ code: 'FORBIDDEN', message: gate.message || 'Commerce catalog requires PREMIUM tier or higher' });
    }

    const result = await createProduct({
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      priceCents: parsed.data.priceCents,
      currency: parsed.data.currency,
      assetRef: parsed.data.deliveryAssetId,
    });
    if (!result.ok) {
      return failure({ code: 'INTERNAL', message: result.error.message });
    }

    return success(result.value);
  } catch (err) {
    const error = toError(err);
    logger.error('[commerce] createProductAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
