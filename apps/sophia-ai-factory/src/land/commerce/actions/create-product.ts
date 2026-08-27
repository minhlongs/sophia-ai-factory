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
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
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
