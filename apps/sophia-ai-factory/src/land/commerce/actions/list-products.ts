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
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
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
