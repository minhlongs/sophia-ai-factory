/**
 * Deprecation Markers — Sophia 2027 Cleanup
 *
 * Single registry of every deprecated artifact with its migration path.
 * Layer: seed (foundational — this file has no domain imports).
 *
 * @module seed/types/deprecation-markers
 */

import { logger } from '@/seed/utils/logger-utility';
import { DEPRECATION_REGISTRY } from './deprecation-registry-entries';

export { DEPRECATION_REGISTRY };

export interface DeprecationEntry {
  /** Absolute file path or module specifier being deprecated. */
  readonly target: string;
  /** What replaces it. */
  readonly replacement: string;
  /** ISO date the deprecation was recorded. */
  readonly deprecatedAt: string;
  /** ISO date after which removal is permitted (deprecatedAt + 2 sprints). */
  readonly removableAfter: string;
  /** Why this artifact is being deprecated. */
  readonly reason: string;
  /** Severity: 'duplicate' (same logic, two copies), 'superseded' (newer impl), 'legacy' (no active replacement yet). */
  readonly kind: 'duplicate' | 'superseded' | 'legacy';
  /** Files that import the deprecated target (populated at registration time). */
  readonly callers: readonly string[];
}

/** Find a deprecation entry by target path. */
export function getDeprecation(target: string): DeprecationEntry | undefined {
  return DEPRECATION_REGISTRY.find((e) => e.target === target);
}

/** All entries of a given kind. */
export function listByKind(kind: DeprecationEntry['kind']): readonly DeprecationEntry[] {
  return DEPRECATION_REGISTRY.filter((e) => e.kind === kind);
}

/** Entries whose removal date has passed (candidates eligible for deletion). */
export function getRemovalReady(now: Date = new Date()): readonly DeprecationEntry[] {
  return DEPRECATION_REGISTRY.filter((e) => new Date(e.removableAfter) <= now);
}

/** Total count of tracked deprecations. */
export function deprecationCount(): number {
  return DEPRECATION_REGISTRY.length;
}

const duplicates = listByKind('duplicate');
const superseded = listByKind('superseded');
const legacy = listByKind('legacy');

logger.info('Deprecation registry initialized', {
  total: DEPRECATION_REGISTRY.length,
  duplicates: duplicates.length,
  superseded: superseded.length,
  legacy: legacy.length,
  module: 'seed/types/deprecation-markers',
});
