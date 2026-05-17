---
title: "Phase 05 — Smoke Test (Operator BYOK $)"
description: "Operator funds own keys, creates test account via Setup Wizard, runs full RaaS golden path, documents every issue."
status: deferred-pending-budget
priority: P1
effort: "4-6h wall-clock (incl waits)"
dependencies: [phase-04-wiring-fixes]
created: 2026-05-16
---

# Phase 05 — Smoke Test (Operator BYOK $)

## Context Links

- Brainstorm: `plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md` §3 Stage 2, §4 Phase 05
- Doctrine: no-tech v1.28.1 — operator owns NO production keys. Smoke test uses operator's PERSONAL keys, not platform keys.
- Input: closed Phase 04 matrix (zero P0/P1 NEEDS-BUILD)
- Output: `plans/reports/smoke-260516-test-account-run.md`

## Overview

- **Priority:** P1 — high-confidence bonus signal; not required for handover sign-off
- **Status:** **deferred-pending-budget** — runs only if operator approves ~$30-100 spend
- **Description:** Operator creates `test+audit@...` user, signs up like a real customer, enters their own OpenRouter / ElevenLabs / D-ID / HeyGen / Telegram keys, runs golden path end-to-end, documents every UX friction + bug. Cleanup SQL afterwards.

## Key Insights

- Phase 05 is OPTIONAL — Phase 04 matrix closure is the actual handover gate
- This phase ONLY runs if Phase 04 closed cleanly (0 P0/P1 NEEDS-BUILD) — else fix those first
- Operator's own keys are personal, not platform — doctrine preserved
- Costs estimate: ~$5-20 OpenRouter + ~$5-30 ElevenLabs + ~$10-30 HeyGen + ~$0 Telegram = $20-80 total
- Test data must be cleaned up after run (SQL delete by user_id) — no lingering test rows

## Requirements

### Functional

- Operator signs up at `https://sophia.agencyos.network/signup` as `test+audit@<operator-email>`
- Enters own keys via Setup Wizard for OpenRouter, ElevenLabs, D-ID/HeyGen
- Connects own Telegram via bot link
- Runs `/campaign` command (or UI equivalent) creating one campaign
- Verifies: script generated → voice generated → video rendered → published or queued
- Documents every screen, every loading state, every error in run report
- Cleanup SQL run after: delete user + cascaded rows by user_id

### Non-Functional

- Real production environment (no staging)
- Operator uses own personal credit card for any payment touches (NOWPayments crypto top-up if testing payments)
- No platform-level changes during run (audit is observation, not modification)

## Architecture

```
Operator (real customer simulation)
  ↓ signup
sophia.agencyos.network/signup
  ↓ Setup Wizard
user_keys (encrypted) populated for OpenRouter, ElevenLabs, D-ID
  ↓ /campaign command
campaigns + missions rows created in D1
  ↓ mission queue
script (OpenRouter) → voice (ElevenLabs) → video (D-ID/HeyGen) → publish
  ↓ verification
operator confirms each output, captures screenshot
  ↓ cleanup
SQL: DELETE FROM users WHERE email LIKE 'test+audit@%' (CASCADE)
```

## Related Code Files

### Read (no edits)

- All routes touched during golden path (Setup Wizard, /campaign, Telegram webhook, publish handler)
- D1 schema for cleanup SQL

### Write

- `plans/reports/smoke-260516-test-account-run.md` — run log with screenshots/logs

### Create / Delete

- None in source. Only test data created + cleaned up in D1.

## Implementation Steps

1. **PRE-CHECK:** confirm Phase 04 matrix has 0 P0/P1 NEEDS-BUILD remaining. If not, abort Phase 05.
2. **Budget approval:** confirm operator approves spend (~$30-100 personal). If declined, mark phase deferred indefinitely and skip to Phase 06.
3. **Test setup:**
   - Create `test+audit@<operator>.com` (or `+audit` alias)
   - Have keys ready: OpenRouter API key, ElevenLabs API key, D-ID or HeyGen key, Telegram bot connection link
   - Open recording (browser screen capture) + terminal log of CF logs (`wrangler tail`)
