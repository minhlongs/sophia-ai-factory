/**
 * Queue routing, handler loading, checkpoint persistence, and stuck mission recovery
 * @module forest/missions/dispatcher-ops/queue-router
 */

import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/tree/missions/types';
import {
  failMission,
  saveCp,
  loadCp,
  recoverStuckMissions,
} from './checkpoint-recovery-ops';

export { failMission, saveCp, loadCp, recoverStuckMissions };

type MissionHandler = (ctx: MissionContext) => Promise<MissionHandlerResult>;

/**
 * Lazy-load handlers to keep bundle splits clean.
 */
export async function loadHandler(command: string): Promise<MissionHandler | null> {
  try {
    switch (command) {
      case 'ai:write': return (await import('@/forest/ai/missions/ai-write')).handle;
      case 'social:publish': return (await import('@/forest/publishing/missions/social-publish')).handle;
      case 'video:create': return (await import('@/forest/video/missions/video-create')).handle;
      case 'video:create_heygen': return (await import('@/forest/video/missions/video-create')).handle;
      case 'video:status': return (await import('@/forest/video/missions/video-status')).handle;
      case 'proposal:create': return (await import('@/forest/workflows/missions/proposal-create')).handle;
      case 'proposal:list': return (await import('@/forest/workflows/missions/proposal-list')).handle;
      case 'lead:find': return (await import('@/forest/leads/missions/lead-find')).handle;
      case 'lead:enrich': return (await import('@/forest/leads/missions/lead-enrich')).handle;
      case 'lead:export': return (await import('@/forest/leads/missions/lead-export')).handle;
      case 'email:campaign': return (await import('@/tree/email/missions/email-campaign')).handle;
      case 'email:test': return (await import('@/tree/email/missions/email-test')).handle;
      case 'email:templates': return (await import('@/tree/email/missions/email-templates')).handle;
      case 'campaign:run': return (await import('@/forest/missions/campaign-run')).handle;
      case 'youtube:publish': return (await import('@/forest/youtube/missions/youtube-publish')).handle;
      case 'youtube:list-channels': return (await import('@/forest/youtube/missions/youtube-list-channels')).handle;
      case 'voice:clone': return (await import('@/forest/voice/missions/voice-clone')).handle;
      case 'avatar:create-did': return (await import('@/forest/did/missions/avatar-create-did')).handle;
      case 'subtitle:generate': return (await import('@/forest/video/missions/subtitle-generate')).handle;
      case 'analytics:report': return (await import('@/forest/analytics/missions/analytics-report')).handle;
      case 'webhook:test': return (await import('@/forest/webhooks/missions/webhook-test')).handle;
      default: return null;
    }
  } catch (err) {
    logger.error('[Dispatcher] Failed to load handler', { command, err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
