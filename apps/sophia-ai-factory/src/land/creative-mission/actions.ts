/**
 * Server Actions for creative mission lifecycle management.
 * Wraps tree-layer mission functions with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/creative-mission/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  beginMissionExecution,
  createApproval,
  getMissionWithGoals as dbGetMissionWithGoals,
  listPendingApprovals,
  resolveApproval,
  updateMissionStatus as treeUpdateMissionStatus,
} from '@/tree/mission';
import { inngest } from '@/seed/inngest/client';

// ── Types ──────────────────────────────────────────────────────────────────

export type MissionError = {
  code: string;
  message: string;
};

export type MissionAction = {
  missionId: string;
};

/**
 * Map a caught error to the action failure shape. Tree-layer MissionError
 * codes (NOT_FOUND | INVALID_TRANSITION | EXECUTION_START_INVALID |
 * CONCURRENT_MODIFICATION) pass through unchanged; anything else logs and
 * maps to INTERNAL.
 */
function actionFailure(scope: string, err: unknown): MissionError {
  if (err instanceof Error && err.name === 'MissionError') {
    // Name-based detection: the barrel exports MissionError as a type only.
    return { code: (err as Error & { code: string }).code, message: err.message };
  }

  const error = toError(err);
  logger.error(`${scope} failed`, error);
  return { code: 'INTERNAL', message: error.message };
}

// ── Validation Schemas ─────────────────────────────────────────────────────

const createMissionSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  objective: z.string().min(1, 'Objective is required').max(2000, 'Objective too long'),
  audience: z.string().min(1, 'Audience is required').max(1000, 'Audience too long'),
  geography: z.string().min(1, 'Geography is required').max(500, 'Geography too long'),
  timeframeStart: z.number().positive('Start time must be positive'),
  timeframeEnd: z.number().positive('End time must be positive'),
  budgetCents: z.number().min(0, 'Budget must be non-negative'),
  autonomyLevel: z.number().min(0).max(4, 'Autonomy level must be 0-4'),
  channels: z.array(z.string()).default([]),
  monetizationGoals: z.array(z.string()).default([]),
  constraints: z.record(z.string(), z.unknown()).default({}),
  successMetrics: z.record(z.string(), z.number()).default({}),
  brandId: z.string().optional(),
});

const updateMissionStatusSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  status: z.enum([
    'draft',
    'planned',
    'approval_required',
    'running',
    'paused',
    'review',
    'completed',
    'learning',
    'iterating',
  ]),
});

const listMissionsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

const getMissionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
});

const startMissionExecutionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  autonomyLevel: z.number().min(0).max(4, 'Autonomy level must be 0-4').default(0),
});

// ── Actions ────────────────────────────────────────────────────────────────

/**
 * Create a new creative mission.
 * Requires authenticated user with access to the specified workspace.
 */
export async function createMission(
  data: z.infer<typeof createMissionSchema>
): Promise<Result<MissionAction, MissionError>> {
  try {
    const parsed = createMissionSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Create the mission via tree layer
    const mission = await import('@/tree/mission').then((mod) =>
      mod.createMission({
        id: '',
        workspaceId: parsed.data.workspaceId,
        creatorId: user.id,
        brandId: parsed.data.brandId,
        title: parsed.data.title,
        objective: parsed.data.objective,
        audience: parsed.data.audience,
        geography: parsed.data.geography,
        timeframeStart: parsed.data.timeframeStart,
        timeframeEnd: parsed.data.timeframeEnd,
        budgetCents: parsed.data.budgetCents,
        spentCents: 0,
        autonomyLevel: parsed.data.autonomyLevel as 0 | 1 | 2 | 3 | 4,
        channels: parsed.data.channels,
        monetizationGoals: parsed.data.monetizationGoals,
        constraints: parsed.data.constraints,
        successMetrics: parsed.data.successMetrics,
        status: 'draft',
        currentPhase: 'init',
        createdAt: 0,
        updatedAt: 0,
      })
    );

    logger.info('[CreativeMission] Created mission', {
      missionId: mission.id,
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
    });

    return success({ missionId: mission.id });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] createMission', err));
  }
}

/**
 * Update mission status with transition validation.
 * Validates the transition is allowed before updating.
 */
