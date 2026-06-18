# ADR-0003 — No-Tech / BYOK Product Doctrine

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CEO + CTO

## Context

Sophia is positioned as no-code / no-tech RaaS for non-technical CEOs. Customers must self-input API keys and third-party integrations. Operator-managed third-party credentials must not be required for production completeness.

## Decision

All customer integrations are BYOK and self-configured through Setup Wizard or in-app forms. Operator manages platform code and Cloudflare bindings only.

## Consequences

- Features requiring operator credentials are out of scope unless moved to customer self-service.
- Customer-facing docs must not describe operator setup as part of the product.
- Honest score ceilings must not be inflated by hypothetical operator actions.

## Evidence

- [`apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`](apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md#L1-L120) — no-tech / BYOK doctrine.
- [`README.md`](README.md#L1-L55) — product positioning and non-goals.
