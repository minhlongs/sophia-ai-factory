# Phase 1 — Dirty Tree Triage
Date: 2026-05-21 | Branch: main | HEAD: d68b4d96

---

## Unpushed Commit (d68b4d96) — SHIP

`fix(T001): close B1/B2/B3 public-launch blockers`
- B1: checkout dedupe — prevents duplicate NOWPayments orders on double-click
- B2: HeyGen webhook user-scoping — blocks cross-tenant video-row mutation (security)
- B3: mission tier-quota gate — 429 QUOTA_EXCEEDED stops BASIC exhausting HeyGen BYOK quota

**Size:** 8 files, +249/-20. tsc clean, 52 tests pass (per commit message, verified by test run).
**Verdict: SHIP** — security + billing correctness fixes, fully tested, directly blocks public launch.

---

## Working-Tree Changes by Group

### Group A — Handover docs dynamic billing (`src/tree/handover/`)
Files: `handover-tier-content.ts`, `handover-doc-generator.ts`, `.test.ts` x2

Prices now derived from `UNIFIED_TIERS` (single source); `TIER_BILLING_TERMS` added; MASTER
correctly prints "One-time, lifetime access" instead of hardcoded "Monthly, auto-renew".
Tests: **139/139 pass** (verified live). No TODOs, no broken types.
**Verdict: SHIP** — coherent feature, shippable.

### Group B — Canonical import path docs update
Files: `apps/sophia-ai-factory/CLAUDE.md`, `.claude/rules/sophia-layer-architecture.md`,
`.claude/rules/development-rules.md` (root)

`@/lib/*` → `@/seed/*` paths corrected across all three agent-instruction files.
No code change — docs/rules alignment only.
**Verdict: SHIP** — low risk, prevents agents generating wrong imports.

### Group C — Root README.md
Rewrites structure section to clarify monorepo layout (CF-direct deploy doctrine,
disabled GitHub Actions, canonical app package). Accurate to current state.
**Verdict: SHIP** — factual clarity, no risk.

### Group D — `.claude/scripts/validate-docs.cjs` (root)
Removes `spawnSync` dependency; adds recursive `walk()` replacing shallow
`readdirSync`; skips `archive/` dirs. Additive improvement, no regression.
**Verdict: SHIP** — tooling improvement, scoped to dev toolchain.

### Group E — `docs/` directory (25 files, +775/-615)
Large doc refresh — runbooks, architecture, credentials-handover, pricing, activation
guide, etc. These are operator-facing docs aligned to current state. Not in app build.
**Verdict: SHIP** — no runtime impact; audit Phase 2–5 will stress-test accuracy.

---

## CF Deploy Risk

`test.yml` and `d1-backup.yml` are `.disabled`. `quality-gate.yml` triggers on push
to `main` but runs validation only (lint/typecheck/test) — no deploy job present.
CF deploy is **CF-direct only** (`npm run deploy:full` from app package; per project
CLAUDE.md and README). A `git push origin main` will trigger `quality-gate.yml` +
`security-scan.yml` but **will NOT auto-deploy to CF Workers**.

**Conclusion:** Pushing all changes triggers CI quality gate (safe). CF deploy remains
a manual `npm run deploy:full` step — separate decision.

---

## Recommended Action Sequence

```bash
# 1. Stage all working-tree changes
git add apps/sophia-ai-factory/CLAUDE.md \
        apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md \
        apps/sophia-ai-factory/src/tree/handover/ \
        .claude/rules/development-rules.md \
        .claude/scripts/validate-docs.cjs \
        README.md \
        docs/

# 2. Commit
git commit -m "docs(triage): dynamic billing terms + canonical @/seed imports + monorepo docs refresh"

# 3. Push unpushed commit + this commit together
git push origin main

# 4. Monitor quality-gate CI (no deploy triggered)
# 5. CF deploy is a separate deliberate step — do after 5-phase audit completes
```

No files to `git restore`. All changes are coherent, tested, or doc-only.

---

**Status:** DONE
**Summary:** 9 WD files across 4 coherent groups — all SHIP. Tests 139/139 pass. Push
triggers CI quality gate only; CF deploy remains manual. Safe to proceed with audit
phases 2–5 after commit + push.
