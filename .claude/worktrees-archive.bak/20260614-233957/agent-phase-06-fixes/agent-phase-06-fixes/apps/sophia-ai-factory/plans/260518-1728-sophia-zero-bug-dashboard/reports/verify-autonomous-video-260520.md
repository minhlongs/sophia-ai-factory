# Verification Playbook — Autonomous Video Creation via OpenClaw on Cloudflare

**Date:** 2026-05-20
**Prod SHA:** `3a1239b1` (cycles 1-11 live)
**Question this answers:** Làm sao xác minh user có thể tạo được video tự động thông qua OpenClaw chạy chìm từ CF?

---

## What "OpenClaw chạy chìm từ CF" means here

- **OpenClaw** = the autonomous-mission orchestrator that chains 4 BYOK steps server-side.
- **Chạy chìm (silent / in-process)** = no HTTP loopback, no external worker. The Cloudflare Worker calls the in-process bridge (`callRunAutoVideoMission`) which calls land helpers directly — single subrequest, zero serialization overhead.
- **Two entry points** for the same engine:
  1. `POST /api/missions/auto-video` — Better Auth session OR OpenClaw bearer token
  2. `/auto <topic>` Telegram command (after `/pair` linking the chat to the user)

---

## Live verification — 3 reproducible commands

### V1 — Sanity: endpoint is wired and auth-gated

```bash
# Unauth — must reject with 401
curl -sI -X POST https://sophia.agencyos.network/api/missions/auto-video | head -1
# Expected: HTTP/2 401
```

```bash
# With session cookie (after login) — must reach the orchestrator
curl -s -b cookies.txt -X POST \
  -H "content-type: application/json" \
  -d '{"topic":"smoke test"}' \
  https://sophia.agencyos.network/api/missions/auto-video
# Expected (no BYOK): {"error":"BYOK_REQUIRED","message":"Script generation requires an OpenRouter key…","missionId":"…"}
# Expected (with BYOK): {"missionId":"…","script":{…},"description":{…},"video":{…},"publish":{…},"status":"succeeded"}
```

**Live audit run on 2026-05-20:** missionId `979d71ff9a66f0321fbb35fcee9688e8` returned `BYOK_REQUIRED` — proving the pipeline is reachable and the gate works.

### V2 — Audit trail: every run lands in `engine_missions`

```sql
-- Run remotely against sophia-raas-db
SELECT id, command, status, error, created_at
FROM engine_missions
WHERE user_id = '<your-user-id>'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected shape:** rows with `command = 'auto-video'`, `status` ∈ {`running`, `succeeded`, `failed`}, and `error` JSON when failed.

The orchestrator INSERTs the row with `status='running'` before the first BYOK call, UPDATEs to `succeeded` with full result JSON on completion, or `failed` with `{"code","message"}` on any step error. Every customer attempt is auditable.

### V3 — Happy-path proof (customer with BYOK keys)

When the customer completes Setup Wizard with at least an OpenRouter key, the same POST returns:

```json
{
  "missionId": "abcd…",
  "script": {
    "primary": { "language":"en", "body":"# Title\n\n…", "seoScore": 82, "suggestedTitles":[…], "wordCount": 220 },
    "secondary": { "language":"vi", "body":"# Tiêu đề\n\n…" }
  },
  "description": { "body":"…\n🔗 Resources mentioned:\n• …", "affiliateCount": 1 },
  "video": { "videoId":"…", "heygenJobId":"…", "status":"processing" },
  "publish": { "jobId":"…", "scheduledAt": 1780000000 },
  "status": "succeeded"
}
```

The `video` block only appears when a HeyGen key is also configured; otherwise the orchestrator soft-skips render and still returns script + description.

---

## Telegram path — same engine, different surface

After the customer `/pair`s their Telegram chat to their Sophia account, they can run:

```
/auto Fashion trends 2026 | lang=en | translate=vi | niche=fashion
```

The bot's webhook handler (`handleAutoVideo` in `land/openclaw-telegram/openclaw-handlers.ts`) calls the SAME `callRunAutoVideoMission` bridge function as the REST endpoint — single source of truth.

Reply on success:
```
🤖 Auto-mission hoàn tất — <missionId>
• SEO score: 82/100 (220 words)
• Suggested titles:
  1. …
  2. …
  3. …
• Affiliate links injected: 1
🎬 HeyGen render started — video <id> (job <hg_job>, status: processing)
🌐 Translated → vi (1240 chars)
📅 Scheduled <jobId> at 2026-05-20T09:00:00Z
```

Reply on missing BYOK:
```
❌ Mission thất bại (BYOK_REQUIRED): Script generation requires an OpenRouter key. Add yours in the Setup Wizard.
• Mission: <missionId>
```

---

## "Chìm" proof — running silently in-process on CF

The bridge function lives at `src/land/openclaw-telegram/openclaw-bridge.ts` and is imported directly by both the API route and the Telegram webhook. There is no `fetch()` self-call; no internal queue; no external worker. Verified by:

- `served_by_region: APAC`, `served_by_colo: HKG` on D1 metadata of the audit run — code runs at the user's edge.
- Single subrequest counter increment per mission step (R2/D1 reads), no self-fetch.
- `lib/openclaw/exchange.ts` mints bearer tokens for external programmatic callers, but the in-process path skips that round-trip entirely.

---

## What an operator should walk a new MASTER FREE100 customer through

1. **Redeem & log in.** Customer redeems FREE100 via `/free100 <email>` Telegram OR `POST /api/promo/redeem-free`. Magic link delivered within 2 min via outbox cron.
2. **Open dashboard.** `/welcome/<token>` consumes the link → Better Auth session → lands on `/dashboard` (the redirect-loop bug was fixed in 3a1239b1).
3. **Setup Wizard.** Customer enters OpenRouter key (free model `meta-llama/llama-3.1-8b-instruct:free` is sufficient) + optional HeyGen key in `/dashboard/onboarding` or `/dashboard/settings`.
4. **First autonomous run.** Either:
   - In Telegram: `/auto Fashion trends 2026`
   - From dashboard: open `/dashboard/missions/new` (or curl `/api/missions/auto-video`) with a topic.
5. **Watch the result.** Mission row appears in `/dashboard/missions` with status progression. HeyGen render polls separately (5–10 min) and surfaces in `/dashboard/videos` when ready.

If any step fails, the `engine_missions.error` JSON tells exactly which BYOK key or input is missing — no silent failures.

---

## Unresolved questions

- Should we add an in-dashboard "Run /auto demo" button that pre-fills a topic and submits the call, to remove curl from the customer's first-touch experience? Currently they must use Telegram or the SDK.
- HeyGen render polling — is there a UI surface that polls `videos.status` to surface "ready" without the customer refreshing? `/dashboard/videos/[id]` exists; verify it auto-refreshes.
- BYOK key validation at Setup Wizard time — does the wizard `verify` step actually call OpenRouter / HeyGen to confirm the key works before save? If not, the first `/auto` call is also the first key validation, and the error UX matters.
