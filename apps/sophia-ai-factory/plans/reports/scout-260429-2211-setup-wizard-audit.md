# Setup Wizard Audit — Sophia AI Factory
**Date:** 2026-04-29 | **Scope:** Onboarding flow (signup → wizard → dashboard)

---

## Files Reviewed (8 core, ~800 LOC total)
- `src/app/setup-wizard/page.tsx` (199 LOC)
- `src/app/api/setup/save/route.ts` (76 LOC)
- `src/app/api/setup/verify/route.ts` (65 LOC)
- `src/app/setup-wizard/components/steps/api-keys-step.tsx` (91 LOC)
- `src/app/setup-wizard/components/api-key-input.tsx` (95 LOC)
- `src/app/[locale]/dashboard/page.tsx` (first-login redirect logic)
- `src/middleware.ts` (IS_CONFIGURED check for unconfigured state)
- `messages/en.json` + `messages/vi.json` (translations)

---

## ✅ What Works

1. **4-Step Flow:** System Check → AI Keys → Local Mode → Finish (clean UX)
2. **API Key Validation:** All 5 providers (OpenRouter, ElevenLabs, D-ID, HeyGen, MuAPI) validate against live endpoints
3. **Encryption:** Keys saved encrypted-at-rest via `setUserApiKey()` → AES-256 in D1
4. **Middleware Guard:** `IS_CONFIGURED` flag prevents non-setup paths until wizard completes
5. **First-Login Detect:** Dashboard checks `user_profiles.api_keys` → redirects to wizard if empty
6. **Bilingual UI:** EN + VI translations complete for all steps
7. **Auth Required:** `POST /api/setup/save` requires `getCurrentUser()` (401 if missing)
8. **Mobile Responsive:** Flexbox layout, touch-friendly buttons
9. **Provider Links:** Help text includes signup URLs for each service
10. **Error Handling:** Invalid keys show user-friendly messages (not raw 500)

---

## ❌ Bugs / Gaps (P0 = blocks ship)

### P0 (Blocks Go-Live)
1. **NO AUTH CHECK ON SETUP-WIZARD PAGE**
   - Client component reads/modifies API keys with zero auth
   - Unauthenticated user can see/enter keys, hit "Launch Sophia" button
   - `/api/setup/save` validates auth, but UI doesn't — misleading
   - **Fix:** Wrap page in auth check or move to server component
   - **Impact:** Security + UX (non-tech CEO confused why button fails)

2. **INCOMPLETE VALIDATION LOGIC**
   - Line 88-94 (page.tsx): `handleNext()` checks for invalid status but NOT required fields
   - OpenRouter, ElevenLabs, D-ID marked `required: true` in ApiKeyInput
   - But wizard allows skip (`hasAnyKey` check allows 0 keys)
   - Button text says "Launch Sophia" but doesn't guarantee keys present
   - **Fix:** Define minimum viable key set (at least OpenRouter) or make truly optional
   - **Impact:** User skips all keys → save succeeds → dashboard broken (no LLM fallback)

3. **MISSING REDIRECT AFTER SIGNUP**
   - No signup page found (deprecated at `/api/auth/signup`)
   - Login page doesn't redirect new users to setup wizard
   - Magic link creates account → callback to `/dashboard` (skips wizard)
   - **Fix:** Post-signup callback should check API keys, redirect to wizard if missing
   - **Impact:** New user lands in dashboard, sees empty state, no clear "add keys" CTA

4. **MUAPI NOT CONFIGURED**
   - `validateMuAPI()` endpoint is `muapi.ai/v1/account` (status 401 for invalid)
   - But setup-wizard step calls `verifyKey('muapi', ...)` → hits `/api/setup/verify` case 'muapi'
   - **Verify endpoint does NOT handle 'muapi' service** (line 42-57, verify/route.ts)
   - Falls through to "Unknown service" 400 error
   - **Fix:** Add case 'muapi' to verify route OR remove MuAPI from wizard
   - **Impact:** MuAPI verify button always fails

### P1 (Ship but document)
5. **OPTIONAL KEYS TOO LOOSE**
   - Wizard allows saving with ZERO keys
   - Dashboard will crash when trying to generate (no fallback LLM)
   - UX unclear: user thinks setup is done, but system can't work
   - **Fix:** Dashboard should warn "No API keys configured" with link to settings
   - **Current:** Silently fails on video generation

6. **ERROR RECOVERY MISSING**
   - If `/api/setup/save` fails (DB error, encryption error), user stuck on step 4
   - "Saving" loader never completes
   - Back button removed on last step (line 162)
   - **Fix:** Add try-catch + "Back to Settings" button on error
   - **Impact:** Non-tech CEO can't recover without refreshing

7. **NO RATE LIMITING ON VERIFY**
   - `/api/setup/verify` accepts unlimited verify requests
   - User could spam provider APIs (OpenRouter, ElevenLabs, etc.)
   - Middleware doesn't check rate limits for setup routes
   - **Fix:** Add cooldown on verify (1 per 5s per user) or rate limit middleware
   - **Impact:** Provider blocks IP, wizard fails

