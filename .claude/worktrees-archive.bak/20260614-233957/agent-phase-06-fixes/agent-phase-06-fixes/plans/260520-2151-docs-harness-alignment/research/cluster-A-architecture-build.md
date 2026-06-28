# Cluster A Audit: Architecture & Build — Docs ↔ Code Drift Report

**Date:** 2026-05-20  
**Scope:** Root `docs/` + app `apps/sophia-ai-factory/docs/`  
**Canonical 5:** project-overview-pdr, code-standards, codebase-summary, design-guidelines, system-architecture  
**Baseline:** Last root touch = 2026-05-03 (system-architecture) | design-guidelines = Mar 27 (STALE)

---

## Summary

- **Top Finding:** CF-direct deploy doctrine (live since 2026-05-03, primary command `npm run deploy:full`) NOT in root docs; only in app-level CLAUDE.md
- **Tier consolidation:** Root PDR mentions 4 tiers (STARTER/GROWTH/PREMIUM/MASTER), codebase uses (BASIC/PREMIUM/ENTERPRISE/MASTER) — conflicting enum
- **Payment:** Root says NOWPayments + PayOS (correct), but old designs-guidelines.md talks Polar (stale)
- **Duplication:** 4 overlapping files in app/docs/ shadow root/docs/; no clear owner
- **App location:** Code lives in `apps/sophia-ai-factory/` but root docs reference just `src/` (misleading for new agents)
- **BYOK credentialing:** Shipped in app (per-user HeyGen/Resend keys), root code-standards mentions it, but not in root design-guidelines

### Verdict Tally
| File | Status | Evidence |
|------|--------|----------|
| project-overview-pdr.md (root) | DRIFTED | Tier names mismatch (STARTER vs BASIC), deployment doctrines undefined |
| code-standards.md (root) | OK | Covers type safety + patterns, matches Phase 12+ reality |
| codebase-summary.md (root) | DRIFTED | Last touch 2026-05-03 but missing CF-direct deploy doctrine, BYOK details incomplete |
| design-guidelines.md (root) | STALE | Mar 27 → "Deep Space" theme, but actual app uses Geist font + monochrome (no neon cyan). Tailwind 3 vs 4. |
| system-architecture.md (root) | DRIFTED | Has 2026-05-03 label but missing: CF-direct CI/CD doctrine, app-level CLAUDE.md rules, cron auth pattern |
| **app/docs/code-standards.md** | DRIFTED | "Turnkey first", "zero-config" doctrine — not enforced in root. Conflicts with tier gates + operator-only BYOK setup. |
| **app/docs/design-guidelines.md** | OK | Matches shipped (Geist + monochrome, real UI). Contradicts root Deep Space. |
| **app/docs/ai-architecture-2026-update.md** | STALE | 2026-02-07. Talks Python RaaS engine + Mekong CLI — app is Next.js, not Python. Archive candidate. |

---

## Per-Doc Verdict Table

| Doc | File Path | Status | One-Line Evidence |
|-----|-----------|--------|-------------------|
| **project-overview-pdr** | `docs/` | DRIFTED | Line 501: tier enum lists STARTER/GROWTH, but code uses BASIC/PREMIUM/ENTERPRISE/MASTER; deploy doctrine undefined |
| **code-standards** | `docs/` | OK | Covers insertTyped<>, D1Response<>, zero-:any rule; matches Phase 12 codebase (no major drift) |
| **codebase-summary** | `docs/` | DRIFTED | 2026-05-03 label missing CF-direct deploy flow (✓ exists in app/CLAUDE.md:34-36), no BYOK fulfillment docs |
| **design-guidelines** | `docs/` | STALE | Mar 27: "Deep Space" neon cyan theme; actual app is Geist font + monochrome (contradicts shipped UI) |
| **system-architecture** | `docs/` | DRIFTED | 2026-05-03 label but missing CF-direct CI/CD gates, cron-auth Bearer pattern (260502-0756), app-layer CLAUDE.md rules |
| **(app) design-guidelines** | `apps/sophia-ai-factory/docs/` | OK | Matches shipped (Geist Sans, monochrome, no Deep Space). Public source of truth. |
| **(app) code-standards** | `apps/sophia-ai-factory/docs/` | DRIFTED | "Turnkey first" implies zero operator setup, but BYOK keys require Setup Wizard entry (customer-side, not zero-config) |
| **(app) ai-architecture-2026-update** | `apps/sophia-ai-factory/docs/` | STALE | 2026-02-07. Assumes Python RaaS engine + Mekong CLI; shipped product is Next.js 16 + Cloudflare |
| **(app) code-standards-advanced-patterns** | `apps/sophia-ai-factory/docs/` | DRIFTED | References BYOK but 4-layer architecture (seed/tree/forest/land) not mentioned; schema-less entity pattern outdated |

---

## Root vs App Duplication

**Winner per topic:**