export async function updateMissionStatus(
  data: z.infer<typeof updateMissionStatusSchema>
): Promise<Result<MissionAction, MissionError>> {
  try {
    const parsed = updateMissionStatusSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Read only what permission checks need; transitions belong to tree.
    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, current_phase FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string; creator_id: string; current_phase: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(mission.workspace_id, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify ownership or admin access
    const isCreator = mission.creator_id === user.id;
    if (!isCreator) {
      // Check if user is workspace admin/owner
      const adminAccess = await d1
        .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role IN (?, ?)')
        .bind(mission.workspace_id, user.id, 'admin', 'owner')
        .first();

      if (!adminAccess) {
        return failure({ code: 'FORBIDDEN', message: 'You do not have permission to update this mission' });
      }
    }

    // Single transition authority: validation, optimistic concurrency guard,
    // and the write live in the tree layer. Phase preserved (status-only).
    const updated = await treeUpdateMissionStatus(
      parsed.data.missionId,
      parsed.data.status,
      mission.current_phase
    );

    logger.info('[CreativeMission] Updated mission status', { missionId: parsed.data.missionId, status: updated.status, userId: user.id });

    return success({ missionId: parsed.data.missionId });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] updateMissionStatus', err));
  }
}

/**
 * List all missions for a workspace.
 * Returns missions the user has access to.
 */
export async function listMissions(
  data: z.infer<typeof listMissionsSchema>
): Promise<Result<{ missions: Array<{ id: string; title: string; status: string }>; count: number }, MissionError>> {
  try {
    const parsed = listMissionsSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Get missions for workspace
    const result = await d1
      .prepare('SELECT id, title, status FROM creative_missions WHERE workspace_id = ? ORDER BY created_at DESC')
      .bind(parsed.data.workspaceId)
      .all<{ id: string; title: string; status: string }>();

    const missions = result.results ?? [];
    return success({ missions, count: missions.length });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] listMissions', err));
  }
}

/**
 * Get a single mission with its goals.
 * Returns the full mission object including all goals.
 */
export async function getMission(
  data: z.infer<typeof getMissionSchema>
): Promise<Result<{ mission: Awaited<ReturnType<typeof dbGetMissionWithGoals>> }, MissionError>> {
  try {
    const parsed = getMissionSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Get mission with goals from tree layer
    const missionWithGoals = await dbGetMissionWithGoals(parsed.data.missionId);

    if (!missionWithGoals) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(missionWithGoals.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify ownership or admin access
    const isCreator = missionWithGoals.creatorId === user.id;
    if (!isCreator) {
      // Check if user is workspace admin/owner
      const adminAccess = await d1
        .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role IN (?, ?)')
        .bind(missionWithGoals.workspaceId, user.id, 'admin', 'owner')
        .first();

      if (!adminAccess) {
        return failure({ code: 'FORBIDDEN', message: 'You do not have permission to view this mission' });
      }
    }

    return success({ mission: missionWithGoals });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] getMission', err));
  }
}

/**
 * Start mission execution: atomically flips the mission to 'running' (phase
 * 'executing') via the tree authority — legal only from draft/planned/
 * approval_required/paused — then emits agent.mission.started. The
 * agent-mission-executor writes agent_runs only; on success the lifecycle
 * path advances the mission to 'review' for human review of artifacts.
 */
export async function startMissionExecution(
  data: z.infer<typeof startMissionExecutionSchema>
): Promise<Result<{ runId: string; agentId: string }, MissionError>> {
  try {
    const parsed = startMissionExecutionSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Get mission to verify ownership and workspace
    const mission = await d1
      .prepare('SELECT * FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string; creator_id: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(mission.workspace_id, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Atomic 'running' flip via the tree authority — invalid start states and
    // concurrent writers reject BEFORE any Inngest event is emitted.
    await beginMissionExecution(parsed.data.missionId);

    // Emit Inngest event to trigger agent execution
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await inngest.send({
      id: runId,
      name: 'agent.mission.started',
      data: {
        runId,
        agentId: parsed.data.agentId,
        missionId: parsed.data.missionId,
        workspaceId: mission.workspace_id,
        autonomyLevel: parsed.data.autonomyLevel,
      },
      ts: Date.now(),
    });

    logger.info('[CreativeMission] Started mission execution', {
      missionId: parsed.data.missionId,
      runId,
      agentId: parsed.data.agentId,
      userId: user.id,
    });

    return success({ runId, agentId: parsed.data.agentId });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] startMissionExecution', err));
  }
}

// ---------------------------------------------------------------------------
// Approval Workflow Server Actions
// ---------------------------------------------------------------------------

const requestApprovalSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  runId: z.string().min(1, 'Run ID is required'),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * Request approval for an agent action.
 * Creates an approval record tied to the mission/workspace.
 */
export async function requestApproval(
  data: z.infer<typeof requestApprovalSchema>
): Promise<Result<{ approvalId: string }, MissionError>> {
  try {
    const parsed = requestApprovalSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Verify mission exists and user has workspace access
    const mission = await d1
      .prepare('SELECT workspace_id FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(mission.workspace_id, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const approvalId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const result = await createApproval({
      id: approvalId,
      agentRunId: parsed.data.runId,
      actionId: parsed.data.agentId,
      actionType: 'mission_execution',
      actionSummary: parsed.data.reason,
      estimatedCostCents: undefined,
      timeoutAt: Math.floor(Date.now() / 1000) + 86400,
    });

    if (!result.ok) {
      return failure({
        code: result.error.code,
        message: result.error.message,
      });
    }

    logger.info('[Approval] Approval requested', {
      approvalId,
      missionId: parsed.data.missionId,
      agentId: parsed.data.agentId,
      runId: parsed.data.runId,
      userId: user.id,
      workspaceId: mission.workspace_id,
    });

    return success({ approvalId });
  } catch (err) {
    return failure(actionFailure('[Approval] requestApproval', err));
  }
}

const resolveApprovalSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
  approved: z.boolean(),
  reason: z.string().optional(),
});

/**
 * Resolve an approval (approve or reject).
 * Only workspace owner or admin can resolve.
 */
export async function resolveApprovalAction(
  data: z.infer<typeof resolveApprovalSchema>
): Promise<Result<{ status: string }, MissionError>> {
  try {
    const parsed = resolveApprovalSchema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Fetch approval + linked agent run for workspace check
    const approval = await d1
      .prepare('SELECT * FROM agent_approvals WHERE id = ?')
      .bind(parsed.data.approvalId)
      .first<Record<string, unknown>>();

    if (!approval) {
      return failure({ code: 'NOT_FOUND', message: 'Approval not found' });
    }

    const agentRun = await d1
      .prepare('SELECT workspace_id FROM agent_runs WHERE id = ?')
      .bind(approval.agent_run_id as string)
      .first<{ workspace_id: string }>();

    if (!agentRun) {
      return failure({ code: 'NOT_FOUND', message: 'Agent run not found for this approval' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(agentRun.workspace_id, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify user is admin/owner
    const adminAccess = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role IN (?, ?)')
      .bind(agentRun.workspace_id, user.id, 'admin', 'owner')
      .first();

    if (!adminAccess) {
      return failure({ code: 'FORBIDDEN', message: 'Only workspace owner or admin can resolve approvals' });
    }

    const status = parsed.data.approved ? 'approved' : 'rejected';
    const result = await resolveApproval(
      parsed.data.approvalId,
      status,
      user.id,
      parsed.data.reason
    );

    if (!result.ok) {
      return failure({
        code: result.error.code,
        message: result.error.message,
      });
    }

    logger.info('[Approval] Approval resolved', {
      approvalId: parsed.data.approvalId,
      status,
      userId: user.id,
    });

    return success({ status });
  } catch (err) {
    return failure(actionFailure('[Approval] resolveApprovalAction', err));
  }
}

/**
 * List pending approvals for the user's workspace.
 */
export async function listPendingApprovalsAction(
  data: { workspaceId: string; limit?: number; offset?: number }
): Promise<
  Result<
    { approvals: Array<Record<string, unknown>>; count: number },
    MissionError
  >
> {
  try {
    const schema = z.object({
      workspaceId: z.string().min(1, 'Workspace ID is required'),
      limit: z.number().min(1).max(100).default(50).optional(),
      offset: z.number().min(0).default(0).optional(),
    });

    const parsed = schema.safeParse(data);
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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Verify workspace membership (IDOR prevention)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(parsed.data.workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const result = await listPendingApprovals(
      parsed.data.workspaceId,
      parsed.data.limit ?? 50,
      parsed.data.offset ?? 0
    );

    if (!result.ok) {
      return failure({
        code: result.error.code,
        message: result.error.message,
      });
    }

    return success({
      approvals: result.value.approvals as unknown as Array<Record<string, unknown>>,
      count: result.value.count,
    });
  } catch (err) {
    return failure(actionFailure('[Approval] listPendingApprovalsAction', err));
  }
}