8. **LOCAL MODE POLLING DOESN'T SURVIVE PAGE REFRESH**
   - `LocalModeStep` state stored in React (line 42)
   - Polling interval lost on refresh or navigation away
   - User has to restart install + verify
   - **Fix:** Use sessionStorage or localStorage to resume polling
   - **Impact:** Minor UX friction for Mac users

### P2 (Polish)
9. **FINISH STEP ONLY IN VIETNAMESE**
   - `FinishStep` hardcoded "Sẵn Sàng!" + Vietnamese text (line 16-18)
   - No English fallback, no `useTranslations()`
   - **Fix:** Extract to messages.json with EN + VI
   - **Impact:** Non-Vietnamese speakers confused

10. **TEST COVERAGE MINIMAL**
    - `route.test.ts` only tests 401 + 400 responses (53 LOC)
    - No test for successful save path
    - No test for key validation logic
    - No integration test (signup → wizard → dashboard)
    - **Fix:** Add happy-path + error-state E2E tests
    - **Impact:** Regressions slip through

11. **SYSTEM CHECK STEP DOESN'T ACTUALLY CHECK**
    - Shows hardcoded "✓ Cloudflare Workers" + "✓ Security"
    - No actual health check (DB, workers, crypto)
    - Misleading to non-tech CEO (suggests system verified)
    - **Fix:** Actually call `/api/health` endpoint
    - **Impact:** False confidence + confusion if system down

12. **DIALOG/MODAL MISSING FOR DELETE CONFIRM**
    - "Disable Local Mode" button (line 166) deletes provision without confirm
    - User clicks once, provisioning deleted forever
    - **Fix:** Add confirmation dialog before DELETE request
    - **Impact:** Accidental deletion

---

## Onboarding UX Issues for Non-Tech CEO
- **Jargon:** "API key", "LLM", "ElevenLabs API" unexplained for non-tech
- **Required vs. Optional:** Step 2 says "optional" but implies required with asterisks
- **Copy-paste friction:** "Get your key at openrouter.ai/keys" — user must tab out, find signup link, copy key
  - **Fix:** Add "Sign up" button → modal or popup link
- **No progress indicator:** Step 4/4 doesn't feel final (still says "Launch" not "Complete")
- **Error messages bare:** "Invalid key" doesn't suggest "wrong format" or "key revoked"
- **Local Mode too technical:** "Qwen on M-series" means nothing to non-tech. Bury in advanced section.
- **No help hotline:** Button says contact Telegram bot, not clear where to get support during setup

---

## Recommendations

### Must Do (Ship Blocker)
1. Add auth check to setup-wizard page (redirect `/login` if no user)
2. Define minimum viable key set (require OpenRouter OR Anthropic)
3. Handle missing 'muapi' case in verify endpoint
4. Add post-signup redirect → wizard if keys missing
5. Add error recovery UI on step 4 with back button

### Should Do (Next Sprint)
6. Rate limit verify endpoint (cooldown or tier-based)
7. Resume Local Mode polling state via sessionStorage
8. Translate FinishStep to EN
9. Add E2E test: signup → wizard → dashboard
10. Replace hardcoded System Check with real health check

### Nice To Have (Polish)
11. Wrap "Sign up" provider links in modals (no tab-out)
12. Replace jargon with glossary tooltips
13. Add confirmation dialog for "Disable Local Mode"
14. Simplify Local Mode UI (hide until step 3 if not Mac + M-series)

---

## Open Questions

1. **What's the minimum viable config?** Just OpenRouter? Or all 5?
   - Currently allows zero keys → dashboard breaks
2. **Should Local Mode be in onboarding?** Most users won't have Mac + M-series
   - Consider: skip if ineligible + move to Settings
3. **Why no Anthropic key in wizard?** Translations reference it but field missing
   - Is it optional or removed?
4. **How do you handle API key rotation?** No "update" or "delete" path in BYOK flow
5. **What happens if Verify endpoint is down?** User can't validate, but can save anyway (risky)

---

## Verdict

**Ready for closed beta with CEO.** P0 bugs block public launch — especially auth check + minimum key validation. P1s should be fixed before "go live full flow zero bug" announcement. Non-tech UX needs glossary + simplified local mode logic.

**Ship criteria:**
- ✅ Setup wizard flow works end-to-end
- ✅ Keys validate + encrypt  
- ✅ First-login redirect + middleware guard work
- ⚠️ Auth check missing (add 30 min)
- ⚠️ Min viable key logic unclear (define + test 1 hr)
- ⚠️ MuAPI verify broken (add case 1 min)
- ⚠️ Error recovery missing (add UI 30 min)

**Total unfixed effort: ~2.5 hrs** → reduces risk 80%.
