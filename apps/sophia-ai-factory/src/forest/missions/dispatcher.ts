/**
 * Mission Dispatcher
 *
 * Reads a pending mission from engine_missions, sets status to 'running',
 * routes to the correct handler, updates the row with result/error/credits,
 * and fires the webhook if configured.
 *
 * Designed for use with Workers executionCtx.waitUntil().
 */

import { createServerClient } from '@/seed/db/client';
import { deductCredits } from '@/land/mcu/credits-repo';
import { getCommand } from './command-registry';
import { fireMissionWebhook } from './fire-webhook';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult } from './handlers/types';

// Lazy-load handlers to keep bundle splits clean
async function loadHandler(command: string): Promise<((ctx: import('./handlers/types').MissionContext) => Promise<MissionHandlerResult>) | null> {
  try {
    switch (command) {
      case 'ai:write': return (await import('./handlers/ai-write')).handle;
      case 'social:publish': return (await import('./handlers/social-publish')).handle;
      case 'video:create': return (await import('./handlers/video-create')).handle;
      case 'video:create_heygen': return (await import('./handlers/video-create')).handle;
      case 'video:status': return (await import('./handlers/video-status')).handle;
      case 'proposal:create': return (await import('./handlers/proposal-create')).handle;
      case 'proposal:list': return (await import('./handlers/proposal-list')).handle;
      case 'lead:find': return (await import('./handlers/lead-find')).handle;
      case 'lead:enrich': return (await import('./handlers/lead-enrich')).handle;
      case 'lead:export': return (await import('./handlers/lead-export')).handle;
      case 'email:campaign': return (await import('./handlers/email-campaign')).handle;
      case 'email:test': return (await import('./handlers/email-test')).handle;
      case 'email:templates': return (await import('./handlers/email-templates')).handle;
      case 'youtube:publish': return (await import('./handlers/youtube-publish')).handle;
      case 'youtube:list-channels': return (await import('./handlers/youtube-list-channels')).handle;
      case 'voice:clone': return (await import('./handlers/voice-clone')).handle;
      case 'avatar:create-did': return (await import('./handlers/avatar-create-did')).handle;
      case 'subtitle:generate': return (await import('./handlers/subtitle-generate')).handle;
      case 'campaign:run': return (await import('./handlers/campaign-run')).handle;
      case 'analytics:report': return (await import('./handlers/analytics-report')).handle;
      case 'webhook:test': return (await import('./handlers/webhook-test')).handle;
      default: return null;
    }
  } catch (err) {
    logger.error('[Dispatcher] Failed to load handler', { command, err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** Retry wrapper: attempt up to `maxAttempts` with `delayMs` between tries. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

interface MissionRow {
  id: string;
  user_id: string;
  command: string;
  params: string | null;
  status: string;
  webhook_url: string | null;
}

/**
 * Execute a mission asynchronously.
 * Safe to call from Workers waitUntil — never throws.
 */
export async function dispatchMission(missionId: string): Promise<void> {
  const db = createServerClient();

  let mission: MissionRow | null = null;
  try {
    const { data } = await db
      .from('engine_missions')
      .select('id, user_id, command, params, status, webhook_url')
      .eq('id', missionId)
      .single() as { data: MissionRow | null; error: unknown };
    mission = data;
  } catch (err) {
    logger.error('[Dispatcher] Failed to load mission', { missionId, err });
    return;
  }

  if (!mission) {
    logger.error('[Dispatcher] Mission not found', { missionId });
    return;
  }

  if (mission.status !== 'pending') {
    logger.debug('[Dispatcher] Mission already dispatched', { missionId, status: mission.status });
    return;
  }

  // Mark running
  try {
    await db
      .from('engine_missions')
      .update({ status: 'running', updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId)
      .eq('status', 'pending');
  } catch (err) {
    logger.error('[Dispatcher] Failed to mark running', { missionId, err });
    return;
  }

  const commandDef = getCommand(mission.command);
  const handler = await loadHandler(mission.command);

  if (!commandDef) {
    await db
      .from('engine_missions')
      .update({
        status: 'failed',
        error: `Unknown command: ${mission.command}`,
        updated_at: Math.floor(Date.now() / 1000),
        completed_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', missionId);
    return;
  }

  if (!handler) {
    await db
      .from('engine_missions')
      .update({
        status: 'failed',
        error: `Handler module failed to load for command: ${mission.command}`,
        updated_at: Math.floor(Date.now() / 1000),
        completed_at: Math.floor(Date.now() / 1000),
      })
      .eq('id', missionId);
    return;
  }

  let params: Record<string, unknown> = {};
  try {
    params = mission.params ? (JSON.parse(mission.params) as Record<string, unknown>) : {};
  } catch (parseErr) {
    logger.warn("[Dispatcher] Failed to parse mission params — using empty object", {
      missionId,
      raw: mission.params?.slice(0, 200),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
    params = {}
  }

  const creditsUsed = commandDef.credits;

  // R2-6: Deduct credits BEFORE handler execution to prevent TOCTOU double-spend.
  // deductCredits is atomic (WHERE credits_remaining >= amount); if it returns false,
  // the user raced another request and lost — skip handler to avoid consuming LLM/API resources.
  if (creditsUsed > 0) {
    const deducted = await deductCredits(mission.user_id, creditsUsed, missionId, `command:${mission.command}`);
    if (!deducted) {
      logger.warn('[Dispatcher] Credit deduction failed — insufficient balance at dispatch time', { missionId, creditsUsed });
      await db
        .from('engine_missions')
        .update({
          status: 'failed',
          error: 'insufficient_credits',
          updated_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', missionId);
      return;
    }
  }

  // R2-10: Wrap handler in a 25-second timeout to prevent indefinite CF Worker I/O hangs.
  // If handler fails after credits were deducted, credits are intentionally not refunded
  // (attempted work = cost incurred); reaper will NOT refund timed-out missions.
  const HANDLER_TIMEOUT_MS = 25_000;
  let handlerResult: MissionHandlerResult;
  try {
    handlerResult = await Promise.race([
      handler({
        missionId: mission.id,
        userId: mission.user_id,
        command: mission.command,
        params,
      }),
      new Promise<MissionHandlerResult>((_, reject) =>
        setTimeout(() => reject(new Error('Mission handler timeout')), HANDLER_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Handler threw unexpected error';
    handlerResult = {
      ok: false,
      error: errMsg === 'Mission handler timeout' ? 'handler_timeout' : errMsg,
    };
  }

  const nowAfter = Math.floor(Date.now() / 1000);

  if (handlerResult.ok) {
    await db
      .from('engine_missions')
      .update({
        status: 'succeeded',
        result: JSON.stringify(handlerResult.data ?? {}),
        credits_used: creditsUsed,
        updated_at: nowAfter,
        completed_at: nowAfter,
      })
      .eq('id', missionId);
  } else {
    await db
      .from('engine_missions')
      .update({
        status: 'failed',
        error: handlerResult.error ?? 'Unknown error',
        updated_at: nowAfter,
        completed_at: nowAfter,
      })
      .eq('id', missionId);
  }

  // Fire webhook if configured
  if (mission.webhook_url) {
    try {
      await fireMissionWebhook(missionId, mission.webhook_url);
    } catch (err) {
      logger.error('[Dispatcher] Webhook fire failed', { missionId, err });
    }
  }

  logger.debug('[Dispatcher] Mission complete', { missionId, command: mission.command, ok: handlerResult.ok });
}

/**
 * Detect missions stuck in 'running' state beyond the timeout threshold.
 * Called by a cron job to recover orphaned dispatches.
 */
export async function recoverStuckMissions(stuckThresholdSeconds = 300): Promise<number> {
    const db = createServerClient();
    const cutoff = Math.floor(Date.now() / 1000) - stuckThresholdSeconds;
    try {
        const { data } = await db
            .from('engine_missions')
            .select('id')
            .eq('status', 'running')
            .lt('updated_at', cutoff)
            .limit(50);
        const stuck = (data as { id: string }[] | null) ?? [];
        for (const m of stuck) {
            await db.from('engine_missions').update({
                status: 'failed',
                error: 'stuck:recovered_by_reaper',
                updated_at: Math.floor(Date.now() / 1000),
                completed_at: Math.floor(Date.now() / 1000),
            }).eq('id', m.id);
        }
        if (stuck.length) logger.info('[Dispatcher] Recovered stuck missions', { count: stuck.length });
        return stuck.length;
    } catch (err) {
        logger.error('[Dispatcher] recoverStuckMissions failed', { err });
        return 0;
    }
}
