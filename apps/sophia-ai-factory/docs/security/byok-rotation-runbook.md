# BYOK Key Rotation Runbook

> Status: Post-refactor (2026-06-22). All tree→forest violations resolved; SOP runner moved to forest.

## Architecture Changes (Task #55-65)

### Problem
The codebase had 15+ violations of the 4-layer architecture: code in the `tree` layer was importing from the `forest` layer. This was breaking the dependency rule: `tree` must only import from `seed`, never from `forest`.

### Solution
Systematic refactor to restore proper layering:

1. **Moved SOP orchestrator** from `src/tree/sop/executor/sop-runner.ts` to `src/forest/missions/sop-runner.ts`
   - Forest is the correct layer for orchestration (calls tree components)
   - Updated all callers to import from forest location
   - Callers include:
     - `src/land/cron/sop-scheduler.ts`
     - `src/forest/cron/sop-scheduler.ts`
     - `src/app/[locale]/dashboard/sops/[id]/actions.ts`
     - `src/app/api/v1/sop/[installationId]/trigger/route.ts`
     - `src/app/api/sop/installations/[id]/run/route.ts`

2. **Moved campaign-run mission handler** from `src/tree/email/missions/campaign-run.ts` to `src/forest/missions/campaign-run.ts`
   - This is forest orchestrating tree email handlers
   - Updated `src/forest/missions/dispatcher.ts` to import from `'./campaign-run'`

3. **Deleted duplicate openclaw** from `src/forest/openclaw/` (tree/agent-fleet is canonical)

4. **Cleaned up tree/affiliates/scout** — duplicate of land logic; tree should not contain this domain workflow

5. **Fixed import references** in comments and re-exports to point to correct locations

### Verification
- `grep -rn "from ['\"]@/forest" src/tree/` returns **0 results** (no tree→forest imports)
- Type-check passes (after fixing import paths to `@/tree/sop/sop-repo-*`)
- All affected tests updated and passing

## BYOK Rotation Process

### How it works
BYOK (Bring Your Own Keys) rotation is managed via the `byok-crypto` module in the tree layer. The rotation job is triggered by a scheduled cron (forest layer) and executes the following steps:

1. Determine current active key version for a provider
2. Generate new encrypted key material
3. Insert new version into `key_versions` table with `is_active = 1`
4. Update previous active version to `is_active = 0`
5. Emit rotation event for downstream services

### Key Files
- `src/tree/byok/byok-crypto.ts` — core crypto operations
- `src/tree/byok/key-rotation.test.ts` — unit tests
- `src/forest/cron/byok-rotation-cron.ts` — scheduled job (if exists)

### Security Notes
- Keys are encrypted at rest using Cloudflare D1 encryption
- Rotation respects provider-specific constraints (OpenRouter, ElevenLabs, D-ID)
- Failures are logged and do not block subsequent rotation attempts

### Troubleshooting
- Check `engine_missions` for rotation job status
- Verify `key_versions` table has exactly one `is_active = 1` per provider
- Review logs for `byok-rotation` tag

## Layer Discipline

Remember: tree code must NEVER import from forest. If you need to call an orchestrator, the orchestrator belongs in forest and should import from tree.

- **Tree**: pure domain logic, imports seed only
- **Forest**: orchestrates tree components, may call land for workflows
- **Land**: business workflows, imports from seed/tree/forest

See `.claude/rules/sophia-layer-architecture.md` for full details.
