# Code Review — Phase 4E.2 Semantic Similarity Cache

**Date:** 2026-04-18
**Scope:** R5 item 3/5 (commit pending)
**Plan:** `plans/260418-2400-sophia-r5-4e2-semantic-cache/plan.md`
**Score:** **9.6/10 — SHIP**
**Critical:** 0 | **High:** 0 | **Medium:** 2 | **Low:** 3

---

## Scope

| File | Status | LOC | ≤200 |
|---|---|---|---|
| `src/lib/llm/cache/llm-cache-semantic.ts` | NEW | 170 | ✅ |
| `src/lib/llm/cache/llm-cache-semantic.test.ts` | NEW | 251 | (test file) |
| `src/lib/llm/cache/llm-cache.ts` | MODIFIED | 197 | ✅ |
| `migrations/0010-llm-cache-semantic.sql` | NEW | 20 | ✅ |
| `wrangler.jsonc` | MODIFIED | `ai.binding=AI` confirmed L41-43 | ✅ |

Verified: tests 1226→1242 (+16), build exit 0, existing 38 llm-cache tests intact.

---

## Overall Assessment

Clean, minimal, YAGNI-compliant. Gates stack correctly (`LLM_CACHE_ENABLED` ∧ `LLM_CACHE_SEMANTIC_ENABLED` ∧ AI binding ∧ non-empty orgId). Exact-match hot path is **completely unchanged** when `LLM_CACHE_SEMANTIC_ENABLED≠'1'` (writeCache stores nulls, lookupCache short-circuits at `trySemanticFallback`). Math is correct (cosine + zero-mag + length-mismatch guards). BLOB round-trip is byte-exact (`Float32Array.buffer` → `Uint8Array` → `Float32Array` preserves all 5 edge values incl. 1e-6, 1e6). Cross-org isolation verified: WHERE `org_id=key.orgId` + hash prefix + empty-orgId guard — three defenses.

---

## Critical / High

None.

---

## Medium (2)

### M-1 — `embedPrompt` called on every `writeCache` (cost + latency)
**File:** `llm-cache.ts:168-176`
Every cache-miss path now triggers a Workers AI embedding call when semantic is enabled. On a busy surface (weekly-digest, script-generator) this is a **paid inference per miss** with user-blocking latency (embed happens before the upsert await). Workers AI bge-base is ~$0.011/M tokens + ~30-80ms, which is fine individually but unbounded under load.
**Fix:** fire-and-forget the embed+upsert (`void` the write), or at minimum wrap in `Promise.race` with a short timeout. The upsert itself is already best-effort — the embed should be too.
**Impact:** performance only; correctness unaffected.

### M-2 — Top-K index lacks `provider` + `model` columns
**File:** `migrations/0010-llm-cache-semantic.sql:18-19`
Index is `(org_id, embedding_model, created_at DESC)` but the query also filters `.eq('provider', …).eq('model', …)`. On orgs with many providers, D1 reads K rows for the *composite* filter via index, then application-filters by provider/model — effective K can shrink below intended. At 768-float × K=10 per candidate, this is currently fine, but if an org has >10 non-matching rows ahead of the match, the real top-K degrades.
**Fix (optional):** index `(org_id, embedding_model, provider, model, created_at DESC)` — or accept current MVP trade-off and document.
**Impact:** hit-rate degradation on multi-model orgs; not a correctness bug.

---

## Low (3)

### L-1 — `embedding` column read twice off wire on write
`writeCache` computes embedding even when exact-match hash would later find an existing row. Upsert pattern handles this, but the embed is still spent. Acceptable MVP trade.

### L-2 — `decodeEmbedding` could fail on misaligned Uint8Array
**File:** `llm-cache-semantic.ts:116-119`
If a future migration hands a `Uint8Array` view with `byteOffset % 4 !== 0`, `new Float32Array(buf)` throws. Current D1 BLOB reads hand back a fresh ArrayBuffer, so unreachable today — but add a try/catch or `.slice()` defensively. Already swallowed one level up by `semanticLookup`'s outer try/catch, so no leak.

### L-3 — `prompt_text` stored when semantic enabled — PII risk
User prompts (potentially email/PII) stored as plaintext in D1 for "observability". No retention trim, no redaction. Consider: (a) gate behind separate `LLM_CACHE_STORE_PROMPT_TEXT` flag, or (b) store only prompt SHA-256 prefix. Flagged for Phase 4E.3 purge cron which already covers TTL.

---

## Edge Cases Scouted

