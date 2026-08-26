/**
 * Server Actions for Graph Read APIs — IP Graph + Content Graph lineage exposure.
 * Wraps tree-layer graph stores with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/graphs/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getIP,
  getIPChildren,
  getIPDerivatives,
} from '@/tree/ip-graph';
import {
  getContentLineage,
  listProjects,
} from '@/tree/content-graph';

// ── Error Types ──────────────────────────────────────────────────────────────

export type GraphError = {
  code: string;
  message: string;
};

/**
 * Map a caught error to the action failure shape.
 * Tree-layer error codes pass through; anything else logs and maps to INTERNAL.
 */
function actionFailure(scope: string, err: unknown): GraphError {
  if (err instanceof Error && (err.name === 'IPGraphError' || err.name === 'ContentGraphError')) {
    return { code: (err as Error & { code: string }).code, message: err.message };
  }

  const error = toError(err);
  logger.error(`${scope} failed`, error);
  return { code: 'INTERNAL', message: error.message };
}

// ── Validation Schemas ───────────────────────────────────────────────────────

const ipLineageSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  ipId: z.string().min(1, 'IP ID is required'),
});

const contentLineageSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
});

const listProjectsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  missionId: z.string().optional(),
});

// ── Helper: Verify Workspace Access ──────────────────────────────────────────

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

// ── Actions ──────────────────────────────────────────────────────────────────

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

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
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

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
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

    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
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