/**
 * HeyGen Webhook Types & Helpers
 * Layer: land/webhooks/heygen
 */

export interface HeyGenWebhookPayload {
  event_type?: string;
  event_data?: Record<string, unknown>;
  video_id?: string;
  status?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

export function normalizeStatus(raw?: string): 'completed' | 'failed' | 'processing' {
  if (!raw) return 'processing';
  const s = raw.toLowerCase();
  if (s === 'success' || s === 'completed') return 'completed';
  if (s === 'error' || s === 'failed') return 'failed';
  return 'processing';
}

export function resolveVideoId(payload: HeyGenWebhookPayload): string | undefined {
  if (payload.event_data && typeof payload.event_data === 'object') {
    const d = payload.event_data as Record<string, unknown>;
    if (typeof d.video_id === 'string') return d.video_id;
  }
  return payload.video_id;
}
