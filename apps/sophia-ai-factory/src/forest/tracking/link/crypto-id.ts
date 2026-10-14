/**
 * Tracking Crypto and ID Generation
 *
 * Layer: forest/tracking
 */

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_ID_LENGTH = 8;

/**
 * Generate a cryptographically random 8-char base62 ID.
 * Uses Web Crypto (available in CF Workers + Node 20+).
 */
export function generateShortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_ID_LENGTH));
  return Array.from(bytes)
    .map((b) => BASE62[b % 62])
    .join('');
}

/**
 * Hash IP address using sha256(ip + tenantSecret).
 * Raw IP is NOT stored — only the hash.
 */
export async function hashIp(ip: string, tenantSecret: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}:${tenantSecret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getTenantSecret(tenantId: string): string {
  // Derives a per-tenant secret from env + tenantId.
  // In production, TRACKING_HMAC_SECRET should be a 32+ byte random value.
  const base = (globalThis as Record<string, unknown>).__env as Record<string, string> | undefined;
  const envSecret = base?.TRACKING_HMAC_SECRET ?? 'sophia-tracking-secret';
  return `${envSecret}:${tenantId}`;
}
