/**
 * Forensic Hash & UTC Date Formatter
 *
 * Layer: tree/watermark (Pure domain algorithm, zero side-effects)
 *
 * @module tree/watermark/forensic-hash
 */

/**
 * Computes a deterministic 64-bit hexadecimal forensic hash for tenant + user.
 * Pure TypeScript implementation compatible with edge isolates (no node:crypto required).
 */
export function computeForensicHash(tenantId: string, userId: string): string {
  const input = `${tenantId}:${userId}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ (ch * 31), 2166136261);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

/**
 * Formats a Date object to YYYY-MM-DD.
 */
export function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
