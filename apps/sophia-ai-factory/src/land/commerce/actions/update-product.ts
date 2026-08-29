/**
 * Server Action: update a digital product (fields or archive).
 *
 * Auth via getCurrentUser() + org membership; ownership verified by
 * scoping the product lookup to the caller's workspace. Archiving is a
 * soft-delete: the product stays queryable for existing orders.
 *
 * @module land/commerce/actions/update-product
 */

'use server';

import { z } from 'zod/v4';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getUserTier } from '@/seed/db/get-user-tier';
import { canUsePhase4Feature, type FeatureGateResult } from '@/seed/config/tiers/phase4-feature-gate';
import {
  getProduct,
  updateProduct,
  deactivateProduct,
  type CommerceProduct,
} from '../product-catalog';
import {
  requireWorkspaceAccess,
  type CommerceActionError,
} from './commerce-action-auth';

const schema = z.object({
  workspaceId: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().positive().optional(),
  deliveryAssetId: z.string().min(1).nullable().optional(),
  /** When true, archives (soft-deletes) the product instead of updating. */
  archive: z.boolean().optional(),
});

export type UpdateProductResult =
  | { ok: true; value: CommerceProduct }
  | { ok: false; error: CommerceActionError };

export async function updateCommerceProduct(
  input: z.infer<typeof schema>,
): Promise<UpdateProductResult> {
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

    // Ownership check: the product must belong to the caller's workspace.
    const existing = await getProduct(parsed.data.productId);
    if (!existing.ok || existing.value.workspaceId !== parsed.data.workspaceId) {
      return failure({ code: 'FORBIDDEN', message: 'Product not found in this workspace' });
    }

    if (parsed.data.archive) {
      const archived = await deactivateProduct(parsed.data.productId);
      if (!archived.ok) {
        return failure({ code: 'INTERNAL', message: archived.error.message });
      }
      const refreshed = await getProduct(parsed.data.productId);
      if (!refreshed.ok) {
        return failure({ code: 'INTERNAL', message: refreshed.error.message });
      }
      return success(refreshed.value);
    }

    const result = await updateProduct(parsed.data.workspaceId, parsed.data.productId, {
      name: parsed.data.name,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      assetRef: parsed.data.deliveryAssetId,
    });
    if (!result.ok) {
      return failure({ code: 'INTERNAL', message: result.error.message });
    }
    return success(result.value);
  } catch (err) {
    logger.error('[commerce] updateCommerceProduct failed', toError(err));
    return failure({ code: 'INTERNAL', message: toError(err).message });
  }
}
