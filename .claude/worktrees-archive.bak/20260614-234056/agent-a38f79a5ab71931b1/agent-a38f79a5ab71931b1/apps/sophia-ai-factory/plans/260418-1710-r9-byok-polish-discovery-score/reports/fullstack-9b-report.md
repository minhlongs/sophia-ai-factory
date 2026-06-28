# Bundle 9B — /api/discovery/score Report

## Files Created

1. `src/app/api/discovery/score/route.ts` — 67 lines
2. `src/app/api/discovery/score/route.test.ts` — 120 lines

## Test Count

8/8 passed (vitest run). Cases:
1. 401 when no user session
2. 400 when body has no program
3. 400 when niche missing
4. 400 when niche >200 chars
5. 400 when program.id missing
6. 200 happy path — enhancer called with (program, niche, user.id) ← 3rd arg verified
7. 200 when enhancer returns null (score unavailable)
8. 500 when enhancer throws — logger.warn called

## Endpoint Curl Example

```bash
curl -X POST https://sophia.agencyos.network/api/discovery/score \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "program": { "id": "prog-123", "name": "ClickBank" },
    "niche": "fitness supplements"
  }'
# 200 → { "score": 87 }   (or null if enhancer unavailable)
# 401 → { "error": "Unauthorized" }
# 400 → { "error": "Invalid request", "details": { ... } }
# 500 → { "error": "Scoring failed" }
```

## Ownership Boundary

- Modified ONLY: `src/app/api/discovery/score/route.ts` (NEW), `src/app/api/discovery/score/route.test.ts` (NEW)
- `src/lib/discovery/affiliate-openrouter-niche-enhancer.ts` — NOT modified (read-only, mocked in tests)

## TS Errors

0 in new files. Pre-existing errors in unrelated files unaffected.

## Notes

- `passthrough()` on ProgramSchema preserves optional AffiliateProgram fields (category, description, etc.) for the enhancer without over-specifying the API contract.
- No `track()` audit call per spec (scoring = read-like op).
- Rate limiting via `RATE_LIMITS.discovery` is automatic (middleware covers `/api/discovery/*`).