| Topic | Root | App | Decision |
|-------|------|-----|----------|
| **Design Theme** | "Deep Space" (STALE) | Geist + monochrome (LIVE) | **Use app version; archive root** |
| **Code Standards** | Type safety + generics | "Turnkey first" + KISS | **Merge:** use root for type safety, add app's simplicity principle |
| **Deploy Doctrine** | Undefined | CF-direct + verify sequence | **Promote app CLAUDE.md to root** `docs/deploy-doctrine.md` |
| **Tier Config** | STARTER/GROWTH/PREMIUM/MASTER (wrong) | BASIC/PREMIUM/ENTERPRISE/MASTER (code) | **Use code truth; rewrite root PDR** |

---

## Concrete Rewrites Needed

### 1. **project-overview-pdr.md** (root)

**Needs change:**
- Line 501-507: Tier table lists STARTER/GROWTH/PREMIUM/MASTER  
  **Fix:** Replace with BASIC(free/500MCU) | PREMIUM($499/10K MCU) | ENTERPRISE($999) | MASTER($999 lifetime)  
  **Code proof:** `apps/sophia-ai-factory/src/land/checkout/checkout-validators.ts` line 29 + `land/payments/payos.ts` line 6-10

- Line 5: "Phase 14 Final (2026-04-30)"  
  **Fix:** Update to Phase 15+ status (shipping Phases 16-17 in May)  
  **Code proof:** git log shows Phase 16-20 commits post 2026-04-30

