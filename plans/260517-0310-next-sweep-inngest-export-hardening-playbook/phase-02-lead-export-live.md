# Phase 02 — `lead:export` Mission: Stub → Live

## Context Links

- `apps/sophia-ai-factory/src/forest/missions/handlers/lead-export.ts` — Current 35-LOC stub (5 hardcoded rows)
- `apps/sophia-ai-factory/src/forest/missions/command-registry.ts:53-57` — Status `beta`, 1 credit
- `apps/sophia-ai-factory/src/lib/apollo/apollo-client.ts` — Current `apolloPeopleSearch` (single page)
- `apps/sophia-ai-factory/src/forest/missions/handlers/lead-find.ts` — Sibling LIVE handler (BYOK pattern reference)
- `apps/sophia-ai-factory/src/tree/byok/user-api-key-store.ts` — BYOK key retrieval
- Apollo API docs: POST `/api/v1/mixed_people/search` (paginated via `page` + `per_page`, max 100 per page)
- Rules: `apps/sophia-ai-factory/.claude/rules/development-rules.md` (zod, no `:any`, server actions)

## Overview

- **Priority:** P2 (revenue feature; beta → live)
- **Status:** pending
- **Description:** Replace stub `lead:export` with real Apollo bulk people-search → CSV streaming response. BYOK-gated; stub fallback when no key.

## Key Insights

1. **Pattern already proven by `lead:find`** — same Apollo BYOK + stub-fallback pattern. Reuse the BYOK lookup logic + error handling shape.
2. **Cloudflare Worker streaming caveat** — CF Workers do support streaming responses via `ReadableStream`, but mission handler returns a structured `MissionHandlerResult`. For initial impl, build full CSV string in memory (≤500 rows × ~10 cols × ~50 bytes = ~250KB) — safely under Workers response limit. Defer true streaming to v2 if quotas grow.
3. **Apollo `mixed_people/search` paginates** — must loop pages until `max_rows` cap OR Apollo returns fewer than `per_page` results.
4. **Quota etiquette** — Apollo charges credits per API call. Hard-cap `max_rows` at 500 to bound cost; default 100 (matches one page).
5. **CSV escaping** — emails / company names can contain commas/quotes. Use proper RFC 4180 escaping (wrap fields containing `,` or `"` in quotes; escape inner quotes as `""`).
6. **Filename should include tenant + ISO date** for operator audit trail (no PII in filename).

## Requirements

### Functional

- F-01: Handler accepts params: `niche` (string, required when BYOK live), `max_rows` (number, default 100, hard-cap 500), `format` (`csv` only for v1).
- F-02: If tenant has `apollo` key in BYOK store → call `apolloPeopleBulkSearch` → return real CSV.
- F-03: If no BYOK key → return existing stub response with `upgrade_path` hint (unchanged behavior).
- F-04: New Apollo bulk client function: `apolloPeopleBulkSearch(apiKey, req)` with pagination support, page_size 100.
- F-05: Update `command-registry.ts`: status `beta` → `live`, description updated to reflect BYOK + stub fallback.
- F-06: Test file `lead-export.test.ts` covering: stub-fallback (no key), BYOK happy path (mocked Apollo), pagination boundary (501 requested → cap at 500), Apollo 401/403 error → friendly error, Apollo 429 → friendly rate-limit error, CSV escape correctness.

### Non-functional

- NF-01: Zero `:any`. Zod validation on params.
- NF-02: Follow `sophia-layer-architecture.md` — Apollo client stays in `src/lib/apollo/` (currently treated as seed-equivalent); handler stays in `forest/missions/`.
- NF-03: Total response payload <5MB (Worker safe).
- NF-04: Test coverage ≥6 new tests, all passing.

## Architecture

```
POST /api/v1/missions { command: "lead:export", params: { niche, max_rows } }
                    │
                    ▼
        mission-router → command-registry lookup → handlers/lead-export.ts
                                                            │
                                                            ▼
                       has BYOK 'apollo' key?  ──── NO ──── return stub (existing behavior)
                                  │
                                  YES
                                  ▼
                    apolloPeopleBulkSearch(key, { niche, max_rows })
                                  │
                       loop pages 1..N until max_rows OR Apollo empty
                                  │
                                  ▼
                    build CSV string (RFC 4180 escaped)
                                  │
                                  ▼
                    return { ok, data: { format: 'csv', content, row_count, filename, is_stub: false } }
```

