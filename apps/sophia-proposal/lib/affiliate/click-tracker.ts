/**
 * Affiliate Click Tracker
 *
 * Tracks affiliate link clicks with privacy-safe IP hashing (SHA-256).
 * No raw IP stored — GDPR/CCPA compliant.
 */

import { createHash } from 'crypto';
import { createServerClient } from '@/lib/db/client';

/**
 * Hash IP address with SHA-256 for privacy-safe storage
 */
export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Extract client IP from request headers (handles proxies/CDN)
 */
function extractIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Record an affiliate link click in the database.
 * Silently swallows errors — click tracking must never break the redirect.
 */
export async function trackClick(
  programId: string,
  contentId: string | null,
  req: Request
): Promise<void> {
  try {
    const db = createServerClient();
    const rawIP = extractIP(req);

    await db.from('affiliate_clicks').insert({
      program_id: programId,
      content_id: contentId,
      ip_hash: hashIP(rawIP),
      referrer: req.headers.get('referer') || null,
      user_agent: req.headers.get('user-agent') || null,
      clicked_at: new Date().toISOString(),
    });
  } catch {
    // Never throw — redirect must succeed even if tracking fails
  }
}