4. **Golden path execution:**
   - 4.a. Sign up at `/signup`. Document any errors.
   - 4.b. Complete Setup Wizard — enter all 3-4 API keys. Document each step.
   - 4.c. Connect Telegram bot (link account).
   - 4.d. From dashboard, create a campaign (or via `/campaign` Telegram command).
   - 4.e. Wait for script generation → screenshot result.
   - 4.f. Wait for voice generation → listen, screenshot waveform / status.
   - 4.g. Wait for video rendering → download / preview output.
   - 4.h. Verify publish queue entry (do NOT actually publish to public YouTube — use unlisted or staging channel).
   - 4.i. Run `/status` and `/results` Telegram commands → confirm data appears.
5. **Issue logging:** for every friction (slow load, unclear copy, error, missing state, broken redirect), add a row to run report: severity (P0/P1/P2), screenshot, location.
6. **Cleanup:**
   - 6.a. Run cleanup SQL: `DELETE FROM users WHERE email LIKE 'test+audit@%'` (with appropriate CASCADE or manual child deletes)
   - 6.b. Verify user_keys, campaigns, missions, videos rows for test user are gone
   - 6.c. Disconnect Telegram bot from test account
7. **Write report** `plans/reports/smoke-260516-test-account-run.md`: timeline, screenshots, issue list, total cost, pass/fail verdict per workflow step.
8. **Triage:** P0 issues from smoke test → must fix before handover (loop back to Phase 04 with new fixes). P1/P2 → handover backlog.
9. Commit report: `docs(smoke): operator-driven golden path run`

## Todo List

- [ ] Confirm Phase 04 matrix closed (0 P0/P1 NEEDS-BUILD)
- [ ] Operator budget approval received
- [ ] Test account + keys prepared
- [ ] Sign up + Setup Wizard run
- [ ] Telegram connected
- [ ] Campaign created
- [ ] Script generated
- [ ] Voice generated
- [ ] Video rendered
- [ ] Publish queue entry verified
- [ ] /status + /results commands tested
- [ ] All issues logged with severity
- [ ] Cleanup SQL run + verified
- [ ] Report written
- [ ] P0 issues triaged (loop back to Phase 04 or accept)
- [ ] Report committed

## Success Criteria

- Golden path completes end-to-end without operator manual intervention beyond expected customer steps
- 0 P0 issues remain unfixed (P1/P2 acceptable in handover backlog)
- Cleanup verified — no test data in production D1
- Report has timestamped step log + screenshots
- Total cost documented for future smoke run planning

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Operator declines budget → phase stalls | Phase 05 is optional — handover proceeds via Phase 06 with matrix-only evidence |
| External API rate limits hit during test | Use lowest cost / smallest output settings (short script, 5s voice, low-res video preview) |
| Test data leaks into production analytics | Tag test account in DB (e.g., `is_test = true`) before run; cleanup excludes from analytics retroactively |
| Test publish reaches public YouTube channel | Use unlisted-only setting or staging channel. Verify before pressing publish. |
| Bug found mid-run requires fix → contaminates audit | Document bug, abort run if blocking, fix in Phase 04 loop, restart Phase 05 with new test account |

## Security Considerations

- Operator's PERSONAL keys are entered into real production storage — verify they are encrypted at rest (P21 from Phase 03 must already PASS)
- Cleanup SQL must include `user_keys` table — operator's keys MUST be deleted post-run
- Do NOT commit operator keys or screenshots showing keys to git
- Telegram bot disconnect MUST happen — leftover connections expose chat history
- Test campaign artifacts (videos) — delete from storage if any (D-ID hosted, our R2 if applicable)

## Next Steps

- If smoke passes → Phase 06 sign-off with smoke report as supporting evidence
- If smoke fails P0 → loop to Phase 04 with new issues, rerun Phase 05 after fix
- If operator declines budget → Phase 06 proceeds, smoke marked `deferred-pending-budget` permanently in handover doc
- Smoke report itself becomes a template for future quarterly handover-verification runs
