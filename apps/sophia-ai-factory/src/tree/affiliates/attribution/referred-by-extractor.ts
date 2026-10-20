/**
 * Referred-By Extraction from User Profile Settings
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/referred-by-extractor
 */

/**
 * Extracts referred_by string from user settings raw data.
 */
export function extractReferredByFromSettings(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const settings = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
    return typeof settings.referred_by === 'string' ? settings.referred_by : undefined;
  } catch {
    return undefined;
  }
}
