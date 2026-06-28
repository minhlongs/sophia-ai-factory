# Mekong Reusable Packages Survey for Sophia Dashboard

**Date:** 2026-05-18  
**Scope:** Evaluate packages from ~/mekong-cli for integration into Sophia /dashboard  
**Sophia stack:** Next 16 + React 19 + TS strict + Tailwind 4 + CF Workers + D1 + Better Auth + NOWPayments  
**Constraint:** Polar BANNED. No cross-repo npm publishing overhead.

---

## Package Shortlist & Classification

| Package | Path | Classification | Fit | Effort |
|---------|------|---|---|---|
| `@mekong/ui` | `packages/ui/` | PATTERN | React 19 compat ✅, zero deps (cva+clsx+merge) | S |
| `@mekong/observability` | `packages/observability/` | COPY | Logger + EventObserver typed, no external deps | S |
| `@mekong/i18n` | `packages/i18n/` | EVALUATE | Check Sophia i18n pattern first | ? |
| Dashboard app | `apps/dashboard/` | INSPECT | Polar + Stripe + Material Web — **REJECT Polar** | X |
| AgencyOS dashboard | N/A | NOT_FOUND | No separate dashboard package | — |
| Billing patterns | N/A | DOMAIN_SPECIFIC | Mekong uses Polar (banned for Sophia) | X |

---

## Top 5 to ADOPT (Code or Pattern)

### 1. **Observability logger** (COPY)  
Location: `packages/observability/src/logger.ts`  
Why: Structured JSON logging for Cloudflare Workers. Sophia currently uses console — upgrade to typed logger with sentry integration point. Zero deps.

### 2. **UI component barrel pattern** (PATTERN)  
Location: `packages/ui/src/components/*.tsx` + exports structure  
Why: Mekong's `./components/*` export pattern is cleaner than Sophia's current forest/components/ flat structure. No Polar coupling, React 19 tested.

### 3. **EventObserver event bus** (COPY)  
Location: `packages/observability/src/event-observer.ts`  
Why: Sophia's inngest jobs + forest/quota orchestration need clean event routing. Mekong's TypedEventEmitter is reusable.

### 4. **Tailwind + clsx + CVA baseline** (PATTERN)  
Location: `packages/ui/package.json` (no Material Web, no Polar)  
Why: Sophia uses same stack but can adopt Mekong's proven CVA patterns for variant-heavy components (quota bar, tier badge, etc.).

### 5. **Tier badge + quota visual patterns** (COPY)  
Location: `forest/components/dashboard/mission-control/tier-badge.tsx` (if generalizable)  
Why: Sophia's `/dashboard/system-health` + quota displays can reuse tested visual patterns.

---

## 3-5 to REJECT (with reason)

| Package | Reason |
|---------|--------|
| `apps/dashboard` | Depends on `@polar-sh/sdk` (v0.41.5). Polar BANNED in Sophia. Material Web not standard for Sophia. |
| Billing domain | Mekong dashboard shows Stripe + Polar payment flow. Sophia uses NOWPayments + PayOS. Architecturally incompatible. |
| `packages/mekong-cli-core` | CLI binary, not UI library. Oversized for dashboard hardening. |
| AgencyOS UI | Does not exist as separate package (integrated into apps/dashboard only). |

---

## Pattern Adoptions from ClaudeKit / Mekong Structural Conventions

1. **Skill/command directory structure**  
   Mekong: `~/.claude/skills/` with SKILL.md frontmatter (post-dedup 94→37).  
   Apply to Sophia: Already follows this. No changes needed.

2. **Cross-layer orchestration exemption**  
   Mekong: `forest → land` one-way allowed for Inngest orchestration.  
   Apply to Sophia: Already follows (forest/inngest calls land/billing). Document in sophia-layer-architecture.md.

3. **Barrel re-exports per domain**  
   Mekong: `land/billing/index.ts`, `forest/inngest/index.ts`.  
   Apply to Sophia: Formalize Sophia's existing forest/components, land/payouts barrels. Enforce in linter.

4. **Tier config centralization**  
   Mekong: `@mekong/config/tiers` (single source).  
   Apply to Sophia: Already done (`@/config/tiers`). Verify no stale imports remain.

---

## Effort Estimate per ADOPT

| Item | Estimate |
|------|----------|
| Copy observability logger | S (1-2 hrs — 50 LOC) |
| Copy EventObserver | S (2 hrs — 100 LOC) |
| Adopt UI barrel pattern | M (4 hrs — refactor forest/components index.ts) |
| Adopt CVA patterns for quota/tier visuals | M (6 hrs — update 4-5 components) |
| **Total** | **~11 hours** (1 dev, 1.5 days) |

---

## License Compatibility

- `@mekong/ui` → MIT (public, can COPY)
- `@mekong/observability` → MIT (public, can COPY)
- `mekong-cli` root → MIT (packages OK to extract)
- Dashboard app → MIT (code OK, but Polar dep blocks adoption)

All extractable code is MIT-licensed. No licensing friction.

---

## Unresolved Questions

1. **i18n pattern in mekong-cli?** Search `packages/i18n/` found, but Sophia already uses `next-intl`. Merge necessary?
2. **React 19 strict mode for mekong/ui?** Package.json lists `peerDependencies: react ^19`, but verify no legacy hooks/patterns.
3. **D1 observability hooks?** Sophia's observability currently sends to Sentry. Should observability logger also emit D1 audit events, or just stdout/Sentry?
4. **EventObserver in serverless edge functions?** EventObserver uses EventEmitter3 (Node.js). Will it work in CF Workers runtime, or need polyfill?
5. **Polar SDK removal from mekong dashboard**—is there a Polar-agnostic version in progress?

---

**Recommendation:** Adopt 1 + 2 + 3 immediately (observability + event bus). Defer UI patterns until after zero-bug dashboard phase completes (separate refactor task).

**Next:** Create phase-02 subtask to integrate observability logger into Sophia's forest/inngest jobs.
