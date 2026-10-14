/**
 * URL-to-Revenue Request Validation
 *
 * Layer: seed/factory
 */

import type { URLToRevenueRequest, Channel } from './types';

export function validateRequest(req: URLToRevenueRequest): string | null {
  if (!req.url || !req.url.startsWith('https://')) {
    return 'url must be an HTTPS URL';
  }
  if (!req.tenantId || req.tenantId.trim() === '') {
    return 'tenantId is required';
  }
  if (!req.channels || req.channels.length === 0) {
    return 'channels must be a non-empty array';
  }
  const validChannels: Channel[] = ['youtube', 'tiktok', 'instagram'];
  for (const ch of req.channels) {
    if (!validChannels.includes(ch)) {
      return `invalid channel: ${ch}`;
    }
  }
  return null;
}
