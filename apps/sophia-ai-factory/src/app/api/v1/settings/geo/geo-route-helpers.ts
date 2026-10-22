/**
 * Helpers for the geo-namespace settings routes.
 *
 * The geo namespace carries a compliance-relevant fact: the jurisdiction the
 * tenant declares it publishes to. The compliance gate treats an undeclared
 * jurisdiction as unknown and blocks regulated verticals, so this write path
 * must preserve the tenant's existing block rules while the declaration changes.
 *
 * @module app/api/v1/settings/geo/geo-route-helpers
 */

import type { GeoSettings } from '@/seed/tenant-settings/defaults';

/**
 * Merge a declared jurisdiction into the existing geo settings.
 *
 * Shallow-merges rather than replacing, so `additionalRules` and `removedRules`
 * that the tenant configured elsewhere survive the write. When the value is
 * cleared, the key is removed outright instead of being stored as null so a
 * later read resolves to the same "undeclared" state as a fresh tenant.
 */
export function mergeJurisdiction(
  existing: GeoSettings,
  targetJurisdiction: string | null,
): GeoSettings {
  const { targetJurisdiction: _previous, ...rest } = existing;
  if (targetJurisdiction === null) return rest;
  return { ...rest, targetJurisdiction };
}
