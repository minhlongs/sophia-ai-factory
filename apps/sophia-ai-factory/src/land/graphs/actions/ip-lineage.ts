/**
 * IP Lineage Server Actions
 *
 * @module land/graphs/actions/ip-lineage
 */

'use server';

import type { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getIP,
  getIPChildren,
  getIPDerivatives,
} from '@/tree/ip-graph';
import {
  type GraphError,
  ipLineageSchema,
  actionFailure,
} from './types';

/**
 * Get IP lineage: the IP entity, its children, and all derivatives (recursive).
 * Requires authenticated user with access to the specified workspace.
 */
export async function getIpLineageAction(
  data: z.infer<typeof ipLineageSchema>,
): Promise<Result<{ ip: Awaited<ReturnType<typeof getIP>>; children: Awaited<ReturnType<typeof getIPChildren>>; derivatives: Awaited<ReturnType<typeof getIPDerivatives>> }, GraphError>> {
  try {
    const parsed = ipLineageSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const db = createServerClient();
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, db);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Fetch IP entity
    const ip = await getIP(parsed.data.ipId);
    if (!ip) {
      return failure({ code: 'NOT_FOUND', message: 'IP entity not found' });
    }

    // Verify workspace match
    if (ip.workspaceId !== parsed.data.workspaceId) {
      return failure({ code: 'FORBIDDEN', message: 'IP entity does not belong to this workspace' });
    }

    // Fetch children and derivatives
    const [children, derivatives] = await Promise.all([
      getIPChildren(parsed.data.ipId),
      getIPDerivatives(parsed.data.ipId),
    ]);

    logger.info('[Graphs] getIpLineageAction', {
      ipId: parsed.data.ipId,
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      childrenCount: children.length,
      derivativesCount: derivatives.length,
    });

    return success({ ip, children, derivatives });
  } catch (err) {
    return failure(actionFailure('[Graphs] getIpLineageAction', err));
  }
}
