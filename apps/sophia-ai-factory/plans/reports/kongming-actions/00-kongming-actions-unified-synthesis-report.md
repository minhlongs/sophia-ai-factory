# Kongming Actions — Unified Synthesis Report

**Date:** 2026-07-17
**Auditor:** kongming-actions (5-phase audit chain)
**Scope:** Sophia AI Factory — auth, policy, architecture, pipeline, D1 migrations

---

## Executive Summary

Zero critical security findings. Two CI-blocking architecture violations. Three protected-flow gaps that require attention. One deployment-stability issue (Workers-incompatible code). D1 migrations are production-safe but carry maintenance risk.

---

## Prioritized Action Plan

### CRITICAL — Must fix before next deploy / merge

| # | Item | Source Phase | Needs User Decision? | Action |
|---|------|-------------|---------------------|--------|
| C1 | `npm run ci:boundaries` will FAIL — 2 blocking layer violations: `seed→tree` in `platform-config-repo.ts` (line 11, imports `encryptValue`/`decryptValue` from `tree/credentials/encryption`) and `land→forest` in `sop-marketplace/install-handler.ts` (line 26, imports `trackSopInstalled`) | 03-arch-enforcement | No — clear fix path | **Dev action:** Move `encryptValue`/`decryptValue` to `seed/` (crypto is foundational). Invert `trackSopInstalled` to a land-consumed event. |
| C2 | Protected Flow #2 broken: Telegram `/status` and `/results` are NOT implemented. Only `/campaign_list` and `/campaign_del` exist. The protected-flow spec requires all three. | 04-pipeline-verification | No — spec is clear | **Dev action:** Implement `/status` (job status lookup) and `/results` (push final video URL back to Telegram chat). |
| C3 | `arch-lint.sh` referenced by `ci:arch` in `package.json` but does NOT exist on disk. CI will error with "file not found" if invoked standalone. | 03-arch-enforcement | No | **Dev action:** Create stub `arch-lint.sh` or remove `ci:arch` script from package.json until implementation is ready. |

### HIGH — Fix this sprint

| # | Item | Source Phase | Needs User Decision? | Action |
|---|------|-------------|---------------------|--------|
| H1 | `zunef-client.ts` uses `fs.existsSync`/`fs.readFileSync`/`fs.writeFileSync` for local device files. Will fail on Cloudflare Workers (no filesystem). Blocks production feature that uses ZuneF inference. | 01-auth-audit | No — confirmed issue | **Dev action:** Replace `fs` calls with Workers-compatible storage (KV or D1) for device ID + token persistence. |
| H2 | 12 duplicate migration prefixes (e.g., `0004`, `0031`, `0178`). Naming collisions confuse developers; `wrangler d1 migrations create` will collide. No CI guard prevents new duplicates. | 05-d1-migration-risk | Partial — which gap numbers to assign | **Dev action:** Add CI hook that rejects duplicate prefix. Rename historical duplicates to available gap range (e.g., 0035-0099). |
| H3 | `apply-migrations.sh` continues on migration failure (non-fatal). Silent schema divergence possible if bad SQL doesn't error. | 05-d1-migration-risk | No | **Dev action:** Change `continue` to `exit 1` after logging failure. Deploy should abort on migration errors. |
| H4 | No end-to-end integration test for the active BYOK HeyGen pipeline (Setup Wizard → HeyGen API → webhook → R2 → email). Unit test exists for Inngest function only. | 04-pipeline-verification | No | **Dev action:** Add E2E test that mocks HeyGen webhook delivery and verifies R2 storage + email trigger. |
| H5 | `check-layer-imports.ts` (regex-based, more thorough) exists but is NOT wired into `package.json` scripts. The lighter `check-layer-boundaries.sh` is what CI runs. | 03-arch-enforcement | No | **Dev action:** Add `check-layer-imports.ts` to CI pipeline for deeper enforcement. |

### MEDIUM — Next sprint

| # | Item | Source Phase | Needs User Decision? | Action |
|---|------|-------------|---------------------|--------|
| M1 | Operator WAN video pipeline (Fish Speech + WAN 2.1 + CloudConvert) has code at every step but `aiPromptPipelineConfigured()` short-circuits without keys. No evidence these 3 operator env vars are deployed. | 04-pipeline-verification | **Yes** | **User decision:** Is the operator WAN pipeline in scope for production? If yes → provision keys. If no → document as out-of-scope per no-tech doctrine. |
| M2 | 7 deprecated Inngest functions still reference orphaned `video_jobs` table (never applied to prod). New code uses `engine_missions` + `videos`. | 04-pipeline-verification | No | **Dev action:** Remove or archive deprecated functions after confirming no code paths reach them. |
| M3 | 7 files import types from deprecated `supabase-types.ts` shim. D1-backed shims are policy-compliant but create maintenance debt. | 02-policy-violations | No | **Dev action:** Migrate type imports to `@/seed/types/<domain>` aliases, then delete shim. |
| M4 | `0118_baseline.sql` and `0118_baseline_full.sql` are historical snapshots with 120/169 records. Never executed by `apply-migrations.sh`. | 05-d1-migration-risk | No | **Dev action:** Archive baselines out of `migrations/` directory (e.g., to `migrations/archive/`). |

---

## Cross-Phase Risk Heat Map

| Risk | Auth | Policy | Arch | Pipeline | D1 | Aggregate |
|------|------|--------|------|----------|-----|-----------|
| CI break (deploy blocked) | — | — | **HIGH** | — | — | **HIGH** |
| Protected flow broken | — | — | — | **HIGH** | — | **HIGH** |
| Production data risk | — | — | — | — | LOW | LOW |
| Worker deploy failure | **MED** | — | — | — | — | **MED** |
| Developer confusion / tech debt | — | LOW | LOW | LOW | **MED** | **MED** |

---

## Items Requiring User Decision

1. **Operator WAN pipeline scope (M1):** The no-tech doctrine says "operator manages platform only" — but WAN/FishSpeech/CloudConvert keys would be operator-provisioned. Confirm whether this pipeline stays in the product or is explicitly out-of-scope.

2. **Duplicate migration numbering scheme (H2):** The gap range 0035-0099 is available for renaming duplicates. Approximate approach: assign `0035+offset` to each duplicate in order of original creation.

---

## Items a Dev Can Action Directly (no user input needed)

- C1: Move `encryptValue`/`decryptValue` to `seed/`, invert `trackSopInstalled` event
- C2: Implement Telegram `/status` and `/results` commands
- C3: Create `arch-lint.sh` stub or remove `ci:arch` from package.json
- H1: Replace `fs` calls in `zunef-client.ts` with KV/D1 storage
- H2: Add CI prefix collision guard + rename 12 duplicates
- H3: Make `apply-migrations.sh` exit 1 on failure
- H4: Add BYOK HeyGen E2E integration test
- H5: Wire `check-layer-imports.ts` into CI
- M2: Archive deprecated Inngest functions
- M3: Migrate type imports, delete supabase-types shim
- M4: Archive baseline migrations

---

## Unresolved Questions

1. Was `zunef-client.ts` introduced intentionally for Cloudflare Workers deployment, or is it a dev-tool artifact that should be removed from `src/seed/`?
2. The `video_jobs` table was "applied but never used" — are there any D1 queries or webhook handlers we missed that reference it?
3. Does the Telegram `/results` command need its own Inngest event, or should it poll the `videos` table?
