/**
 * Campaign Stream Event Parser
 *
 * Layer: forest/hooks/campaign-stream
 */

import type {
  CampaignStreamEvent,
  ProgressUpdateEvent,
  StatusChangeEvent,
  StepCompleteEvent,
  ErrorEvent,
} from '@/forest/streaming/campaign-stream-types';

export function parseCampaignStreamEvent(
  raw: string,
  fallbackCampaignId: string,
): CampaignStreamEvent | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = parsed.type as string;

    if (!type || type === 'heartbeat') return null;

    if (type === 'stream_end') {
      return {
        type: 'stream_end',
        timestamp: String(parsed.timestamp ?? new Date().toISOString()),
        campaignId: String(parsed.campaignId ?? fallbackCampaignId),
        finalStatus: String(parsed.finalStatus ?? 'unknown'),
        finalProgress: typeof parsed.finalProgress === 'number' ? parsed.finalProgress : 0,
      };
    }

    if (type === 'error') {
      return {
        type: 'error',
        timestamp: String(parsed.timestamp ?? new Date().toISOString()),
        campaignId: String(parsed.campaignId ?? fallbackCampaignId),
        code: String(parsed.code ?? 'UNKNOWN'),
        message: String(parsed.message ?? 'Unknown error'),
        terminal: parsed.terminal === true,
      } as ErrorEvent;
    }

    if (type === 'progress_update') {
      return {
        type: 'progress_update',
        timestamp: String(parsed.timestamp ?? new Date().toISOString()),
        campaignId: String(parsed.campaignId ?? fallbackCampaignId),
        progress: typeof parsed.progress === 'number' ? parsed.progress : 0,
        label: String(parsed.label ?? ''),
        currentStep: parsed.currentStep ? String(parsed.currentStep) : undefined,
      } as ProgressUpdateEvent;
    }

    if (type === 'status_change') {
      return {
        type: 'status_change',
        timestamp: String(parsed.timestamp ?? new Date().toISOString()),
        campaignId: String(parsed.campaignId ?? fallbackCampaignId),
        previousStatus: String(parsed.previousStatus ?? ''),
        status: String(parsed.status ?? ''),
      } as StatusChangeEvent;
    }

    if (type === 'step_complete') {
      let metadata: Record<string, unknown> = {};
      if (parsed.metadata && typeof parsed.metadata === 'object') {
        metadata = parsed.metadata as Record<string, unknown>;
      }
      return {
        type: 'step_complete',
        timestamp: String(parsed.timestamp ?? new Date().toISOString()),
        campaignId: String(parsed.campaignId ?? fallbackCampaignId),
        step: String(parsed.step ?? ''),
        completedAt: String(parsed.completedAt ?? parsed.timestamp ?? new Date().toISOString()),
        metadata,
      } as StepCompleteEvent;
    }

    return {
      type: type as CampaignStreamEvent['type'],
      timestamp: String(parsed.timestamp ?? new Date().toISOString()),
      campaignId: String(parsed.campaignId ?? fallbackCampaignId),
    } as CampaignStreamEvent;
  } catch {
    return null;
  }
}
