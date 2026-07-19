# Phase 03 — Port Confirmed Gaps from sophia-proposal → canonical

**Status:** completed | **Completed:** 2026-05-12

## Context Links

- [plan.md](./plan.md)
- Input: `plans/260512-0951-consolidate-proposal-surfaces/reports/audit-sophia-proposal.md` (Phase 02 output, especially the PORT LIST)
- Canonical target: `apps/sophia-ai-factory/src/`

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** 0-4h variable; expected 1-2h
- **Why:** Preserve real value before sophia-proposal deletion. YAGNI applies — port ONLY what audit flagged PORT.

## Key Insights (pre-audit baseline)

The most likely PORT items, based on pre-plan recon:

1. **`/api/proposals/generate`** (166 LOC real) — canonical has 27-line stub. Replace stub.
2. **`/api/proposals/[id]`** (39 LOC GET/PATCH/DELETE) — net new in canonical.
3. **Supporting libs** for #1-2: `lib/ai/claude-proposal-generator`, `lib/ai/quality-check`, `lib/ai/proposal-templates`, `lib/validators/proposal`, `lib/billing/balance-checker`, `lib/raas/resolve-token`, `lib/org` — only port what `/api/proposals/*` actually imports (transitive closure).
4. **`packages/raas-sdk`** — IF Phase 02 confirms external consumers, re-home to top-level `packages/raas-sdk/` workspace OR `apps/sophia-ai-factory/packages/raas-sdk/`.
5. **Possibly defer**: `/api/crm`, `/api/feedback`, `/api/onboarding`, `/api/org` — likely SKIP unless audit shows active client usage.

These are HYPOTHESES — the actual list is driven by Phase 02's audit report. Do not begin Phase 03 until audit is signed off.

## Requirements

### Functional
- Each PORT item from audit lands at its target path in canonical.
- Imports rewritten to canonical conventions:
  - Auth: `import { getCurrentUser } from '@/lib/better-auth-session'` (NOT `@/lib/auth`)
  - Tier: `import { getUserTier } from '@/lib/db/get-user-tier'`
  - DB: `import { createServerClient } from '@/lib/db/client'` (sync)
  - Tier config: `@/config/tiers`
- Zero `:any` types added.
- All new code under 200 LOC per file (split if necessary).
- Each ported API route placed under `src/app/api/...` (canonical does NOT use `[locale]` prefix for API routes — confirm by inspecting existing routes).
- Each ported page (if any) placed under `src/app/[locale]/...` with i18n message keys added to `messages/en.json` / `messages/vi.json` (canonical is bilingual).

### Non-Functional
- `npm run type-check` from `apps/sophia-ai-factory/` returns 0 errors.
- `npm test -- --run` test count ≥ 4078 passing (no regressions).
- `npm run build` succeeds.

## Architecture

### Replacement: `/api/proposals/route.ts` (stub) → real generator
Current canonical stub returns 503. After port:
- `POST /api/proposals/generate` → Anthropic call → quality check → balance debit → record in D1.
- `GET /api/proposals` → list user's proposals.
- `GET /api/proposals/[id]` → fetch one.
- `PATCH /api/proposals/[id]` → update.
- `DELETE /api/proposals/[id]` → soft-delete.

### Coexistence with `proposal-create.ts` mission handler
Canonical's `src/forest/missions/handlers/proposal-create.ts` (95 LOC) is a mission-pipeline entry; `/api/proposals/generate` is a direct HTTP entry. Both can call the same underlying `lib/ai/claude-proposal-generator.ts`. Phase 03 must wire mission handler to call the new shared lib (DRY) rather than duplicating Anthropic logic.

## Related Code Files

### Create (target paths in canonical — confirm via audit before writing)
- `apps/sophia-ai-factory/src/app/api/proposals/generate/route.ts`
- `apps/sophia-ai-factory/src/app/api/proposals/[id]/route.ts`
- `apps/sophia-ai-factory/src/lib/ai/claude-proposal-generator.ts`
- `apps/sophia-ai-factory/src/lib/ai/quality-check.ts`
- `apps/sophia-ai-factory/src/lib/ai/proposal-templates.ts`
- `apps/sophia-ai-factory/src/lib/validators/proposal.ts`
- (optional) `apps/sophia-ai-factory/src/lib/billing/balance-checker.ts` (if not already present under another name)
- (optional) `apps/sophia-ai-factory/src/lib/raas/resolve-token.ts`
- (optional) `apps/sophia-ai-factory/packages/raas-sdk/` (re-homed workspace)

