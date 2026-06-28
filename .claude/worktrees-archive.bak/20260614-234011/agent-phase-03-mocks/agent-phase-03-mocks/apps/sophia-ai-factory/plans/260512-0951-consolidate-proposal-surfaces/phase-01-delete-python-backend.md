# Phase 01 — Delete `apps/sophia-backend/` (Python)

**Status:** completed | **Completed:** 2026-05-12

## Context Links

- [plan.md](./plan.md)
- Source: `apps/sophia-backend/` (1003 LOC Python, FastAPI + OpenAI + Supabase pgvector)
- Self-declared status: `apps/sophia-backend/MIGRATION_NOTE.md` → "LEGACY REFERENCE — NOT INTEGRATED"
- Backup tarball: `~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz` (sha256 `92bef5520d1d6d366efd480015dce505f0be5d863db461c4d2a04d6e87e5fb7b`)

## Overview

- **Priority:** P2 (lowest risk start)
- **Status:** completed
- **Effort:** ~10 min
- **Why first:** Zero callers, zero deploy config, stack mismatch (Python vs canonical Next.js/D1). Removing it shrinks repo cognitive surface before the riskier sophia-proposal audit.

## Key Insights

- Stack mismatch with canon (Polar.sh REJECTED; product uses NOWPayments; Python service has no Cloudflare Worker deploy story).
- ZERO references from canonical app — pre-verified during planning:
  - `grep -r "localhost:8000\|sophia-backend\|fastapi" apps/sophia-ai-factory/src` → 0 matches.
- No `Dockerfile`, `fly.toml`, `Procfile`, or `render.yaml` exists for this service.
- Tarball backup + git history are sufficient rollback paths.

## Requirements

### Functional
- Remove all 7 Python source files + `requirements.txt` + `README.md` + `MIGRATION_NOTE.md` under `apps/sophia-backend/`.
- Leave no broken references in build/test/deploy scripts.

### Non-Functional
- Build (`npm run build` from `apps/sophia-ai-factory/`) still passes.
- Tests (`npm test`) still 4078/4110.
- Production unchanged (this path is not deployed).

## Architecture

No architecture change — surface was never wired in.

## Related Code Files

### Delete
- `apps/sophia-backend/__init__.py`
- `apps/sophia-backend/ai_client.py`
- `apps/sophia-backend/brand_voice.py`
- `apps/sophia-backend/main.py`
- `apps/sophia-backend/proposal_generator.py`
- `apps/sophia-backend/requirements.txt`
- `apps/sophia-backend/README.md`
- `apps/sophia-backend/MIGRATION_NOTE.md`
- `apps/sophia-backend/` (directory itself)

### Modify
- None expected. If any orphan references surface post-delete, fix in same commit.

## Implementation Steps

1. From repo root, re-verify zero callers (fail-fast guard):
   ```bash
   cd /Users/macbook/projects/sophia-ai-factory
   grep -rn "sophia-backend\|localhost:8000\|fastapi\|proposal_generator" \
     apps/sophia-ai-factory/src \
     --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json"
   # Expected: 0 lines.
   ```
2. Also grep build/deploy scripts at repo root:
   ```bash
   grep -rn "sophia-backend" scripts/ .github/ wrangler.jsonc package.json 2>/dev/null
   # Expected: 0 lines.
   ```
3. Confirm tarball backup exists (one-line check, do NOT re-create):
   ```bash
   ls -la ~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz
   ```
4. Delete the directory:
   ```bash
   git rm -rf apps/sophia-backend/
   ```
5. From `apps/sophia-ai-factory/`, run build + tests:
   ```bash
   cd apps/sophia-ai-factory
   npm run build
   npm test -- --run
   ```
6. Commit (small, focused):
   ```bash
   git commit -m "chore: remove apps/sophia-backend (Python FastAPI, never integrated)

   - 1003 LOC Python, stack mismatch with canonical Next.js/D1
   - Zero callers in apps/sophia-ai-factory/src
   - Backup: ~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz
   - Self-declared LEGACY in MIGRATION_NOTE.md"
   ```
7. DO NOT push or deploy in this phase — nothing changed in production code paths. Hold the commit locally until Phase 04 deploy window (or batch-push at end of Phase 02 if user wants visible repo cleanup sooner).

## Todo List

- [x] Re-verify zero callers (grep in src/)
- [x] Re-verify no build/script references
- [x] Confirm tarball backup present
- [x] `git rm -rf apps/sophia-backend/`
- [x] `npm run build` → 0 errors
- [x] `npm test -- --run` → 4078/4110 unchanged
- [x] Commit with conventional message
- [x] Commit 0f61a7f5 shipped on main

## Success Criteria

- `ls apps/sophia-backend` → "no such file or directory".
- Build exits 0.
- Test count and pass-rate unchanged.
- `git status` shows ONLY deletions inside `apps/sophia-backend/` (no collateral damage).

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hidden import from canonical | Very Low | Pre-verified grep = 0; re-grep at step 1 |
| Tarball missing | Low | Step 3 checks existence; if missing, halt and notify user |
| CI references | Very Low | Step 2 covers scripts and workflows |

## Security Considerations

- Python file `ai_client.py` may contain leftover OpenAI key references — confirm `git log -p apps/sophia-backend/` for secret history before delete (grep for `sk-`, `api_key=`). If any plaintext key found in history, raise it as a separate user task (key rotation), not blocking this phase.

## Next Steps

- → Phase 02 (audit sophia-proposal). Can run immediately after this phase completes; no deploy window needed.
