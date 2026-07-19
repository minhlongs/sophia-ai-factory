# Phase 02 Audit Report — sophia-proposal

**Date:** 2026-05-12 10:25 PT
**Auditor:** Claude (inline, /cook product decision flow)
**Source:** `apps/sophia-proposal/`
**Canonical:** `apps/sophia-ai-factory/src/`
**Mode:** Read-only — no file mutations

---

## 1. Inventory

| Surface | Files | Routes (page.tsx + route.ts) | LOC |
|---|---:|---:|---:|
| sophia-proposal/app | 103 routes | 103 | ~10,459 total |
| sophia-ai-factory/src/app | 460 routes | 460 | (canonical) |

- sophia-proposal uses FLAT `app/(group)/...` (no `[locale]`)
- canonical uses `src/app/[locale]/...` (i18n routing)
- → URL spaces don't overlap directly; functionality may overlap

## 2. Route-by-Route Diff

### 2.1 PORT (confirmed gap)

| Source | LOC | Target | Justification |
|---|---:|---|---|
| `app/api/proposals/generate/route.ts` | 166 | `src/app/api/proposals/route.ts` (replace 27-LOC stub) | Canonical stub returns 501 PROPOSALS_NOT_IMPLEMENTED. UI calls this. Real impl exists only in sophia-proposal. |

### 2.2 SKIP (YAGNI — no callers, no deploy, no canonical UI)

All other routes UNIQUE to sophia-proposal — confirmed missing from canonical via filesystem check:

**API routes (~35):**
- `api/affiliate/{programs,programs/[id],programs/scrape,content,content/[id],content/generate,clicks/track,clicks/stats}/*`
- `api/billing/{checkout,portal,subscription}/*`
- `api/crm/{callback,connect,sync}/*`
- `api/cron/{process-emails,uptime-health-check}/*`
- `api/onboarding/{route,progress,status}/*`
- `api/org/route.ts`
- `api/feedback/route.ts`
- `api/templates/route.ts`
- `api/usage/route.ts`
- `api/health/deep/route.ts`
- `api/raas/keys/{route,[id]}/*`
- `api/referral/{code,earn,stats,track}/*` (canonical has `referral/{apply,generate}` — DIFFERENT)
- `api/v1/{demo,demo-requests,onboard,route,missions/[id]/{cancel,result},org/[orgId]/{api-keys,usage}}/*`
- `api/video/{generate,webhook,[id],proposal/[proposalId]}/*` (canonical handles video via Inngest, not REST routes)
- `api/webhooks/polar/*` (Polar BANNED per CLAUDE.md — explicit reject)
- `api/admin/provision/*`
- `api/analytics/{conversions,metrics}/*` (canonical has richer analytics surface)
- `api/proposals/[id]/route.ts` (39 LOC GET/PATCH/DELETE — depends on Q1 below)
- `api/auth/{login,logout,signup,session}/*` (canonical uses better-auth — DIFFERENT pattern, supersede)

**Page routes (~37):**
- `(auth)/{login,signup,magic-link}/*`
- `(dashboard)/{missions,missions/[id],missions/new,proposals/[id],proposals/new,referral,settings/api-keys,billing,billing/success,billing/upgrade,analytics,health,usage,affiliate,templates}/*`
- `(marketing)/{landing,pricing}/*`
- `admin/*`, `blog/[slug]`, `demo`, `docs/api`, `onboarding`, `pilot`, `health`, `landing`, `magic-link`, `signup`

### 2.3 SUPERSEDED (canonical has equivalent — confirmed exists)

- `api/auth/callback/route.ts` — canonical exists
- `api/v1/missions/*` — canonical has richer surface
- `api/referral/*` — canonical has `apply`, `generate` instead

## 3. Lib Diff

### Lib deps OF the PORT route (`/api/proposals/generate`)

All 8 deps MISSING from canonical (verified):

| sophia-proposal | LOC | Canonical | Status |
|---|---:|---|---|
| `lib/ai/client.ts` | 212 | — | MISSING — port required |
| `lib/ai/quality-check.ts` | 168 | — | MISSING — port required |
| `lib/ai/proposal-templates.ts` | 145 | — | MISSING — port required |
| `lib/validators/proposal.ts` | 62 | — | MISSING — port required |
| `lib/billing/balance-checker.ts` | 127 | — | MISSING — port required (CAUTION: canonical uses NOWPayments + tier-gate; check semantics) |
| `lib/raas/resolve-token.ts` | 14 | — | MISSING — port required |
| `lib/org.ts` | 77 | — | MISSING — port required (CAUTION: canonical uses `getCurrentUser()` from `@/seed/auth/better-auth-session`) |
| `lib/billing/usage-tracker.ts` | 191 | — | MISSING — port required (CAUTION: canonical has `forest/usage-metering/` — likely overlap, prefer canonical) |
| **TOTAL** | **996** | | |