## Related Code Files

### Modify

- `apps/sophia-ai-factory/src/forest/missions/handlers/lead-export.ts` — full refactor (target ~120 LOC: zod params, BYOK lookup, Apollo call, CSV build, error mapping)
- `apps/sophia-ai-factory/src/lib/apollo/apollo-client.ts` — add `apolloPeopleBulkSearch(apiKey, req)` (~60 LOC: pagination loop, error normalization)
- `apps/sophia-ai-factory/src/forest/missions/command-registry.ts` — `lead:export` status: `beta` → `live`; description updated

### Create

- `apps/sophia-ai-factory/src/forest/missions/handlers/lead-export.test.ts` — vitest test file, 6+ cases
- (Optional, only if Apollo bulk client gets complex enough) `apps/sophia-ai-factory/src/lib/apollo/apollo-bulk-search.ts` — extract bulk function to its own file if `apollo-client.ts` exceeds 200-LOC threshold

### Do NOT modify

- `apps/sophia-ai-factory/src/forest/missions/handlers/lead-find.ts` — pattern reference only; keep as-is
- BYOK store internals

## Implementation Steps

1. **Read sibling handler** `lead-find.ts` for BYOK pattern + error shape. Copy structure.
2. **Extend Apollo client:**
   ```typescript
   // apollo-client.ts (append, do not break existing apolloPeopleSearch)
   export interface ApolloBulkSearchRequest {
     niche: string;
     maxRows: number;
     locationOptional?: string;
   }
   export async function apolloPeopleBulkSearch(
     apiKey: string,
     req: ApolloBulkSearchRequest,
   ): Promise<ApolloPerson[]> {
     const out: ApolloPerson[] = [];
     const perPage = 100;
     const maxPages = Math.ceil(req.maxRows / perPage);
     for (let page = 1; page <= maxPages; page++) {
       const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
         method: 'POST',
         headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
         body: JSON.stringify({ q_organization_industries: [req.niche], page, per_page: perPage }),
       });
       if (!res.ok) throw apolloError(res.status, await res.text());
       const json = await res.json() as { people?: ApolloPerson[] };
       const people = json.people ?? [];
       out.push(...people);
       if (people.length < perPage) break;          // last page
       if (out.length >= req.maxRows) break;        // cap reached
     }
     return out.slice(0, req.maxRows);
   }
   ```
3. **Rewrite `lead-export.ts`:**
   - Zod schema for params (`niche: z.string().min(2).max(120)`, `max_rows: z.number().int().min(1).max(500).default(100)`, `format: z.literal('csv').default('csv')`).
   - Look up `apollo` key via `getUserApiKey(ctx.userId, 'apollo')`.
   - If no key: return existing stub shape (5 rows) with `is_stub: true`.
   - If key: call `apolloPeopleBulkSearch`; on error, return `{ ok: false, error: friendly-msg }` (401 → "Invalid Apollo key", 429 → "Rate-limited, try later", other → "Apollo error").
   - Build CSV: header `['Name','Email','Company','Title','Domain','LinkedIn']` (extra LinkedIn col from Apollo). RFC 4180 escape helper.
   - Filename: `leads-export-{tenantId-short}-{YYYY-MM-DD}.csv`.
4. **Update `command-registry.ts`:** `lead:export` → `status: 'live'`, description: `'Export leads to CSV via Apollo.io bulk search (BYOK; stub fallback)'`.
5. **Write tests** in `lead-export.test.ts`:
   - T-01: no BYOK key → returns stub with `is_stub: true` and 5 rows
   - T-02: BYOK key + Apollo mocked 100 people → returns CSV with 100 data rows + 1 header row + `is_stub: false`
   - T-03: `max_rows=501` requested → zod rejects with validation error
   - T-04: `max_rows=250` + Apollo paginated (page 1: 100, page 2: 100, page 3: 50) → returns 250 rows
   - T-05: Apollo returns 401 → handler returns `{ ok: false, error: /invalid.*apollo.*key/i }`
   - T-06: CSV escape: lead with name `O'Brien, Inc., "CEO"` → field properly quoted + escaped
   - T-07 (optional): Apollo returns 429 → friendly rate-limit message