### Modify
- `apps/sophia-ai-factory/src/app/api/proposals/route.ts` — replace stub body, keep file path.
- `apps/sophia-ai-factory/src/forest/missions/handlers/proposal-create.ts` — call new shared generator lib (DRY).
- `apps/sophia-ai-factory/package.json` — add deps if any new (likely none; Anthropic SDK already used by canonical).
- `apps/sophia-ai-factory/messages/en.json` and `vi.json` — only if new user-facing UI is ported (unlikely in this phase).

### Delete
- None in this phase. (sophia-proposal directory removal is Phase 04.)

## Implementation Steps

1. Read audit report PORT LIST. Confirm with user before mutating files (1 paragraph approval message).
2. For each item in PORT LIST, in dependency order (deepest libs first, routes last):
   a. Copy source from `apps/sophia-proposal/<path>` to target canonical path.
   b. Rewrite imports to canonical convention (see Requirements → Functional).
   c. Strip any unused legacy code (e.g., Supabase Auth handlers — canonical is Better Auth).
   d. Add JSDoc header noting "ported from sophia-proposal/<original-path> 2026-05-12".
   e. Run `npm run type-check` after each file. Fix errors before moving on.
3. Replace stub at `src/app/api/proposals/route.ts` with real handler (or split into `route.ts` + `generate/route.ts`).
4. Wire mission handler `proposal-create.ts` to call new shared lib.
5. Run `npm test -- --run`. Fix any regressions. If failure is in a ported lib, debug; if failure is unrelated (e.g., snapshot drift), surface to user.
6. Run `npm run build`. Must exit 0.
7. Commit ports in logical chunks (one commit per area):
   - `feat(proposals): port real generator + libs from sophia-proposal`
   - `feat(raas): re-home raas-sdk package` (if applicable)
8. Do NOT deploy yet — Phase 04 owns the deploy window.

## Todo List

- [x] Read & approve audit PORT LIST with user
- [x] Port libs (deepest first)
- [x] Port `/api/proposals/generate/route.ts`
- [x] Port `/api/proposals/[id]/route.ts`
- [x] Replace canonical proposals stub
- [x] DRY: wire mission handler to shared lib
- [x] (Conditional) Re-home `packages/raas-sdk` — deferred per plan Phase 03
- [x] `npm run type-check` → 0 errors
- [x] `npm test -- --run` → ≥ 4078 passing
- [x] `npm run build` → exit 0
- [x] Commit per logical chunk → a241a68e shipped on main

## Success Criteria

- Every PORT-list item lives in canonical at its target path.
- Zero new `:any` types (`grep -rn ": any" src/lib/ai src/app/api/proposals` returns 0).
- Tests pass (≥ baseline).
- Build passes.
- Mission handler `proposal-create.ts` no longer duplicates Anthropic call logic (DRY check).
- `git diff apps/sophia-proposal/` is EMPTY (we copy, not move, in this phase; deletion is Phase 04).

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Import rewrite misses a banned path | Med | Run `grep -rn "@/lib/auth\b\|@/lib/subscription\|@/lib/tier-gate" src/app/api/proposals src/lib/ai` after each port |
| New code violates canon stack rules | Med | Pre-port checklist: D1 only (no Supabase pgvector); Better Auth (no NextAuth); NOWPayments (no Polar) |
| Anthropic prompt deltas break quality | Low-Med | Keep prompts byte-identical when porting; treat any prompt edits as out-of-scope follow-up |
| Test snapshot drift | Med | Update only snapshots that reflect intentional new endpoints; flag the rest to user |
| Scope creep (porting too much) | High | Default = SKIP. User explicit approval required to PORT items not in audit list |

## Security Considerations

- Audit ported routes for IDOR (org/user scoping on `[id]` operations).
- Confirm balance-checker enforces tier limits per canon `@/config/tiers`.
- Re-homed `packages/raas-sdk` — strip any embedded test API keys.
- Anthropic SDK key must come from Worker env binding (already in canonical's wrangler config), not `.env`.

## Next Steps

- → Phase 04 (delete sophia-proposal) once Phase 03 commits are merged to `main` locally AND tests/build green.
- If PORT LIST is large (>10 items), pause and re-evaluate scope with user — consolidation should not balloon into a feature port.