### Adaptation work (NOT drop-in)

Per canonical dev rules (`apps/sophia-ai-factory/CLAUDE.md`):
- **Auth:** replace `createAuthClient + resolveToken + getOrgId` → `getCurrentUser()` from `@/seed/auth/better-auth-session`
- **DB:** replace dual-client pattern → single `createServerClient()` sync (no await)
- **Types:** align with canonical `@/seed/types/`
- **Tier:** canonical uses `@/config/tiers` (BASIC/PREMIUM/ENTERPRISE/MASTER uppercase). sophia-proposal `Subscription` type may differ.
- **Usage tracking:** canonical has `forest/usage-metering/` — `usage-tracker.ts` from sophia-proposal likely redundant, use canonical's
- **DRY (per user Q3 answer):** extract `generateProposal()` core to `seed/ai/proposal-generator.ts` so `proposal-create.ts` mission handler + `/api/proposals` route share lib

**Realistic Phase 3 ETA: 4-6h** (not 0-4h as planned) due to adaptation work.

## 4. Deploy / Infra Sanity

| Check | Result |
|---|---|
| `curl https://sophia-proposal.workers.dev` | ❌ no response (not deployed) |
| `curl https://sophia-proposal.agencyos.network` | ❌ no response (DNS not pointed) |
| Scripts/CI refs to sophia-proposal | ✅ 0 hits in `.github/`, `scripts/`, `apps/sophia-ai-factory/scripts/` |
| Root wrangler.jsonc | ✅ `name = "sophia-ai-factory"`, `main = apps/sophia-ai-factory/.open-next/worker.js` — canonical |
| sophia-proposal/wrangler.toml | ❌ ORPHAN — `name = "sophia-proposal"`, never invoked recently |
| sophia-proposal package.json `deploy:cloudflare` script | ❌ Never invoked (not in any cron, GH Actions disabled) |

**Verdict:** sophia-proposal is orphan code, NOT deployed anywhere. Deletion is safe wrt traffic.

## 5. External Consumers

### packages/raas-sdk (`@sophia/raas-sdk` v2.0.0)

| Check | Result |
|---|---|
| `npm view @sophia/raas-sdk` | ❌ 404 — NOT published to npm |
| Internal consumers in `apps/sophia-ai-factory/src` | ✅ 0 imports of `@sophia/raas-sdk` |
| Internal consumers in `docs/`, `scripts/` | ✅ 0 references |
| Has `"private": true` | ❌ No (potentially intended for publish but never did) |
| Has `"publishConfig"` | ❌ No |

**Verdict:** raas-sdk is orphan workspace. ZERO external/internal consumers. SKIP — delete with sophia-proposal in Phase 4.

### Docs / external links to sophia-proposal

- ✅ 0 references in `docs/`, `apps/sophia-ai-factory/docs/`, `README.md`
- ✅ Only own plan files reference it (audit trail)

## 6. Migration Files

| sophia-proposal | canonical | Status |
|---|---|---|
| `0005-mission-steps.sql` | `0005-signals-events.sql` | DIFFERENT — never co-applied |
| `0006-schema-alignment.sql` | `0006-users-local-mode.sql` | DIFFERENT |
| `0007-leads-table.sql` | `0007-workflows.sql` | DIFFERENT |
| `0008-blog-posts.sql` | `0008-llm-cache.sql` | DIFFERENT |
| `0009-blog-posts-seo.sql` | `0009-llm-cache-org-scoping.sql` | DIFFERENT |
| `0010-health-checks.sql` | `0010-llm-cache-semantic.sql` | DIFFERENT |

**Canonical migrations applied to shared D1:** 110 total.
**sophia-proposal migrations:** likely NEVER applied to shared D1 (would have conflicted with canonical 0005-0010 numbering).

**Open question for user (Q4 below):** Should we verify D1 schema does NOT have `leads`, `blog_posts`, `health_checks` tables (from sophia-proposal era)? Or just delete migrations files without applying — safe per "different file, same number = canonical wins" rule. **Recommendation: drop without applying.** Verify D1 only if Phase 4 deploy breaks.

## 7. Final PORT LIST

### Required ports (Phase 3 scope)

