# Step 5 Implementation Report — Telegram Link + Beginner Templates

Date: 2026-05-12
Commit: 2dcc2e13

---

## Scout Findings

### Welcome Page
- `/src/app/[locale]/welcome/[token]/welcome-page-client.tsx` (250 LOC)
  - Has hero section + primary "Get Started" CTA + roadmap steps
  - No Telegram section existed
- `/src/app/[locale]/welcome/[token]/welcome-onboarding-steps.tsx` (108 LOC)
  - 5 informational steps, no Telegram step

### Telegram /start Handler
- Active handler: `src/tree/telegram/handlers/start-handler.ts` (24 LOC)
  - Routes: `handleStart(chatId)` — exact `/start` match only (no token)
- Webhook dispatch: `src/app/api/webhooks/telegram/route.ts` (238 LOC)
  - `if (text === '/start')` — extended to `text.startsWith('/start ')`
- Existing pairing system (`src/lib/telegram/pairing.ts`): 6-digit admin-approve flow (separate from new web flow)

### telegram_paired_chats Schema
- Columns: `chat_id TEXT PK, first_name TEXT, paired_at TEXT, paired_by TEXT NOT NULL`
- `paired_by` = user_id (per migration 0100 UNIQUE constraint)

### Video Template Registry
- File: `src/seed/templates/presets.ts` (314 LOC before changes)
- 20 presets, fields: `id, displayName, category, aspectRatio, durationSec, vibe, transitionsJson, minTier, samplePath`
- No `beginner` field existed

### Voice Preset Registry
- File: `src/seed/voices/presets.ts` (201 LOC)
- VN female voices: `linh-vi-f` (BASIC, "warm presenter"), `huong-vi-f` (PREMIUM)
- No `defaultByLocale` map exists — see Open Questions

### i18n Files
- `messages/en.json` + `messages/vi.json` — JSON (not TypeScript)
- `welcome.telegram.*` and `templates.beginnerTag.*` keys already present in HEAD (SHA 6d6ba64b committed them in previous BYOK session)

---

## Files Created / Modified

| File | LOC | Action |
|------|-----|--------|
| `migrations/0107-telegram-pairing-tokens.sql` | 17 | Created — canonical D1 migration |
| `src/seed/db/migrations/20260512_telegram_pairing_tokens.sql` | 17 | Created — source migration (guard requires both) |
| `src/tree/telegram/pairing-token-service.ts` | 80 | Created — generatePairingToken / consumePairingToken |
| `src/app/actions/generate-telegram-pairing-token.ts` | 40 | Created — Server Action (Zod-validated, auth-gated) |
| `src/app/[locale]/welcome/[token]/welcome-page-client.tsx` | +40 | Modified — Telegram CTA section added |
| `src/app/api/webhooks/telegram/route.ts` | +30 | Modified — /start <token> handler |
| `src/seed/templates/presets.ts` | +17 | Modified — beginner flag + listBeginnerTemplates |
| `src/tree/telegram/__tests__/pairing-token-service.test.ts` | 105 | Created — 6 unit tests |
| `src/app/api/webhooks/telegram/route.test.ts` | +60 | Modified — 3 new /start token tests (28 total) |

---

## New Migration

`migrations/0107-telegram-pairing-tokens.sql`:
```sql
CREATE TABLE IF NOT EXISTS telegram_pairing_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ...,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
INDEX on user_id; INDEX on expires_at
```
TTL: 1 hour. Single-use (used_at set on consume).

Run after deploy: `bash scripts/apply-migrations.sh` or manual wrangler execute.

---

## i18n Keys Added

Already in `messages/en.json` + `messages/vi.json` (committed SHA 6d6ba64b):
```
welcome.telegram.title
welcome.telegram.description
welcome.telegram.connectButton
welcome.telegram.linkedSuccess
welcome.telegram.errorTokenInvalid
welcome.telegram.errorTokenExpired
templates.beginnerTag.label
```

---

## Beginner Templates Tagged

5 templates with `beginner: true` (sorted by durationSec):
1. `brand-intro-bumper-16x9` — 5s, BASIC
2. `mkt-promo-flash-9x16` — 15s, BASIC
3. `social-hook-question-9x16` — 20s, BASIC
4. `social-before-after-9x16` — 30s, BASIC
5. `edu-tutorial-16x9` — 60s, BASIC

Added: `listBeginnerTemplates()` helper in presets.ts.

---

## Tests Added

| Test file | Tests | Result |
|-----------|-------|--------|
| `src/tree/telegram/__tests__/pairing-token-service.test.ts` | 6 | ✅ All pass |
| `src/app/api/webhooks/telegram/route.test.ts` (3 new) | 28 total | ✅ All pass |

Full test suite: **4078 passed, 32 skipped, 0 failed** (406 test files).

---

## Build / Test Status

- `npm run build`: ✅ 0 TypeScript errors (pre-existing Ecmascript warning in forest/publishing/schedule-publish.ts unrelated)
- `npm test -- --run`: ✅ 4078/4110 pass, 32 skipped (pre-existing), 0 failed
- Zero `:any` types in new code
- Migration coverage guard: ✅ passes (0107 added to both locations)

---

## Commit

`2dcc2e13 feat(telegram): pairing token + welcome page connect CTA`
(templates presets changes included in same commit)

**DO NOT PUSH** — per task scope.

---

## Open Questions

1. **Voice preset default**: No `defaultByLocale` map exists in `src/seed/voices/presets.ts`. Closest VN female voice is `linh-vi-f` (BASIC tier). Adding a default locale map was deferred — would require plumbing through TTS API and no caller currently requests "pick default by locale". Document as future work when TTS UI is built.

2. **`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` env var**: Welcome page reads `process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Sophia_Bbot'`. Needs to be set in `.env` / Cloudflare Worker secrets for custom bot usernames. Default fallback is hardcoded correctly for current prod bot.

3. **Pairing gate interaction**: New web-based pairing (token) runs BEFORE the DM-pairing gate check in route.ts. If a CEO uses `/start <token>`, the token is consumed and `telegram_paired_chats` is populated — this means they'll pass the gate on subsequent commands. Correct intended behavior.

4. **Token cleanup**: Expired tokens are never purged. Consider adding a cron job (`/api/cron`) to delete `telegram_pairing_tokens` where `expires_at < now AND used_at IS NOT NULL`. Low priority (table stays small).
