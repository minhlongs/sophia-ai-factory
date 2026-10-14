/**
 * Agent Protocol — Shared Contract for Sophia 2027 Agents Facade
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Defines the universal interface that ALL Sophia agents implement.
 * Used by forest agents, orchestrated by land workflows.
 * Preserves 100% backward compatibility for all imports.
 *
 * @deprecated 2026-08-16 — duplicate of `@/tree/agent-protocol`. The agent
 * execution contract belongs in tree (domain-reusable), not forest
 * (infrastructure). New agent code should use `executeAgent()` from
 * `@/tree/agent-protocol`. This file is retained only for the Inngest
 * integration in `@/forest/inngest/functions/agent-mission-executor`.
 * Removal permitted after 2026-09-16. Tracked in
 * `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 *
 * @module forest/agent-protocol
 */

export * from './types/index';