6. **Build + test + deploy:**
   - `npm run build` → 0 errors
   - `npm test src/forest/missions/handlers/lead-export.test.ts` → all green
   - `npm test` → full suite green (1398+ tests, no regression)
   - `npm run deploy:full` → wrangler success
   - SHA verify via `/api/version`
7. **Manual smoke test (BYOK live):**
   - Use test tenant with Apollo key configured in Setup Wizard
   - POST `/api/v1/missions { command: 'lead:export', params: { niche: 'SaaS', max_rows: 10 } }`
   - Verify CSV returned with 10 rows + `is_stub: false`
8. **Manual smoke test (stub fallback):**
   - Tenant without Apollo key → same POST → stub 5 rows + `is_stub: true` + `upgrade_path` hint.

## Todo List

- [ ] Read `lead-find.ts` pattern (BYOK lookup + error mapping)
- [ ] Add `apolloPeopleBulkSearch` to `apollo-client.ts` (or extract if file >200 LOC)
- [ ] Add zod schema + types in `lead-export.ts`
- [ ] Implement BYOK branch + stub branch in `lead-export.ts`
- [ ] Implement CSV builder + RFC 4180 escape helper
- [ ] Update `command-registry.ts` lead:export → live
- [ ] Write `lead-export.test.ts` with 6+ cases (use vitest mocks for `fetch`)
- [ ] `npm run build` → 0 errors
- [ ] `npm test` → all green (no regression)
- [ ] `npm run deploy:full` → wrangler success
- [ ] SHA verify `/api/version`
- [ ] Manual BYOK smoke test
- [ ] Manual stub-fallback smoke test
- [ ] Update `docs/project-changelog.md` with beta→live transition
- [ ] Optional: bilingual UI hint in mission catalog page mentioning Apollo BYOK

## Success Criteria

- `lead:export` returns real CSV when Apollo BYOK key present.
- Stub fallback unchanged for tenants without key.
- `command-registry.ts` shows `status: 'live'`.
- ≥6 new tests pass; full suite green.
- Deploy SHA-verified.
- Manual smoke tests (both branches) PASS.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Apollo rate-limit hit on high `max_rows` | MED | LOW | Hard-cap 500; default 100; surface 429 to user |
| Worker subrequest timeout (5 pages × ~1s each) | LOW | MED | Cap at 500 rows = 5 pages; total ~5s well under 30s budget |
| CSV injection (formula injection in Excel) | MED | LOW | Sanitize leading `=`, `+`, `-`, `@` in fields (prefix with `'`) |
| Apollo schema changes breaking parse | LOW | MED | Defensive: `json.people ?? []`; zod-validate Apollo response shape |
| BYOK key revoked mid-loop | LOW | LOW | First page failure → return error; partial results not persisted |
| User confusion (stub vs live) | MED | LOW | Maintain `is_stub` flag in result; UI should display badge |

## Security Considerations

- BYOK key never logged. `apolloPeopleBulkSearch` accepts key as arg, never stored.
- Apollo response data treated as untrusted: CSV-escape + formula-prefix sanitization.
- Tenant isolation: handler uses `ctx.tenantId` from authenticated session; no cross-tenant export possible.
- Rate-limit response leaks zero PII (just message).
- No new endpoints; reuses `/api/v1/missions` auth + rate-limit middleware.

## Next Steps

- After live: monitor mission-execution logs for `lead:export` calls — verify ≥1 live invocation per week before declaring beta sunset.
- v2 candidate: filters beyond `niche` (geography, seniority, company size) — defer to user demand.
- v2 candidate: `format: 'jsonl'` for programmatic consumers — defer.
- v2 candidate: streaming response via `ReadableStream` for max_rows >500 — only if quota raises.
