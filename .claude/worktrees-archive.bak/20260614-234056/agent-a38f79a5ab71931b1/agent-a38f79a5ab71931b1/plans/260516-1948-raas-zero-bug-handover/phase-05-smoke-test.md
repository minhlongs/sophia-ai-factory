---
title: "Phase 05 — Smoke Test (Operator BYOK $) — Full E2E"
description: "Operator funds own keys, creates test account via Setup Wizard, runs full RaaS golden path, documents every issue."
status: active
priority: P1
effort: "~2-3h wall-clock execution (operator-driven)"
dependencies: [phase-04-wiring-fixes]
created: 2026-05-16
activated: 2026-05-16
post_handover: true
notes: "Reactivated after handover def90421 — confirmatory smoke, not gate-blocking. Result will append to handover doc as evidence."
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

---

## 🚀 Operator Runbook (2026-05-16 Activation)

> **Doctrine note:** Operator dùng PERSONAL keys cho smoke, không phải platform keys.
> Sau khi xong: cleanup SQL + deauth bot + xóa keys.
> Báo cáo append vào `plans/reports/smoke-260516-test-account-run.md`.

### A. Preflight (5 min)

```bash
# 1. Open new terminal for CF logs (keep visible during smoke)
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler tail sophia-ai-factory --format pretty

# 2. Verify production matches local
LOCAL=$(git rev-parse HEAD | cut -c1-8)
LIVE=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL  Live: $LIVE"  # MUST match (def90421)

# 3. Prepare keys (do NOT paste into chat):
#    - OpenRouter:   https://openrouter.ai/keys  (top up $5 if needed)
#    - ElevenLabs:   https://elevenlabs.io/app/settings/api-keys (Starter plan or trial)
#    - D-ID:         https://studio.d-id.com/account-settings/api-keys (trial = $5.99 credit)
#    - HeyGen:       https://app.heygen.com/settings (Free or Creator $29/mo)
#    - NOWPayments:  https://account.nowpayments.io/ (operator's wallet for USDT TX)
```

### B. Account + Setup Wizard (10 min)

1. Browser → `https://sophia.agencyos.network/signup`
2. Sign up as `test+audit-260516@<operator-email>` (use `+audit-260516` alias to filter cleanup)
3. Complete Setup Wizard:
   - **Step 1 — Profile:** Fill basic info
   - **Step 2 — API Keys:** Paste OpenRouter, ElevenLabs (xi-api-key), D-ID (base64 key from dashboard, **NOT raw**), HeyGen
   - **Step 3 — Telegram (optional):** Click "Connect @Sophia_Bbot" → `/start audit-260516` from your Telegram
4. **Capture screenshot** of completed wizard
5. **Document** any UX friction: confusing labels, missing validation, broken redirects → log to smoke report §UX-Friction

### C. Tier Subscription (5 min, ~$5 USDT)

```bash
# Optional: subscribe BASIC tier via NOWPayments
# Dashboard → Pricing → Starter $199 → NOWPayments invoice
# Pay smallest amount possible (test mode USDT $5 minimum)
# Wait for IPN → verify dashboard shows "BASIC active"
```

Skip this step if testing one-time MCU bundle instead.

### D. Mission Tests (45 min, ~$10-30 BYOK spend)

For each command below, run via dashboard UI **OR** REST API:

```bash
# Get API key from Settings → API Keys, export it
export SOPHIA_API_KEY="sk-..."  # do NOT paste here, in operator's local terminal only

# Helper
sophia_mission () {
  curl -s -X POST https://sophia.agencyos.network/api/v1/missions \
    -H "Authorization: Bearer $SOPHIA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$1" | jq .
}
```

