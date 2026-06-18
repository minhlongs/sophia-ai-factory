# ADR-0008 — Vietnamese and English Are First-Class Product Locales

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CMO + CTO

## Context

Sophia is built for Vietnamese and English customers. The app uses `next-intl` with `vi` and `en`, and client-facing docs must remain bilingual.

## Decision

All customer-facing UI and documentation must support Vietnamese and English. English code/doc strings are acceptable; customer-facing content must be bilingual.

## Consequences

- i18n validation is part of release quality.
- New customer-facing copy must be bilingual.
- Marketing docs and handover SOPs should be simple enough for non-technical CEOs.

## Evidence

- [`README.md`](README.md#L20-L41) — i18n and bilingual positioning.
- [`apps/sophia-ai-factory/src/i18n.ts`](apps/sophia-ai-factory/src/i18n.ts#L1-L66) — locale config and missing-key checks.
- [`docs/development-roadmap.md`](docs/development-roadmap.md#L1-L220) — historical roadmap and bilingual artifacts.
