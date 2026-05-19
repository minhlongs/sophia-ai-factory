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
import { deductCredits } from '@/lib/mcu/credits-repo';
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

  if (!handler || !commandDef) {
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

  let params: Record<string, unknown> = {};
  try {
    params = mission.params ? (JSON.parse(mission.params) as Record<string, unknown>) : {};
  } catch {
    params = {};
  }

  let handlerResult: MissionHandlerResult;
  try {
    handlerResult = await handler({
      missionId: mission.id,
      userId: mission.user_id,
      command: mission.command,
      params,
    });
  } catch (err) {
    handlerResult = {
      ok: false,
      error: err instanceof Error ? err.message : 'Handler threw unexpected error',
    };
  }

  const creditsUsed = commandDef.credits;
  const now = Math.floor(Date.now() / 1000);

  if (handlerResult.ok) {
    // Deduct credits (non-blocking — best effort)
    if (creditsUsed > 0) {
      await deductCredits(mission.user_id, creditsUsed, missionId, `command:${mission.command}`);
    }

    await db
      .from('engine_missions')
      .update({
        status: 'succeeded',
        result: JSON.stringify(handlerResult.data ?? {}),
        credits_used: creditsUsed,
        updated_at: now,
        completed_at: now,
      })
      .eq('id', missionId);
  } else {
    await db
      .from('engine_missions')
      .update({
        status: 'failed',
        error: handlerResult.error ?? 'Unknown error',
        updated_at: now,
        completed_at: now,
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
