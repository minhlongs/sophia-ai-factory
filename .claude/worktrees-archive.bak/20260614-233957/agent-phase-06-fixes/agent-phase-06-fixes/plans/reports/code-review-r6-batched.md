# Sophia R6 Batched Code Review

**Date:** 2026-04-18
**Scope:** 4 R6 follow-up commits on main (d5556a4, 2ffc3a2, 2af6f6b, 6f82e7c)
**Tests:** 1285 → 1294 (+9 net, matches commit claims)
**Build:** 0 errors reported by each commit message

---

## Commit 1 — `d5556a4` Phase 4F.3 tier-case normalization — **9.7/10 SHIP**

**Findings:**
1. `DB_TIER_MAPPING` keys verified (`premium/pro → PREMIUM`, `free → BASIC`, `enterprise`, `master`) — tests align perfectly with real mapping.
2. Normalizer uses `.toLowerCase()` before lookup → robust to mixed-case legacy rows.
3. Both call sites (`getUserTier` + `getTenantContext`) converge on single helper — DRY.

**Nil:** No critical / high. Tier-enum safety bug that silently routed PREMIUM users to BASIC paths now closed. Auto-approve.

---

## Commit 2 — `2ffc3a2` Phase 4N-POLISH SSE parser polish — **9.6/10 SHIP**

**Findings:**
1. `try { ... } finally { reader.cancel().catch(() => {}) }` correctly releases reader on break/throw/return. Empty `.catch` is idiomatic for post-cancel — no unhandled rejection.
2. `parse_error` variant added to discriminated union → TS-safe consumer switch, `rawPayload.slice(0, 200)` caps log bloat. Reshape of "skips malformed JSON" test is semantically correct.
3. **L-1 (informational):** 200-char payload cap may truncate before the actual parse-offending token for large malformed blobs. Acceptable for diagnostic telemetry; consumers wanting full raw should request via separate debug flag.

**Nil critical / high.** Auto-approve.

---

## Commit 3 — `2af6f6b` Phase 4E.2-TUNING index widen + PII gate — **9.7/10 SHIP**

**Findings:**
1. Migration 0012 correct: `DROP INDEX IF EXISTS` + `CREATE INDEX IF NOT EXISTS` — idempotent. New composite key `(org_id, embedding_model, provider, model, created_at DESC)` exactly matches 4 `.eq()` filters in `semanticLookup` + `ORDER BY created_at DESC` — index covers both filter + sort prefix.
2. PII gate uses strict `process.env.LLM_CACHE_STORE_PROMPT_TEXT === '1'` → no accidental truthy strings enable it. Default-off is the safe GDPR-friendly posture. Embedding vector still stored (PII-safer — you can't reverse-engineer the prompt from a 768-d vector without an inversion model).
3. 3 tests cover every semantic × prompt-text env combination (off/off, on/off, on/on). `delete` on env between tests + `globalThis.AI` cleanup avoids cross-test pollution.

**Nil critical / high.** Auto-approve.

---

## Commit 4 — `6f82e7c` Phase 4G-WIRE BYOK into workflow-stepper — **9.5/10 SHIP**

**Findings:**
1. `resolveOrgOwnerUserId` null-safety complete: missing orgId short-circuits before `db.prepare` (test asserts `not.toHaveBeenCalled()`), D1 throw caught, missing-member returns null. SQL shape test asserts `ORDER BY created_at ASC` + `LIMIT 1` regex — will catch accidental query rewrites.
2. `org_members` schema confirmed in migration 0001 has `created_at TEXT DEFAULT (datetime('now'))` — query is schema-valid.
3. Wiring preserves old behavior when BYOK off: `resolveUserApiKey` returns `envFallback` unchanged (1:1 with pre-4G-WIRE `process.env.ANTHROPIC_API_KEY`). Anthropic degrade-to-mock path intact (`if (!anthropicKey) { llmDegraded = true; ... }`).
4. **L-1 (informational, pre-existing):** OpenRouter branch sends `Authorization: Bearer ` when both BYOK and env are missing (`openrouterKey ?? ''`). Generates a 401 on real call — not silent, but doesn't flip `llmDegraded` like the Anthropic path does. Old code had the same gap (`process.env.OPENROUTER_API_KEY as string` → `Bearer undefined`). Not regressed by this commit. Recommend future follow-up to mirror Anthropic's degrade-to-mock branch.
5. **L-2 (informational):** No index on `org_members(org_id, created_at)`. `ORDER BY created_at LIMIT 1` on large orgs would full-scan. Solo-company assumption (≤ handful of members) makes this practically free. If team-scale orgs arrive, add a compound index.

**Nil critical / high.** Auto-approve.

---

## Overall Verdict

| Commit | Score | Action |
| ------ | ----- | ------ |
| d5556a4 Phase 4F.3 | 9.7/10 | SHIP |
| 2ffc3a2 Phase 4N-POLISH | 9.6/10 | SHIP |
| 2af6f6b Phase 4E.2-TUNING | 9.7/10 | SHIP |
| 6f82e7c Phase 4G-WIRE | 9.5/10 | SHIP |

All 4 commits meet auto-approve threshold (≥9.5, 0 crit, 0 high). Scope-locked, DRY-respecting, regression-free follow-ups. Positive observations:

- **DRY wins:** tier normalizer unifies 2 call-sites; owner-resolver mirrors `resolveOrgId` inverse; migration aligns index with actual query planner needs.
- **Security posture:** PII-default-off + BYOK-default-off + strict `=== '1'` checks — no loose truthy traps.
- **Backward compat:** every commit preserves old behavior when new env flag is off.
- **Test discipline:** reshape rather than silence; cover no-op + happy + throw + shape assertions.

## Recommended Follow-ups (non-blocking)

1. OpenRouter path: mirror Anthropic's `llmDegraded = true` + mock fallback for 4G-WIRE parity (L-1 in commit 4).
2. If org_members ever grows per-tenant, add compound index `(org_id, created_at)` — trivial migration 0013.
3. Parser `parse_error.rawPayload`: consider making 200-char cap configurable via `LLM_CACHE_DEBUG_FULL_PAYLOAD` env if parse failures ever need deep debugging.

## Unresolved Questions

- None. All 4 commits are fully self-contained follow-ups to prior reviewed work.
