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
import {
  verifyWorkspaceAccess,
  hasWorkspaceRole,
} from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  beginMissionExecution,
  canStartExecution,
  createApproval,
  EXECUTION_START_FROM,
  getMissionWithGoals as dbGetMissionWithGoals,
  listPendingApprovals,
  resolveApproval,
  updateMissionStatus as treeUpdateMissionStatus,
} from '@/tree/mission';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import { inngest } from '@/seed/inngest/client';
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import type { AICapability } from '@/seed/ai/capability-model';
import type {
  MissionTrackStatus,
  MultiTrackExecutionResult,
} from '@/tree/mission';


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
  estimatedCostCents: z.number().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
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
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, d1);
    if (!hasAccess) {
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

    // ── SIDE-CHANNEL: mission.created (Q9/Q10 funnel entry) — non-fatal.
    // Fires AFTER the row commit so the event never appears if creation
    // rolled back. Telemetry failure must not abort the 201 path.
    try {
      const { emitMissionCreated } = await import('@/tree/performance/loop-emitters-runner');
      await emitMissionCreated({
        workspaceId: parsed.data.workspaceId,
        missionId: mission.id,
        autonomyLevel: parsed.data.autonomyLevel,
        budgetCents: parsed.data.budgetCents,
        recordedAt: Date.now(),
      });
    } catch (err) {
      logger.warn('[CreativeMission.createMission] mission.created emit failed (non-fatal)', {
        missionId: mission.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

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
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify ownership or admin access
    const isCreator = mission.creator_id === user.id;
    if (!isCreator) {
      // Check if user is workspace admin/owner
      const hasAdmin = await hasWorkspaceRole(mission.workspace_id, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
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
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, d1);
    if (!hasAccess) {
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
    const hasAccess = await verifyWorkspaceAccess(missionWithGoals.workspaceId, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify ownership or admin access
    const isCreator = missionWithGoals.creatorId === user.id;
    if (!isCreator) {
      // Check if user is workspace admin/owner
      const hasAdmin = await hasWorkspaceRole(missionWithGoals.workspaceId, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
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
      .first<{
        workspace_id: string;
        creator_id: string;
        status: string;
        current_phase?: string | null;
      }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // ─── 7-Gate Mission Preflight ──────────────────────────────────────────
    // Fail-closed: all 7 gates must pass before flipping mission to 'running'.
    const requiredCaps: AICapability[] =
      (parsed.data.requiredCapabilities as AICapability[]) ??
      ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'];

    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: mission.workspace_id,
      estimatedCostCents: parsed.data.estimatedCostCents,
      requiredCapabilities: requiredCaps,
      overrides: {
        membershipVerified: true,
      },
    });

    if (!preflight.passed) {
      return failure({
        code: preflight.failureCode ?? 'PREFLIGHT_FAILED',
        message: preflight.failureReason ?? 'Mission preflight check failed',
      });
    }

    // Atomic 'running' flip via the tree authority — invalid start states and
    // concurrent writers reject BEFORE any Inngest event is emitted.
    await beginMissionExecution(parsed.data.missionId);

    // Emit Inngest event to trigger agent execution with retry and safe rollback
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      await sendInngestWithRetry(() =>
        inngest.send({
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
        }),
      );
    } catch (sendErr) {
      logger.error('[CreativeMission] inngest.send failed, rolling back mission status', {
        missionId: parsed.data.missionId,
        runId,
        previousStatus: mission.status,
        error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });

      // Rollback mission in D1 to prevent permanent 'running' lockout
      const db = await getD1();
      if (db) {
        try {
          await db
            .prepare(
              `UPDATE creative_missions
               SET status = ?, current_phase = ?, updated_at = ?
               WHERE id = ? AND status = 'running'`,
            )
            .bind(
              mission.status,
              mission.current_phase ?? 'init',
              Math.floor(Date.now() / 1000),
              parsed.data.missionId,
            )
            .run();
        } catch (rollbackErr) {
          logger.error('[CreativeMission] Failed to rollback mission status', {
            missionId: parsed.data.missionId,
            error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          });
        }
      }

      throw sendErr;
    }

    // Trigger multi-track orchestrator via Tree Service Bridge
    try {
      const { dispatchMultiTrackMission } = await import('@/tree/mission');
      void dispatchMultiTrackMission(parsed.data.missionId, {
        userId: user.id,
        workspaceId: mission.workspace_id,
      }).catch((orchErr) => {
        logger.error('[CreativeMission] dispatchMultiTrackMission async execution failed', {
          missionId: parsed.data.missionId,
          error: orchErr instanceof Error ? orchErr.message : String(orchErr),
        });
      });
    } catch (importErr) {
      logger.warn('[CreativeMission] multi-track dispatch skipped', {
        error: importErr instanceof Error ? importErr.message : String(importErr),
      });
    }


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

const getMissionTrackStatusSchema = z.union([
  z.string().min(1, 'Mission ID is required'),
  z.object({
    missionId: z.string().min(1, 'Mission ID is required'),
  }),
]);

/**
 * Get live track-level status for a creative mission (script, audio, visual, video).
 */
export async function getMissionTrackStatus(
  input: string | { missionId: string }
): Promise<
  Result<
    {
      missionId: string;
      status: string;
      currentPhase: string;
      trackStatus: MissionTrackStatus;
    },
    MissionError
  >
> {
  try {
    const parsed = getMissionTrackStatusSchema.safeParse(input);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const missionId = typeof parsed.data === 'string' ? parsed.data : parsed.data.missionId;

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, status, current_phase, constraints FROM creative_missions WHERE id = ?')
      .bind(missionId)
      .first<{
        workspace_id: string;
        creator_id: string;
        status: string;
        current_phase: string;
        constraints: string | null;
      }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const { getMissionTrackStatus: getTreeTrackStatus } = await import('@/tree/mission');
    const trackStatus = await getTreeTrackStatus(missionId, mission.constraints);


    return success({
      missionId,
      status: mission.status,
      currentPhase: mission.current_phase,
      trackStatus,
    });
  } catch (err) {
    return failure(actionFailure('[CreativeMission] getMissionTrackStatus', err));
  }
}

const executeMultiTrackMissionSchema = z.object({
  missionId: z.string().min(1, 'Mission ID is required'),
  topic: z.string().trim().max(500).optional(),
  estimatedScenes: z.number().int().min(1).max(20).optional(),
  durationSeconds: z.number().int().min(15).max(180).optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:3']).optional(),
  estimatedCostCents: z.number().int().nonnegative().max(500).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

export type ExecuteMultiTrackMissionInput = z.infer<typeof executeMultiTrackMissionSchema>;

/**
 * Synchronous server action to execute a multi-track creative mission.
 * Enforces Zod schema validation, authentication, workspace IDOR protection,
 * creator/admin role authorization, legal start-state checks, and the fail-closed
 * 7-gate preflight check before delegating to the multi-track orchestrator.
 */
export async function executeMultiTrackMissionAction(
  data: z.infer<typeof executeMultiTrackMissionSchema>
): Promise<Result<MultiTrackExecutionResult, MissionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = executeMultiTrackMissionSchema.safeParse(data);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const mission = await d1
      .prepare('SELECT workspace_id, creator_id, status FROM creative_missions WHERE id = ?')
      .bind(parsed.data.missionId)
      .first<{ workspace_id: string; creator_id: string; status: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    // 1. Verify workspace membership (IDOR prevention)
    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // 2. Verify creator ownership or workspace ADMIN/OWNER role
    const isCreator = mission.creator_id === user.id;
    if (!isCreator) {
      const hasAdmin = await hasWorkspaceRole(mission.workspace_id, user.id, 'ADMIN', d1);
      if (!hasAdmin) {
        return failure({
          code: 'FORBIDDEN',
          message: 'You do not have permission to execute this mission',
        });
      }
    }

    // 3. Verify mission status allows starting execution
    if (!canStartExecution(mission.status as CreativeMissionStatus)) {
      return failure({
        code: 'EXECUTION_START_INVALID',
        message: `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`,
      });
    }

    // 4. 7-Gate Mission Preflight Check (fail-closed)
    const requiredCaps: AICapability[] =
      (parsed.data.requiredCapabilities as AICapability[]) ??
      ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'];

    const preflight = await runMissionPreflightCheck({
      userId: user.id,
      workspaceId: mission.workspace_id,
      requiredCapabilities: requiredCaps,
      estimatedCostCents: parsed.data.estimatedCostCents,
      overrides: {
        membershipVerified: true,
      },
    });

    if (!preflight.passed) {
      logger.warn('[CreativeMission] executeMultiTrackMissionAction rejected by preflight', {
        missionId: parsed.data.missionId,
        failureCode: preflight.failureCode,
        failureReason: preflight.failureReason,
      });
      return failure({
        code: preflight.failureCode ?? 'PREFLIGHT_FAILED',
        message: preflight.failureReason ?? 'Mission preflight check failed',
      });
    }

    // 5. Delegate to Tree Service Bridge
    const { dispatchMultiTrackMission } = await import('@/tree/mission');

    const result = await dispatchMultiTrackMission(parsed.data.missionId, {
      userId: user.id,
      workspaceId: mission.workspace_id,
      topic: parsed.data.topic,
      estimatedScenes: parsed.data.estimatedScenes,
      durationSeconds: parsed.data.durationSeconds,
      aspectRatio: parsed.data.aspectRatio,
      estimatedCostCents: parsed.data.estimatedCostCents,
    });


    if (!result.success) {
      return failure({
        code: 'EXECUTION_FAILED',
        message: result.error || 'Multi-track execution failed',
      });
    }

    return success(result);
  } catch (err) {
    return failure(actionFailure('[CreativeMission] executeMultiTrackMissionAction', err));
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

    const hasAccess = await verifyWorkspaceAccess(mission.workspace_id, user.id, d1);
    if (!hasAccess) {
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
    const hasAccess = await verifyWorkspaceAccess(agentRun.workspace_id, user.id, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    // Verify user is admin/owner
    const hasAdmin = await hasWorkspaceRole(agentRun.workspace_id, user.id, 'ADMIN', d1);
    if (!hasAdmin) {
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

    // Close the approval loop: notify the Inngest agent-approval-handler so it
    // resumes (approved) or fails (rejected) the agent run. Fire-and-forget —
    // an emit failure must never flip the approve/reject outcome returned below.
    const resolvedRow = result.value;
    const runId =
      typeof resolvedRow.agent_run_id === 'string'
        ? resolvedRow.agent_run_id
        : (approval.agent_run_id as string);
    try {
      await inngest.send({
        name: 'agent.approval.resolved',
        data: {
          approvalId: parsed.data.approvalId,
          runId,
          status,
          reviewerId: user.id,
          comment: parsed.data.reason,
        },
      });
    } catch (err) {
      logger.warn('[Approval] agent.approval.resolved emit failed (non-fatal)', {
        approvalId: parsed.data.approvalId,
        error: toError(err).message,
      });
    }

    // ── SIDE-CHANNEL: creative.accepted / creative.rejected (Q3) — non-fatal.
    // Approval resolve is the human creative decision. Look up mission_id from
    // agent_runs (the action only has workspace_id + agent_run_id). Emit based
    // on status; skip silently if lookup fails or mission_id is null (legacy
    // runs) — low-frequency path, one extra SELECT is acceptable.
    try {
      const runRow = await d1
        .prepare('SELECT mission_id FROM agent_runs WHERE id = ?')
        .bind(runId)
        .first<{ mission_id: string | null }>();
      const { emitCreativeAccepted, emitCreativeRejected } = await import('@/tree/performance/loop-emitters-creative');
      if (runRow?.mission_id) {
        if (status === 'approved') {
          await emitCreativeAccepted({
            workspaceId: agentRun.workspace_id,
            missionId: runRow.mission_id,
            graphRunId: runId,
            nodeId: parsed.data.approvalId,
            assetId: '',
            agentSlug: 'human-approval',
            recordedAt: Date.now(),
          });
        } else {
          await emitCreativeRejected({
            workspaceId: agentRun.workspace_id,
            missionId: runRow.mission_id,
            graphRunId: runId,
            nodeId: parsed.data.approvalId,
            assetId: '',
            agentSlug: 'human-approval',
            reasonCode: parsed.data.reason ?? 'REJECTED',
            recordedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      logger.warn('[Approval] creative.accepted/rejected emit failed (non-fatal)', {
        approvalId: parsed.data.approvalId, status,
        error: err instanceof Error ? err.message : String(err),
      });
    }

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
    const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id, d1);
    if (!hasAccess) {
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