| Case | Handling |
|---|---|
| Empty orgId | Rejected at `trySemanticFallback:43` + existing guards in lookupCache/writeCache |
| AI binding undefined | `getAiBinding` returns null → `embedPrompt` returns null → `semanticLookup` returns null |
| AI `.run()` throws | `embedPrompt` catches → null |
| D1 throws | outer try/catch at `semanticLookup:167` → null |
| Expired candidate | Skipped at `semanticLookup:152` via `new Date(expires_at).getTime() <= now` |
| Cross-org bleed | 3-layer defense (hash prefix, `org_id` WHERE, empty-orgId reject). ✅ |
| Zero-magnitude / mismatched-length vectors | Returns 0 → below any threshold → null |
| Opposite vectors (cosine=-1) | Below threshold → null (test verified) |
| `LLM_CACHE_SIMILARITY_THRESHOLD` invalid | Falls through to 0.95 default |
| `LLM_CACHE_SEMANTIC_TOP_K=0` or negative | Falls through to 10 default |
| Float32 round-trip (1e-6, 1e6, 0) | Lossless — test `encodeEmbedding/decodeEmbedding` confirms |

---

## Positive Observations

- Pure functions (`cosineSimilarity`, `normalizePromptForEmbedding`, `encodeEmbedding`, `decodeEmbedding`) are unit-testable without mocks
- `EMBEDDING_MODEL_ID` constant re-exported from semantic module → single-source-of-truth; lookup and write query the same model partition
- `normalizePromptForEmbedding` slice(8192) caps inputs to bge-base window — bounded cost
- Semantic/exact module split keeps llm-cache.ts at 197 LOC (under 200 rule)
- All 3 new DB columns are nullable → migration is backward-safe; rollback = drop columns, no data loss
- Tests cover negative space (disabled / missing binding / D1 throw / all-below-threshold / expired-skip) as robustly as positive space
- Strict `"1"` gate (rejects `"true"`) enforced and tested

---

## Test Coverage

16 new tests across 4 describe blocks:
- cosineSimilarity: 5 cases (identical, orthogonal, opposite, mismatched-len, zero-mag) ✅
- encode/decode: 1 round-trip (5-value Float32) ✅
- isSemanticCacheEnabled: 3 gate cases ✅
- trySemanticFallback: 7 (disabled, empty-orgId, no-binding, happy-path best-of-K, all-below-threshold, expired-skip, D1-throw) ✅

**Gap:** no test asserts `writeCache` actually populates the new `embedding`/`embedding_model`/`prompt_text` columns when enabled. Tests verify read path; write-path observability belongs in Phase 4E.3 or admin-monitoring. Acceptable for MVP.

---

## Security Review

- ✅ No cross-tenant bleed: `.eq('org_id', key.orgId)` + hash prefix + empty-orgId guard
- ✅ No embedding model confusion: `.eq('embedding_model', EMBEDDING_MODEL_ID)` prevents comparing bge vectors with any future model
- ✅ No SQL injection surface (Supabase-style query builder)
- ✅ AI binding is read-only (embedding inference, not completion) — zero prompt injection risk
- ⚠️ `prompt_text` plaintext storage — see L-3

---

## Metrics

- Type coverage: 100% (no `any` outside well-scoped `AiRunResult.data`)
- Linting: clean
- File size rule: all files ≤200 LOC (test file exempt)
- Zero `console.log`, zero TODO, zero `@ts-ignore`

---

## Recommended Actions (non-blocking)

1. **M-1 fix before enabling in prod:** wrap `embedPrompt` in writeCache with `Promise.race(…, timeout)` or fire-and-forget
2. **M-2 optional:** widen index to include provider+model if multi-model orgs observed
3. **L-3:** decide Phase 4E.3 whether to PII-trim `prompt_text` or gate separately
4. Add a `writeCache(enabled)` test asserting upsert payload includes embedding bytes

---

## Unresolved Questions

1. What is the expected embedding cost envelope per 1000 campaign jobs? (Needed to validate M-1 before flipping `LLM_CACHE_SEMANTIC_ENABLED=1` in prod.)
2. Should `prompt_text` be subject to user data deletion (GDPR/DSR) — does Phase 4E.3 purge handle it?
3. Is 0.95 the right default threshold for bge-base-en-v1.5 in campaign-prompt domain? (Might want 0.92 based on empirical hit-rate.)

---

**Verdict:** SHIP. Zero-critical, zero-high, fully gated, backward-compatible, well-tested. MVP bar cleared. M-1/M-2 are production-hardening, not merge blockers.
