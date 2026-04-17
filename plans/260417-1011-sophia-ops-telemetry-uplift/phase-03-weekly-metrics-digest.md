# Phase 3 — Weekly Metrics Digest (Extension)

## Context Links
- `apps/sophia-ai-factory/src/app/api/cron/weekly-signals-digest/route.ts` (existing — EXTEND, do not duplicate)
- `apps/sophia-ai-factory/src/lib/signals/auth-helper.ts` (`requireCron` — reuse for bearer auth)
- Phase 1 deliverable: `signals_events` table + `track()` helper
- Reports: `plans/reports/synthesis-260417-1011-sophia-claudekit-mekong-mapping.md` §"Recommended Scope #2b"

## Overview
- **Priority:** P1
- **Status:** pending
- **Owner:** dev-A (handoff from Phase 1 — same dev for context continuity)
- **Effort:** 6h
- **CRITICAL:** Existing route at `/api/cron/weekly-signals-digest` queries PostHog + emails. Extend to ALSO query D1 `signals_events` AND post to GH Issue + Telegram. Idempotent per ISO week.

## Key Insights
- DO NOT add a new cron — Mon 06:00 UTC slot already exists in `wrangler.toml`. Founder asked Mon 09:00 UTC; **propose 06:00 to founder OR change cron to `0 9 * * 1`** (single-line change). Default: keep 06:00 (already wired).
- Existing route uses PostHog Insights API. Add D1 path as **primary metrics source** (founder-owned), PostHog as **secondary enrichment**.
- Idempotency: GH Issue title is `Weekly Metrics Digest — Week {ISO_WEEK} ({YYYY-MM-DD})`. Search-by-title; if exists, EDIT body instead of creating new.
- Telegram message is short summary + GH Issue URL (full report lives in Issue).

## Requirements

### Functional
- Aggregate from `signals_events` for last 7 days:
  - New signups (count of `tier_conversion` w/ `from_tier='free'`)
  - Tier conversions (group by target tier)
  - Payment success / failure counts (sum + dollar amount from props)
  - Top BYOK providers (group by `props.provider` from `byok_call`)
  - Agent dispatch counts (group by `props.agent_name`)
- Render as Markdown digest (Vietnamese + English bilingual per Sophia handover rules).
- POST GitHub Issue (label `metrics:weekly`):
  - Idempotent: search existing issue by title; if found → PATCH body; else → POST new.
- POST Telegram message: 1-paragraph TL;DR + link to GH Issue.
- Existing email path (Resend) and PostHog query continue to function — additive change only.

### Non-Functional
- Edge runtime; D1 queries must be paginated if `signals_events` exceeds 10k rows/week (use LIMIT + COUNT first).
- All API tokens from env: `GITHUB_TOKEN_DIGEST` (PAT w/ issue scope), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Failure in GH Issue post does NOT block Telegram post (and vice versa).

## Architecture
```
Mon 06:00 UTC cron
   │
   ▼
GET /api/cron/weekly-signals-digest  (requireCron bearer auth)
   │
   ├─ fetchD1Aggregates()         ── NEW: SELECT … FROM signals_events
   ├─ fetchTopEvents() (existing) ── PostHog enrichment
   ├─ summarizeWithAI() (existing)── OpenRouter → Markdown
   ├─ sendEmail() (existing)      ── Resend
   ├─ postGithubIssue()           ── NEW: idempotent POST/PATCH
   └─ postTelegram()              ── NEW: TL;DR + Issue URL
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/app/api/cron/weekly-signals-digest/route.ts` — add D1 query + GH Issue + Telegram

