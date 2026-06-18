# Sophia AI Factory Constitution — GOAL

**Repository:** `/Users/macbook/projects/sophia-ai-factory`  
**Product:** Sophia AI Factory — no-code / no-tech RaaS for non-technical CEOs running faceless YouTube + affiliate empires.  
**Primary app:** `apps/sophia-ai-factory/`  
**Production:** `https://sophia.agencyos.network`  
**Date:** 2026-06-18

## North Star

Sophia ships a self-serve AI video and revenue automation platform where customers bring their own keys, pay through supported providers, and receive measurable business output without operator-managed third-party setup.

## Hard Goals

1. **First paying customer** — close at least one paid customer via NOWPayments or PayOS, then prove the full chain: auth → BYOK setup → payment → tier activation → first AI video.
2. **$1M ARR path** — validate pricing, unit economics, and repeatable acquisition before adding new product surface.
3. **100/100 solo-company score** — maintain the honest score ceiling defined by the no-tech doctrine; do not inflate with operator-managed gates.
4. **Protected flows stay unbroken** — Setup Wizard, Telegram Bot, and NOWPayments IPN tier activation are release blockers.
5. **CF-direct deployment** — production deploy is `npm run deploy:full` from `apps/sophia-ai-factory`, followed by SHA verification at `/api/version`.

## Product Positioning

- **Buyer:** non-technical CEO / agency operator.
- **Promise:** AI video production, campaign automation, affiliate discovery, usage metering, and agent orchestration as a managed SaaS experience.
- **Constraint:** customers self-input API keys and third-party integrations; operator does not manage customer RaaS infrastructure.
- **Language:** customer-facing content must remain bilingual Vietnamese + English.

## Non-Goals Until Constitution Is Accepted

- Rewriting the codebase.
- Moving providers without business decision.
- Re-enabling GitHub Actions as the production deploy path.
- Adding operator-managed third-party credentials as a requirement for platform completeness.
- Treating historical docs as current truth when they conflict with `README.md`, `apps/sophia-ai-factory/CLAUDE.md`, or `.claude/rules/*.md`.

## Evidence Anchors

- Product, stack, deploy doctrine: `README.md:1-55`.
- App package and canonical scripts: `apps/sophia-ai-factory/package.json:4-61`.
- CF-direct deploy and SHA verification: `apps/sophia-ai-factory/CLAUDE.md:1-89`.
- Four-layer architecture: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md:1-70`.
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md:1-120`.
- Payment source of truth: `docs/admin-ops/payment-pricing-source-of-truth.md:1-50`.
