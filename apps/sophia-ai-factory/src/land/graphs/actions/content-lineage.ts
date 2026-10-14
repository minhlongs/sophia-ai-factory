/**
 * Content Lineage Server Actions
 *
 * @module land/graphs/actions/content-lineage
 */

'use server';

import type { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getContentLineage,
  listProjects,
} from '@/tree/content-graph';
import {
  type GraphError,
  contentLineageSchema,
  listProjectsSchema,
  actionFailure,
} from './types';

/**
 * Get Content lineage: project → assets → derivatives → performance events.
 * Requires authenticated user with access to the specified workspace.
 */
export async function getContentLineageAction(
  data: z.infer<typeof contentLineageSchema>,
): Promise<Result<Awaited<ReturnType<typeof getContentLineage>>, GraphError>> {
  try {
    const parsed = contentLineageSchema.safeParse(data);
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

    // Fetch lineage
    const lineage = await getContentLineage(parsed.data.projectId);
    if (!lineage) {
      return failure({ code: 'NOT_FOUND', message: 'Content project not found' });
    }

    // Verify workspace match
    if (lineage.project.workspaceId !== parsed.data.workspaceId) {
      return failure({ code: 'FORBIDDEN', message: 'Project does not belong to this workspace' });
    }

    logger.info('[Graphs] getContentLineageAction', {
      projectId: parsed.data.projectId,
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      assetsCount: lineage.assets.length,
      derivativesCount: lineage.derivatives.length,
      performanceCount: lineage.performance.length,
    });

    return success(lineage);
  } catch (err) {
    return failure(actionFailure('[Graphs] getContentLineageAction', err));
  }
}

/**
 * List content projects for a workspace.
 * Requires authenticated user with access to the specified workspace.
 */
export async function listProjectsAction(
  data: z.infer<typeof listProjectsSchema>,
): Promise<Result<{ projects: Awaited<ReturnType<typeof listProjects>>; count: number }, GraphError>> {
  try {
    const parsed = listProjectsSchema.safeParse(data);
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

    const projects = await listProjects(parsed.data.workspaceId, parsed.data.missionId);

    logger.info('[Graphs] listProjectsAction', {
      workspaceId: parsed.data.workspaceId,
      missionId: parsed.data.missionId,
      userId: user.id,
      count: projects.length,
    });

    return success({ projects, count: projects.length });
  } catch (err) {
    return failure(actionFailure('[Graphs] listProjectsAction', err));
  }
}