### Create
- `apps/sophia-ai-factory/src/lib/signals/digest/d1-aggregates.ts` — pure SQL aggregation queries (mockable for tests)
- `apps/sophia-ai-factory/src/lib/signals/digest/github-issue-poster.ts` — idempotent issue create/update
- `apps/sophia-ai-factory/src/lib/signals/digest/telegram-poster.ts` — short TL;DR send
- `apps/sophia-ai-factory/src/lib/signals/digest/markdown-renderer.ts` — bilingual Markdown formatter
- `apps/sophia-ai-factory/src/lib/signals/digest/d1-aggregates.test.ts`
- `apps/sophia-ai-factory/src/lib/signals/digest/github-issue-poster.test.ts` (mock fetch)

### Delete
- none

## Implementation Steps
1. Create `digest/d1-aggregates.ts` with 5 query functions (signups, conversions, payments, providers, dispatches). Each returns typed result.
2. Create `digest/markdown-renderer.ts` — takes aggregate results, returns bilingual Markdown string. Sections: TL;DR, Signups, Conversions, Payments, BYOK Usage, Agent Activity.
3. Create `digest/github-issue-poster.ts`:
   - `findExistingIssue(title)` → GET `/repos/{owner}/{repo}/issues?labels=metrics:weekly&state=open` → match by title prefix.
   - `upsertIssue({title, body, labels})` → POST or PATCH accordingly.
4. Create `digest/telegram-poster.ts` — POST `sendMessage` w/ markdown parse mode.
5. Modify `route.ts`:
   - After existing PostHog + summarize + email steps, add D1 fetch.
   - Compose final Markdown via `markdown-renderer`.
   - Call `upsertIssue()` and `postTelegram()` in `Promise.allSettled` (independent failure isolation).
   - Log results; return `{ ok: true, sources: [...], issue_url, telegram_ok }`.
6. Tests: 6+ cases (5 query types + idempotent issue upsert).
7. Locally test via `npx wrangler dev --remote` + `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/weekly-signals-digest`.
8. Verify GH Issue + Telegram appear; rerun → verify Issue updated (not duplicated).

## File Ownership (Parallel Mode)
- **Owns exclusively:** all files under `apps/sophia-ai-factory/src/lib/signals/digest/` + the route file `weekly-signals-digest/route.ts`.
- **Coordination:** Phase 1 owns `signals_events` schema; Phase 3 only READS from it. Phase 1 must merge before Phase 3 can integration-test.

## Dependencies
- **Blocks:** none
- **Blocked by:** Phase 1 (needs `signals_events` table)

## Todo List
- [ ] `d1-aggregates.ts` w/ 5 typed query functions
- [ ] `markdown-renderer.ts` bilingual VN+EN
- [ ] `github-issue-poster.ts` idempotent upsert
- [ ] `telegram-poster.ts`
- [ ] Wire all into `route.ts` (additive, preserve email path)
- [ ] Tests pass (≥6 new tests)
- [ ] `npm run build` 0 errors
- [ ] Local cron trigger smoke test
- [ ] Verify idempotent re-run

## Success Criteria
- One cron fire produces: 1 GH Issue + 1 Telegram + 1 Email (existing).
- Re-fire same week → SAME Issue updated, no duplicate.
- D1 aggregates match raw `wrangler d1 execute --command "SELECT event_type, COUNT(*) FROM signals_events WHERE ts > strftime('%s','now','-7 days')*1000 GROUP BY event_type"`.

## Risk Assessment
- **R1:** GH PAT scope insufficient → use `GITHUB_TOKEN_DIGEST` w/ `repo` scope; document required scope in PR.
- **R2:** Telegram message exceeds 4096 chars → only send TL;DR + URL (full body in Issue).
- **R3:** Existing email path regresses → add explicit test that calls route w/ all paths and verifies email mock still called.
- **R4:** Issue title race (parallel cron + manual trigger) → idempotent search returns first match; acceptable.

## Security Considerations
- `CRON_SECRET` bearer required (existing `requireCron`).
- GH PAT stored as CF secret, never in code.
- Issue body: NO raw user IDs or emails — aggregates only (counts, totals).

## Next Steps
- After 1st successful weekly fire, founder reviews Issue → tweaks aggregate definitions if needed.
- Future iter: add `digest:monthly` cron variant.