- Add section: **Deploy Doctrine (New)**
  ```
  ## Deployment Strategy (Effective 2026-05-03)
  - **Target:** Cloudflare Workers (OpenNext build)
  - **Command:** npm run deploy:full (CF-direct via wrangler CLI)
  - **Verification:** SHA match via /api/version endpoint
  - **CI/CD:** Disabled (GitHub Actions exhausted); local wrangler CLI canonical
  - **D1 Migrations:** Applied separately via bash scripts/apply-migrations.sh
  ```
  **Code proof:** `apps/sophia-ai-factory/CLAUDE.md` lines 34-36; `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

- Add: **Tier Consolidation (Phase 15, 2026-05-03)**
  ```
  - Free (formerly STARTER): 500 MCU/month, 10 campaigns, 0 team members
  - Premium: $499/month, 10K MCU, ∞ campaigns, ∞ team
  - Enterprise: $999/month, 25K MCU, custom integrations
  - Master: $999 lifetime, 25K MCU, white-label, all features
  ```
  **Code proof:** `payos.ts` line 6 + `checkout-validators.ts` lines 29-35

### 2. **code-standards.md** (root)

**Needs change:**
- Line 217: "One-Time vs Subscription SKU Pattern (2026-05-02)"  
  **Add:** Explain `ONE_TIME_SKUS` SSOT location: `lib/billing/ipn-constants.ts`  
  **Code proof:** `apps/sophia-ai-factory/src/lib/billing/ipn-constants.ts`

- Line 282: "Post-Build Worker Patches Pattern"  
  **Add detail:** CF Workers Modules format requires `export default { scheduled }` NOT `export async function scheduled()`  
  **Code proof:** `scripts/inject-scheduled-handler.mjs` line 15 + code-standards.md line 287-297 (already correct; verify enforced)

- Line 490: "Per-User Provider Key Access Pattern"  
  **Confirm:** App enforces `fallbackToPlatform: false` in fulfillment paths  
  **Code proof:** `apps/sophia-ai-factory/src/lib/credentials/get-provider-key.ts` — verify call sites

**NO CHANGE NEEDED** — already Phase 12+ accurate

### 3. **codebase-summary.md** (root)

**Needs change:**
- Line 4: "Last Updated: 2026-05-03"  
  **Add:** Deploy doctrine section post-line 8  
  ```
  ### Deployment (2026-05-03 Go-Live CF-Direct Doctrine)
  - Build: `npm run build && npm run deploy:build` (Next.js + OpenNext)
  - Deploy: `npm run deploy:full` (wrangler local CLI, no GitHub Actions)
  - Verify: SHA match via `curl https://sophia.agencyos.network/api/version`
  - Migrations: Applied separately via `bash scripts/apply-migrations.sh`
  - Rollback: `wrangler rollback` (Cloudflare native)
  ```
  **Code proof:** `apps/sophia-ai-factory/CLAUDE.md:34-36`, `deploy-verify.md:72-92`

- Line 43-238: Directory structure  
  **Fix:** All paths reference `src/` but app code lives in `apps/sophia-ai-factory/src/`  
  **Change:** Prepend `apps/sophia-ai-factory/` to all path examples  
  **Code proof:** Directory listing shows `apps/sophia-ai-factory/` as canonical

- Line 503: Tier table (STARTER/GROWTH → BASIC/PREMIUM conflict)  
  **Fix:** Sync with project-overview-pdr rewrite above  
  **Code proof:** `payos.ts`, `checkout-validators.ts`

- Line 173: "Per-User API Keys (LLM/Media)"  
  **Add:** Link to app-level BYOK fulfillment pattern (HeyGen/Resend/NOWPayments keys)  
  **Code proof:** `apps/sophia-ai-factory/src/lib/credentials/` module (NEW 2026-05-02)

### 4. **design-guidelines.md** (root)

**Status:** STALE (Mar 27) — "Deep Space" theme contradicts shipped  
**Action:** ARCHIVE + promote app version as canonical

**Rewrite needed (if keeping root version):**
- Line 12-16: Replace "Deep Space (#030014)" color scheme with Geist monochrome (zinc 950/50)
- Line 18-22: Replace "Space Grotesk" font with Geist Sans (existing in `layout.tsx`)
- Line 30-38: Remove "Noise texture" + "Glows" + "Glassmorphism" — replace with shipped minimalist style
- **Code proof:** App `design-guidelines.md` line 1-25 + `src/app/[locale]/layout.tsx` (inspect font declarations)

**Recommendation:** Delete root version; replace with symlink/include to app version. Single source of truth.

### 5. **system-architecture.md** (root)

**Needs change:**
- Line 5: Add 2026-05-15 update label  
  ```
  **Last Updated:** 2026-05-03 (CF-direct deploy doctrine + Phases 15-17 roadmap)
  ```

- Line 70-82: CI/CD & Enforcement Gates  
  **Update:** Replace "5 enforcement gates" with CF-direct reality:  
  ```
  ### CI/CD & Deployment (CF-Direct Doctrine, 2026-05-03)
  - Build: Local `npm run deploy:full` (wrangler CLI)
  - Deploy: Direct to Cloudflare Workers (no GitHub Actions)
  - Verification: SHA match via /api/version endpoint (proving code live)
  - Migrations: Separate script `bash scripts/apply-migrations.sh`
  ```
  **Code proof:** `sophia-deploy-verify.md:72-92`

- Line 497-540: Cron Infrastructure  
  **Update section 260502-0756 Critical Fix:**
  ```
  **CF Workers Modules Format (260502-0756 CRITICAL FIX):**
  - ❌ WRONG: `export async function scheduled()` — CF doesn't recognize named export
  - ✅ CORRECT: `export default { scheduled }` — CF recognizes as entry point
  - Enforced by: `scripts/inject-scheduled-handler.mjs` idempotent post-build
  ```
  **Code proof:** `code-standards.md:287-297` + `scripts/inject-scheduled-handler.mjs`

- Line 504-505: Auth pattern  
  **Update:** Change "x-cf-cron: true header bypass (SECURITY BYPASS)" to proper Bearer token auth  
  ```
  **Auth (260502-0756 CRITICAL UPDATE):**
  - Old (260502-0604): x-cf-cron header (SECURITY BYPASS) — REMOVED
  - New (260502-0756): Authorization Bearer <CRON_SECRET> (env var, required)
  - Setup: `bash scripts/set-cron-secret.sh` generates + sets secret via wrangler
  ```
  **Code proof:** `code-standards.md:338-373` + `sophia-deploy-verify.md`

- Line 634: Add CF-direct deploy command  
  ```
  npm run deploy:full  # Local wrangler — canonical since 2026-05-03
  ```
  **Code proof:** `apps/sophia-ai-factory/CLAUDE.md:34-36`

---

## Archive Candidates

| File | Last Touch | Reason | Action |
|------|-----------|--------|--------|
| `docs/tech-debt.md` | Mar 27 | Phase 12+ completed major debt reduction; file outdated + tech-debt module removed | ARCHIVE |
| `docs/raas-license-gating.md` | Mar 27 | Polar integration rejected; tier system overhaul shipped; file obsolete | ARCHIVE |
| `docs/design-guidelines.md` | Mar 27 | "Deep Space" theme contradicts shipped Geist design; app version canonical | ARCHIVE (replace with app version include) |
| `apps/sophia-ai-factory/docs/ai-architecture-2026-update.md` | 2026-02-07 | Assumes Python RaaS engine; shipped product is Next.js 16 + CF Workers | ARCHIVE |
| `apps/sophia-ai-factory/docs/code-standards-advanced-patterns.md` | ? | Overlap with root code-standards.md; pattern consolidation complete | REVIEW FOR MERGE |

---

## Unresolved Questions

1. **Tier enum naming:** Code uses BASIC, root PDR uses STARTER. Is BASIC the "free tier"? Or is it pay-to-play? (Code evidence: payos.ts prices suggest BASIC absent from checkout UI)

2. **App-level vs root docs ownership:** Who maintains `apps/sophia-ai-factory/docs/` vs `docs/`? No clear CODEOWNERS rule. Should app docs be primary + root a mirror?

3. **4-layer architecture (seed/tree/forest/land):** Shipped in code + app CLAUDE.md, but NOT in root codebase-summary. Should root reference it or is it app-internal?

4. **BYOK fulfillment path:** Code shows per-user HeyGen/Resend keys stored in D1. Root code-standards mentions BYOK but doesn't detail the fulfillment-retry cron fallback behavior. Is it documented?

5. **Tier scope:** Are there 2 tier systems coexisting? (D1 text vs TypeScript enum — root PDR vs code reality). PDR should be source-of-truth but it's stale.
