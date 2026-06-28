# Debug Report — H3 Verdict + Dead Code Findings

**Date:** 2026-04-25 20:50 PT
**Session:** Continuation of /debug --auto chain
**Production status:** ✅ HTTP 200, CI GREEN (3/3 last runs)

---

## H3: REQUIRE_AGENCY_ID — FALSE POSITIVE

**Audit recommendation:** Set `REQUIRE_AGENCY_ID=true` in CF Workers env.

**Verdict:** ❌ **DO NOT enable.** Current unset state is correct.

### Why
- Live middleware: `src/middleware/tenant-isolation.ts:49` reads this env.
- If `true`, all `/api/*` (except PUBLIC_ROUTES) require `x-raas-agency-id` header OR JWT bearer with `agency_id` claim.
- **Better Auth uses cookie sessions, NOT bearer JWT** — `extractAgencyId()` returns null → 403 on all logged-in user routes (`/api/agents/*`, `/api/billing/*`, `/api/admin/*`, `/api/user/*`, `/api/payments/*`).
- Effect: would break entire authenticated app.

### Action
- Mark H3 as **resolved (false positive)** in audit checklist.
- No code/env change required.

---

## Bonus Finding: ~500 LOC Dead Code

3 files reference `REQUIRE_AGENCY_ID` but are not mounted anywhere:

| File | LOC | Consumer count |
|------|-----|----------------|
| `src/middleware/agency-isolation.ts` | 172 | 0 (only self) |
| `src/middleware/agency-isolation-validators.ts` | 175 | 0 (only `agency-isolation.ts`) |
| `src/lib/raas-gateway-enhanced.ts` | ? | 0 (self) |
| `src/lib/raas-gateway-enhanced-jwt.ts` | ? | 0 (self) |

**Impact**
- Adds bundle bytes shipped to CF Workers
- Confuses future audits (audit thought REQUIRE_AGENCY_ID was active)
- Maintenance burden — same logic exists in live `tenant-isolation.ts` chain

### Recommended Action
**Delete all 4 files.** Requires user approval before commit:
- Bundle size will shrink
- Possible TS errors surfaced (currently masked by `ignoreBuildErrors: true`)
- Re-run vitest after delete

---

## B2: 462 TS Errors (still deferred)

Recommendation unchanged: dedicated tech-debt initiative outside `--auto` scope.

---

## Summary of /debug --auto Chain (this session)

| Item | Status | Commit |
|------|--------|--------|
| B1: hardcoded BASIC tier | ✅ FIXED | 1f4a98af |
| B3: D1 tables missing remote | ✅ FIXED (migration 0016) | — |
| B4: wrangler migrations_dir | ✅ FIXED | 1f4a98af |
| H1: tenant isolation on writes | ✅ FIXED | d7b5ff04 |
| H6: prod referer leak | ✅ FIXED | d7b5ff04 |
| H2: feedback orgId standardize | ✅ FIXED | bcb7604b |
| H4: SSE D1 backoff | ✅ FIXED | bcb7604b |
| H5: system_prompt cap | ✅ FIXED | bcb7604b |
| H3: REQUIRE_AGENCY_ID | ✅ VERIFIED FALSE POSITIVE | (this report) |
| B2: 462 TS errors | ⏸ DEFERRED | — |

**3 commits, 8 fixes, all production-verified GREEN.**

---

## Open Questions

1. Approve deletion of 4 dead-code files (~500 LOC) ?
2. Schedule B2 tech-debt initiative — split into 5–10 PRs?
3. Update `next.config.ts:ignoreBuildErrors` comment (says "circular types", actual issue is 462 plain errors).
