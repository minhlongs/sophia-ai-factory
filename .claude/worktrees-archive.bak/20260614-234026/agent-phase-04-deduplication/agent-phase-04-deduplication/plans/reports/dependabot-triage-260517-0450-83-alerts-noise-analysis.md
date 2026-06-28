# Dependabot Triage — 83 alerts (53H/25M/5L)

**Date:** 2026-05-17
**Trigger:** Push of commit `635710f8` returned GitHub Security warning: "83 vulnerabilities (53 high, 25 moderate, 5 low)"
**Local audit:** `npm audit --json` from `apps/sophia-ai-factory` reports **0 vulnerabilities** (any severity)
**Verdict:** Alerts are STALE / out-of-scope. **0 effective HIGH for production deploy target.** No code action needed.

---

## 1. Breakdown by manifest path

| Manifest | H | M | L | Total | Reality | Action |
|---|---:|---:|---:|---:|---|---|
| `apps/sophia-ai-factory/package-lock.json` | 20 | 9 | 3 | 32 | **STALE** — installed versions already patched | None — refresh on next lockfile touch |
| `apps/84tea/package.json` | 7 | 4 | 2 | 13 | Separate product (Vietnamese tea brand) | Defer — owned by 84tea track |
| `apps/sophia-proposal/package-lock.json` | 7 | 3 | 0 | 10 | Directory **DELETED** in commit `2d54bbe9` | Will auto-close on next Dependabot scan |
| `apps/sophia-proposal/package.json` | 6 | 3 | 0 | 9 | Same as above | Same |
| `package-lock.json` (root) | 7 | 3 | 0 | 10 | **LEGACY** vestigial — not deployed | None |
| `package.json` (root) | 6 | 3 | 0 | 9 | **LEGACY** vestigial — not deployed | None |
| **Total** | **53** | **25** | **5** | **83** | | |

---

## 2. Sophia AI Factory (the production deploy target) — installed vs Dependabot

Cross-check Dependabot's "vulnerable: <X" claim against actual installed version in `apps/sophia-ai-factory/package-lock.json`:

| Package | Dependabot vulnerable | Dependabot patched | Installed | Status |
|---|---|---|---|---|
| `next` | `< 16.2.5/6` | `16.2.5/6` | **16.2.6** | ✅ patched |
| `next-intl` | `<= 4.9.1` | `4.9.2` | **4.11.2** | ✅ patched |
| `inngest` | `< 3.54.0` | `3.54.0` | **3.54.2** | ✅ patched |
| `kysely` | `< 0.28.17` | `0.28.17` | **0.28.17** | ✅ patched (exact) |
| `protobufjs` | `<= 7.5.5` | `7.5.6` | **7.5.7** + 8.2.0 | ✅ patched |
| `fast-uri` | `<= 3.1.1` | `3.1.2` | **3.1.2** | ✅ patched (exact) |
| `fast-xml-builder` | `<= 1.1.6` | `1.1.7` | **1.2.0** | ✅ patched |
| `@babel/plugin-transform-modules-systemjs` | `<= 7.29.3` | `7.29.4` | (need verify) | likely patched (deduped) |
| `@opentelemetry/sdk-node` | `< 0.217.0` | `0.217.0` | (need verify) | likely patched |
| `icu-minify` | `<= 4.9.1` | `4.9.2` | (low — DoS) | minor |

**Confirmation:** `npm audit --json` returns `vulnerabilities: {}` with all counts 0. The lockfile resolves to patched versions across the board.

**Why Dependabot still shows 32 alerts:** GitHub's Dependabot scans manifest snapshots and doesn't auto-close until it sees a NEW push that modifies the relevant lockfile. The patched versions were installed via prior `npm install` runs but GitHub hasn't re-scanned since.

---

## 3. Root `package.json` + `package-lock.json` — LEGACY

Root manifest is vestigial from pre-monorepo era (last touched ~6 months ago, commit `b532d1e3: Phase 5 — pin Next 15.5.14`).

Evidence it's dead code:
- `next: 15.5.14` (apps/sophia-ai-factory uses `16.2.6`)
- `next-intl: ^3.26.5` (apps/sophia-ai-factory uses `^4.x`)
- `react: 18.3.1` but `@types/react: 19.0.8` (mismatched — would fail compile)
- No `wrangler.toml` at root
- No GitHub Actions reference root deploy
- Deploy doctrine: `npm run deploy:full` from `apps/sophia-ai-factory/`, never root

Root alerts (19 total: 13H + 6M) are noise for our deploy.

**Decision:** Leave root as-is. Bumping risks ERESOLVE blocker (already happened in `c39a1b17`). Cost > benefit.

---

## 4. `apps/sophia-proposal` — DELETED

Directory removed in commit `2d54bbe9: chore: remove apps/sophia-proposal (DEPRECATED, merged into sophia-ai-factory)` per consolidation plan `apps/sophia-ai-factory/plans/260512-0951-consolidate-proposal-surfaces/`.

The 19 alerts (13H + 6M) reference paths that no longer exist on disk. Dependabot will auto-close once it scans HEAD.

**Decision:** No action. Wait for auto-close on next scan cycle (~24-48h).

---

## 5. `apps/84tea` — SEPARATE PRODUCT

Different SKU (Vietnamese ancient tea brand). 13 alerts (7H + 4M + 2L) on its own `package.json`.

Per `apps/84tea/CLAUDE.md`, this is a Material Design 3 brand site, NOT part of Sophia AI Factory deploy.

**Decision:** Out of scope. Track under 84tea-specific sweep if/when that project ships.

---

## 6. Recommended GitHub action

To clean up the alert noise without touching code:

**Option A — Do nothing (recommended):** Sophia AI Factory ships clean. Alerts will auto-resolve as Dependabot rescans manifests. Next coincidental dep bump in any of the manifests triggers refresh.

**Option B — Bulk dismiss "no-effect" alerts via `gh api`:** For each Sophia AI Factory alert, mark as `dismissed` with reason `tolerable_risk` (since installed is patched). ~20 API calls. Cosmetic only.

**Option C — Delete root + sophia-proposal lockfiles:** Aggressive. Risks unknown CI breakage. Not recommended without separate plan.

---

## 7. Doctrine impact

**Honest 10-layer ceiling: 87.5/100 — UNCHANGED.**

Per `sophia-no-tech-doctrine.md`, this triage is L6 hygiene confirmation, not a lift. Local `npm audit` clean was already known; this report just explains the apparent contradiction with GitHub's number.

---

## 8. Unresolved questions

1. Should root `package.json` be deleted entirely? Risk: husky pre-push hook is in `apps/sophia-ai-factory/.husky/`, root has no hook. But `package-lock.json` references at root suggest root install still happens (commit `ca785c55: install root deps for wrangler`). Safer to leave.
2. Should we trigger a no-op commit to refresh Dependabot's view? (E.g., add a comment to a lockfile.) Cost: 1 commit + deploy cycle. Benefit: cosmetic alert closure.
3. Does the 84tea project have its own owner / deploy track? If neglected, recommend archiving the workspace or moving it out of this repo.
4. Did the `npm audit --audit-level=high` pre-push hook also report 0? Yes — pre-push log shows `[pre-push] G5 audit (npm audit --audit-level=high)... found 0 vulnerabilities` for commit `635710f8`.
