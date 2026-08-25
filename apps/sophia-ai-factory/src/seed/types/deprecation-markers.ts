/**
 * Deprecation Markers — Sophia 2027 Cleanup
 *
 * Single registry of every deprecated artifact with its migration path.
 * Policy: never delete working functionality. Deprecate → migrate → remove
 * after a 2-sprint buffer.
 *
 * Layer: seed (foundational — this file has no domain imports).
 *
 * @module seed/types/deprecation-markers
 */

import { logger } from '@/seed/utils/logger-utility';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Canonical list of deprecation candidates discovered during the Sophia 2027
 * reconnaissance (see `docs/architecture/DEPRECATION_CANDIDATES.md`).
 *
 * Callers are populated by scanning the repo at registration time. The list
 * is intentionally exhaustive for known duplicates; new candidates should be
 * added here rather than inline `@deprecated` tags scattered across files.
 */
export const DEPRECATION_REGISTRY: readonly DeprecationEntry[] = [
  // ── Duplicate workflow implementations ──────────────────────────────────
  {
    target: '@/forest/workflows/compute-next',
    replacement: '@/land/workflows/compute-next',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-09-16',
    reason: 'Duplicate of land/workflows/compute-next. Forest copy is older — no parallel_group/depends_on DAG support. Land copy is the live implementation used by the cron stepper.',
    kind: 'duplicate',
    callers: ['@/forest/workflows/compute-next.test'],
  },
  {
    target: '@/forest/workflows/supervisor-steps',
    replacement: '@/land/workflows/supervisor-steps',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-09-16',
    reason: 'Duplicate of land/workflows/supervisor-steps. Forest copy is the hardcoded 3-step MVP; land copy is the pluggable wrapper around seed config (WORKFLOW_PRESETS). Land is the live implementation.',
    kind: 'duplicate',
    callers: ['@/forest/workflows/compute-next.test'],
  },
  {
    target: '@/forest/workflows/checkpoint',
    replacement: '@/seed/missions/checkpoint',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-09-16',
    reason: 'Duplicate of seed/missions/checkpoint. Forest copy violates layer rules (forest importing nothing from seed for pure utilities). Seed copy is layer-compliant and is the live implementation.',
    kind: 'duplicate',
    callers: ['@/tree/missions/checkpoint-persistence'],
  },
  // ── Ad-hoc agent implementations ────────────────────────────────────────
  {
    target: '@/tree/agent-fleet/spawn-agent-fleet',
    replacement: '@/tree/agent-protocol/agent-executor',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-09-16',
    reason: 'Ad-hoc fleet executor that bypasses AgentProtocol. Does not respect AutonomyLevel approval gates or record provenance per run. New agent execution must go through executeAgent().',
    kind: 'superseded',
    callers: [
      '@/tree/agent-fleet/index',
      '@/tree/agent-fleet/spawn-agent-fleet-executor',
      '@/tree/sop/solo-orchestrator',
      '@/tree/openclaw/index',
    ],
  },
  {
    target: '@/forest/agent-protocol',
    replacement: '@/tree/agent-protocol',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-09-16',
    reason: 'Forest-layer agent protocol duplicates tree/agent-protocol. Forest is infrastructure; the agent execution contract belongs in tree (domain-reusable). Verified 2026-08-26: zero external importers remain — the only reference is a self-import of forest/agent-protocol/types inside forest/agent-protocol/registry.ts; the Inngest agent-mission-executor imports tree/agent-protocol directly. Removal-ready after the buffer date.',
    kind: 'duplicate',
    callers: [],
  },
  // ── Implicit memory ─────────────────────────────────────────────────────
  {
    target: '@/land/openclaw/memory-adapter',
    replacement: '@/tree/creative-memory',
    deprecatedAt: '2026-08-16',
    removableAfter: '2026-10-16',
    reason: 'OpenClaw memory adapter writes memory without CreativeMemory typing, versioning, scoping, or provenance. Memory must flow through the typed creative-memory repo.',
    kind: 'legacy',
    callers: ['@/land/openclaw/index'],
  },
  // ── Dead AI provider config module ───────────────────────────────────────
  {
    target: 'tree/ai-providers',
    replacement: 'none — dead code; rebuild fresh on seed/ai Provider contract if persisted tenant config is ever needed',
    deprecatedAt: '2026-08-23',
    removableAfter: '2026-09-06',
    reason: 'Dead code: 0 importers (verified 2026-08-23) and its D1 tables (ai_providers, ai_usage) were never created in any migration. Runtime transport lives in seed/ai.',
    kind: 'legacy',
    callers: [],
  },
  // ── Duplicate Inngest clients ─────────────────────────────────────────────
  {
    target: '@/tree/inngest/client',
    replacement: '@/seed/inngest/client',
    deprecatedAt: '2026-08-23',
    removableAfter: '2026-09-20',
    reason:
      "Duplicate Inngest client (same app id 'sophia-ai-factory', divergent event schemas). Schemas merged into the canonical seed client; the tree client is now a re-export shim left in place until every caller migrates plus a 2-sprint buffer.",
    kind: 'duplicate',
    callers: [
      '@/app/actions/campaigns-tier-integration.test',
      '@/forest/inngest/functions/agent-approval-handler',
      '@/forest/inngest/functions/agent-mission-executor',
      '@/forest/inngest/functions/agent-rollback-cron',
      '@/forest/provenance/provenance-bridge',
      '@/land/campaigns/create-campaign-core',
      '@/land/creative-mission/actions',
      '@/land/openclaw/queue',
      '@/land/openclaw/schedule',
      '@/land/video/generation/video-job-pipeline',
      '@/tree/telegram/handlers/campaign-handler',
      '@/tree/telegram/telegram-bot-campaign-fsm-confirm',
      '@/tree/video/events',
    ],
  },
  // ── Legacy compatibility shims ──────────────────────────────────────────
  {
    target: '@/src/lib/*',
    replacement: '@/seed/* + @/tree/*',
    deprecatedAt: '2026-04-14',
    removableAfter: 'TBD',
    reason: 'Pre-consolidation compatibility layer. Banned imports enforced by ESLint no-restricted-imports. Remove after all callers migrated.',
    kind: 'legacy',
    callers: ['(tracked via ESLint violation count)'],
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

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

// ─── Registration-time log ──────────────────────────────────────────────────

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