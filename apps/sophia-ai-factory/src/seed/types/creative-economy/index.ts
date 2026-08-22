/**
 * Canonical Creative Economy contracts — barrel export.
 *
 * Re-exports the full contract surface (interfaces, events, errors, ids,
 * schemas) from a single path so consumers import from one place:
 *
 *   import type { ICreativeMemoryStore } from '@/seed/types/creative-economy'
 *
 * @module seed/types/creative-economy
 */

export * from './interfaces-memory'
export * from './interfaces-agents'
export * from './interfaces-distribution'
export * from './events'
export * from './errors'
export * from './ids'
// entities-schema owns the canonical entity TYPES (Mission, CreativeMissionStatus,
// AutonomyLevel, CreativeGoal, GoalType) in addition to the Zod schemas. It is
// re-exported here so the mission lifecycle module can import those types from
// the Creative Economy barrel instead of reaching into creative-domain.ts.
// Overlapping names with './schema' are deduped by `export *`.
export * from './entities-schema'
export * from './schema'