```
[1] FROM: apps/sophia-proposal/app/api/proposals/generate/route.ts (166 LOC)
    TO:   apps/sophia-ai-factory/src/app/api/proposals/route.ts (REPLACE 27-LOC stub)
    ADAPT: auth pattern, DB client, types

[2] FROM: apps/sophia-proposal/lib/ai/client.ts (212 LOC)
    TO:   apps/sophia-ai-factory/src/seed/ai/proposal-generator.ts (per Q3 DRY)
    ADAPT: extract core generateProposal() for shared use

[3] FROM: apps/sophia-proposal/lib/ai/quality-check.ts (168 LOC)
    TO:   apps/sophia-ai-factory/src/seed/ai/proposal-quality-check.ts

[4] FROM: apps/sophia-proposal/lib/ai/proposal-templates.ts (145 LOC)
    TO:   apps/sophia-ai-factory/src/seed/ai/proposal-templates.ts

[5] FROM: apps/sophia-proposal/lib/validators/proposal.ts (62 LOC)
    TO:   apps/sophia-ai-factory/src/seed/validators/proposal.ts

[6] FROM: apps/sophia-proposal/lib/billing/balance-checker.ts (127 LOC)
    TO:   apps/sophia-ai-factory/src/land/billing/proposal-balance-checker.ts
    ADAPT: integrate with canonical NOWPayments tier-gate (MAY BE REDUNDANT — review first)

[7] FROM: apps/sophia-proposal/lib/raas/resolve-token.ts (14 LOC)
    TO:   apps/sophia-ai-factory/src/seed/auth/resolve-raas-token.ts
    ADAPT: check if canonical already has equivalent in @/seed/auth/

[8] SKIP: lib/org.ts (77 LOC) — canonical uses `getCurrentUser()` instead
[9] SKIP: lib/billing/usage-tracker.ts (191 LOC) — canonical has `forest/usage-metering/`
```

**Net port scope: ~700 LOC** (1162 - 268 SKIP) with adaptation.

### Refactor pattern (Q3 DRY answer)

Per user's Q3 = "Share lib (DRY) — 1 source of truth":

```
seed/ai/proposal-generator.ts ← shared core (generateProposal)
    ↑
    ├── app/api/proposals/route.ts  (HTTP surface)
    └── forest/missions/handlers/proposal-create.ts  (mission surface — already exists, refactor to call shared lib)
```

---

## Open Questions (Before Phase 3)

**Q1 (BLOCKING):** Does the user actually want proposal generation feature ACTIVE in canonical? Current state:
- UI exists at `/dashboard/proposals` (calls `/api/proposals`)
- API stub returns 501 PROPOSALS_NOT_IMPLEMENTED
- Feature would compete for engineering time vs FREE100 distribution prep (founder-blocked)
- **Option A:** Port 700 LOC, activate proposal feature → 4-6h work
- **Option B:** Keep stub as stub, delete UI page + form components instead → 30 min, YAGNI-aligned
- **Recommendation:** Option B unless founder confirms FREE100 partners need proposal generation

**Q2:** Should `api/proposals/[id]/route.ts` (39 LOC GET/PATCH/DELETE) also port? Depends on Q1 — if proposal feature stays, may need CRUD ops.

**Q3 (answered):** DRY via `seed/ai/proposal-generator.ts` shared lib ← USER ANSWERED

**Q4 (optional):** Verify D1 schema state — does `sophia-raas-db` have stale tables from sophia-proposal era (`leads`, `blog_posts`, `health_checks`)?
- **Recommendation:** Skip pre-emptive check. If Phase 4 deploy breaks, then investigate. Saves time.

---

## Verification Snapshot

```
git status: clean (no mutations from this audit)
Read-only mode: ✅
Time spent: ~25 min (under 2h budget)
sophia-backend status: DELETED (Phase 1, commit 0f61a7f5 local)
Test baseline: 4078/4110 (preserved)
```

---

## Next Steps

**Decision needed from user:**
- **Q1 answer** → determines whether Phase 3 ports 700 LOC or deletes UI

**If Q1 = Option B (delete UI, skip port):**
- Phase 3 scope = delete `/dashboard/proposals/page.tsx`, related components, stub route, sidebar nav link, mission handlers → ~30 min
- Phase 4 = delete sophia-proposal directory → unchanged
- Phase 5 = docs sync → unchanged
- Total saved: ~5h vs porting

**If Q1 = Option A (port proposal feature):**
- Phase 3 scope = 700 LOC port + adapt + test (~4-6h)
- Phase 4-5 unchanged
