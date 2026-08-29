/**
 * Server Action: list digital products for a workspace (read-only).
 *
 * Auth via getCurrentUser() + org membership (IDOR prevention).
 * Empty catalog is a success with an empty array, not an error.
 *
 * @module land/commerce/actions/list-products
 */

'use server';

import { z } from 'zod/v4';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getUserTier } from '@/seed/db/get-user-tier';
import { canUsePhase4Feature, type FeatureGateResult } from '@/seed/config/tiers/phase4-feature-gate';
import { listProducts, type CommerceProduct } from '../product-catalog';
import {
  requireWorkspaceAccess,
  type CommerceActionError,
} from './commerce-action-auth';

const schema = z.object({
  workspaceId: z.string().min(1),
});

export type ListProductsResult =
  | { ok: true; value: CommerceProduct[] }
  | { ok: false; error: CommerceActionError };

export async function listCommerceProducts(
  input: z.infer<typeof schema>,
): Promise<ListProductsResult> {
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

    const result = await listProducts(parsed.data.workspaceId);
    if (!result.ok) {
      return failure({ code: 'INTERNAL', message: result.error.message });
    }
    return success(result.value);
  } catch (err) {
    logger.error('[commerce] listCommerceProducts failed', toError(err));
    return failure({ code: 'INTERNAL', message: toError(err).message });
  }
}
