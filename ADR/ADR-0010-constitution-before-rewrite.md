# ADR-0010 — Constitution Before Rewrite

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CEO + CTO

## Context

Sophia has accumulated many historical docs, plans, agent outputs, and implementation artifacts. Rewriting before declaring the operating truth risks preserving stale assumptions.

## Decision

The Constitution package is the source of truth for goals, agent behavior, architecture, roadmap, evaluation, business model, money graph, and founder principles. Code serves the Constitution.

## Consequences

- Refactors must map to accepted ADRs.
- Deletions require business and technical impact.
- Conflicting docs are archived or refactored before code changes.
- Future plans must not reference plan artifact labels in code, tests, commits, or migrations.

## Evidence

- [`GOAL.md`](GOAL.md#L1-L43) — Constitution goal and evidence anchors.
- [`ROADMAP.md`](ROADMAP.md#L6-L15) — Phase 0 constitution acceptance.
- [`EVALUATION.md`](EVALUATION.md#L2-L37) — definition of done and architecture evaluation.
- [`AGENTS.md`](AGENTS.md#L1-L48) — canonical agent contract and “never rewrite until complete” rule.
