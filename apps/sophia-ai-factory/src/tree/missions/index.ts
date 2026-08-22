/**
 * Missions domain — tree layer
 * Core domain logic: types, command registry, auth, checkpoint persistence
 *
 * @deprecated This module is the non-canonical mission-handler surface. It
 * duplicates `tree/mission` (lifecycle + goals) and re-exports handler types
 * that also live in `seed/types/missions.ts`. Do NOT extend it. New mission
 * lifecycle code goes in `tree/mission`; new mission-handler types go in
 * `tree/missions/types.ts` (the canonical handler contract). Migration to a
 * single mission module is tracked for Phase 2. See
 * docs/architecture/DEPRECATION_CANDIDATES.md.
 */
/** @deprecated Non-canonical. Replaced by `tree/mission` lifecycle + `tree/missions/types.ts`. */
export * from './types';
/** @deprecated Non-canonical. Command registry moves to Phase 2 mission module. */
export * from './command-registry';
/** @deprecated Non-canonical. Replaced by `tree/byok` credential resolution. */
export * from './api-key-auth';
/** @deprecated Non-canonical. Replaced by `tree/mission` checkpoint persistence. */
export * from './checkpoint-persistence';
