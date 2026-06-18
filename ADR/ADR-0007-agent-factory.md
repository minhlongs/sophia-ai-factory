# ADR-0007 — Sophia Agent Factory Is D1-Persisted and Tier-Gated

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CEO + CTO

## Context

Sophia includes a C-Level agent hierarchy, D1-backed agent definitions/tasks/logs, tier enforcement, prompt variants, and scheduled cron jobs.

## Decision

Agent execution is product infrastructure: persisted in D1, tier-gated, observable through signals/logs, and designed for future self-service customer use.

## Consequences

- Agent roles and limits must map to tiers.
- Agent memory/journaling must be PII-safe.
- Agent costs and failures must be visible before scaling the feature.

## Evidence

- [`.sophia-factory/orchestrator.md`](.sophia-factory/orchestrator.md#L21-L52) — C-Level routing and agent spawn policy.
- [`.sophia-factory/agents/cto.md`](.sophia-factory/agents/cto.md#L22-L120) — CTO agent responsibilities.
- [`.sophia-factory/agents/ceo.md`](.sophia-factory/agents/ceo.md#L22-L105) — CEO agent responsibilities.
- [`apps/sophia-ai-factory/src/forest/agents/runner.ts`](apps/sophia-ai-factory/src/forest/agents/runner.ts#L1-L192) — D1-backed task runner, tier gate, prompt variants, and usage tracking.
- [`apps/sophia-ai-factory/src/forest/agents/enforcement-gate.ts`](apps/sophia-ai-factory/src/forest/agents/enforcement-gate.ts#L1-L73) — tier-based gate.
- [`apps/sophia-ai-factory/src/forest/agents/prompt-variants.ts`](apps/sophia-ai-factory/src/forest/agents/prompt-variants.ts#L1-L68) — prompt variant registry.