| # | Command | Test payload | Expected | Critical? |
|---|---------|--------------|----------|-----------|
| 1 | `proposal:create` | `{"command":"proposal:create","params":{"niche":"SaaS"}}` | 202 + proposal text via OpenRouter | LLM smoke |
| 2 | `proposal:list` | `{"command":"proposal:list","params":{}}` | 200 + proposal from #1 in list | DB smoke |
| 3 | `email:test` | `{"command":"email:test","params":{"to":"<operator>"}}` | Test email arrives | Resend smoke |
| 4 | `subtitle:generate` | (small audio sample) | SRT output | Whisper smoke |
| 5 | `webhook:test` | `{"command":"webhook:test","params":{"url":"https://webhook.site/<your-id>"}}` | webhook.site shows ping | HTTPS out smoke |
| 6 | `voice:clone` ⭐ | `{"command":"voice:clone","params":{"voice_name":"Audit","sample_urls":["https://<r2-url>/sample.mp3"]}}` | real ElevenLabs voice_id (NOT stub-voice-preview-001) | **NEW CODE** — most important |
| 7 | `avatar:create-did` ⭐ | `{"command":"avatar:create-did","params":{"source_url":"https://<url>/portrait.png","script":"Hello from Sophia audit"}}` | real D-ID `talk_id`, poll_url works | **NEW CODE** — most important |
| 8 | `video:create` | `{"command":"video:create","params":{"prompt":"Short demo"}}` | 202 + job_id; video appears in dashboard after 3-10min | HeyGen smoke |
| 9 | `lead:find` | `{"command":"lead:find","params":{"niche":"agencies"}}` | 202 + `is_stub: true` (Apollo not BYOK yet) | confirms beta status |
| 10 | `email:campaign` | `{"command":"email:campaign","params":{"subject":"Test","recipients":["<operator>"]}}` | Email delivered | Resend bulk smoke |
| 11 | `analytics:report` | `{"command":"analytics:report","params":{}}` | Report with sequence #1-10 stats | Stats smoke |

**Cycle 12: tier-gate hit-test (rate limit)**

```bash
# Verify aiCommands quota kicks in
for i in {1..6}; do
  sophia_mission '{"command":"proposal:create","params":{"niche":"Test"}}'
done
# Expected: 6th call returns HTTP 429 `Monthly AI command limit of 5 reached for tier BASIC`
```

**Cycle 13: refund-window test**

```bash
# Request refund on the BASIC purchase from Step C
# Dashboard → Billing → Request Refund → fill wallet + reason
# Expected: 201 with refundId
# Try again: 409 already_requested
# (cannot test 422 without 30-day-old purchase)
```

### E. Telegram FSM Test (15 min)

1. Send `/campaign` to @Sophia_Bbot
2. Walk through FSM: niche → confirm → discover trends → create
3. Send `/status` — verify mission listed
4. Send `/results` — verify outputs returned

### F. Cleanup (10 min) — DO NOT SKIP

```sql
-- Run via wrangler d1 against sophia-raas-db remote
-- Replace <USER_ID> with actual id from users table

-- 1. Find user id
SELECT id, email FROM users WHERE email LIKE '%+audit-260516@%';

-- 2. Delete cascading
DELETE FROM user_api_keys WHERE user_id = '<USER_ID>';
DELETE FROM engine_missions WHERE user_id = '<USER_ID>';
DELETE FROM campaigns WHERE user_id = '<USER_ID>';
DELETE FROM user_purchases WHERE user_id = '<USER_ID>';
DELETE FROM refund_requests WHERE user_id = '<USER_ID>';
DELETE FROM subscriptions WHERE user_id = '<USER_ID>';
DELETE FROM users WHERE id = '<USER_ID>';

-- 3. Verify clean
SELECT COUNT(*) FROM users WHERE email LIKE '%+audit-260516@%';  -- = 0
```

```bash
# Deauth Telegram (from Telegram app)
# /stop or block @Sophia_Bbot

# Revoke API keys at:
# - https://openrouter.ai/keys
# - https://elevenlabs.io/app/settings/api-keys
# - https://studio.d-id.com/account-settings/api-keys
# - https://app.heygen.com/settings
```

### G. Report (15 min)

Operator writes to `plans/reports/smoke-260516-test-account-run.md`:

- Header: date, operator email (redacted to `<initials>@..`), total cost, total duration
- §Mission results: 13-row table with PASS/FAIL per command + actual response snippets (redacted)
- §UX friction: every confusing/broken thing seen, with severity (P0/P1/P2)
- §Cleanup verification: counts after cleanup (must be 0)
- §Verdict: GREEN / YELLOW / RED + recommendation
- §Cost summary: per-provider $ spent + total

Commit: `docs(smoke): operator E2E run 260516 — <verdict>`

### H. Triage (if P0 found)

- P0 = customer-blocker → reopen Phase 04, fix + new commit, push, redeploy, re-run failed test
- P1/P2 → append to handover doc §8 Known Issues
- All-green → mark Phase 05 status `completed` + update handover doc Smoke Test Status
