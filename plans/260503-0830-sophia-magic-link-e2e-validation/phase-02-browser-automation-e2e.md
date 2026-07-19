# Phase 02 — Browser Automation E2E

## Context Links
- Magic-link URL from Phase 01 (`https://sophia.agencyos.network/vi/welcome/<token>`)
- Welcome page client: `apps/sophia-ai-factory/src/app/[locale]/welcome/[token]/welcome-page-client.tsx`
- Validate route: `apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/route.ts`
- Setup-wizard layout: `apps/sophia-ai-factory/src/app/setup-wizard/layout.tsx`
- Skill: `~/.claude/skills/chrome-devtools/SKILL.md` (Puppeteer wrapper)

## Overview
- Priority: P1 (BLOCKER for go-live verdict)
- Status: pending
- Description: Drive a real Chrome instance through the magic-link → POST validate → setup-wizard flow on PROD; capture cookies, redirects, and final HTTP status.

## Key Insights
- The welcome page client (`welcome-page-client.tsx`) auto-POSTs to `/api/welcome/validate/[token]` then redirects to `/setup-wizard`. We do NOT need to click anything — just navigate to the magic-link URL and wait for redirect-chain to settle.
- `__Secure-` prefix cookies are non-readable from JS (HttpOnly), so cookie inspection MUST come from `page.cookies()` Puppeteer API, not `document.cookie`.
- Chrome on macOS defaults to **headed** per skill config — fine for local dev validation; CI run not required for this phase (see Phase 05 for CI-friendly test).

## Requirements
**Functional**
- Navigate magic-link URL with empty cookie jar
- Capture all `Set-Cookie` headers from `/api/welcome/validate/<token>` response
- Assert cookie `__Secure-better-auth.session_token` exists with attributes `Path=/; HttpOnly; Secure; SameSite=Lax`
- Follow auto-redirect to `/setup-wizard`
- Assert final response `HTTP 200` and DOM contains setup-wizard form selector (e.g., input for OpenRouter API key)

**Non-functional**
- Repeatable — pristine Chrome user-data-dir per run
- Saves screenshot on fail (for debugging)

## Architecture
```
scripts/e2e/run-magic-link-browser-test.mjs
  ├── puppeteer.launch({ userDataDir: tmp })
  ├── page.goto(magicLinkUrl)
  ├── wait for redirect → /setup-wizard
  ├── page.cookies() → assert __Secure-better-auth.session_token
  ├── page.url() === '/setup-wizard' (no further /login redirect)
  ├── page.$('[data-testid="setup-wizard-form"]') !== null
  └── exit(0) on PASS / exit(1) + screenshot on FAIL
```
Output JSON to stdout for Phase 03/04 ingestion.

## Related Code Files
**To create**
- `apps/sophia-ai-factory/scripts/e2e/run-magic-link-browser-test.mjs` — Puppeteer driver

**To inspect (read-only)**
- `src/app/setup-wizard/page.tsx` — confirm a stable `data-testid` selector exists; if not, document required selector for code-owner to add (no source edit in this plan)

## Implementation Steps
1. Locate `chrome-devtools` skill scripts at `~/.claude/skills/chrome-devtools/scripts/` — reuse `lib/browser.js` resolver if present, else direct `puppeteer` import.
2. Read `setup-wizard/page.tsx` and identify a stable selector (`data-testid` preferred). If missing, note as Phase-02 blocker and request a 1-line code addition (still in scope as a "selector hardening" mini-fix — keeps regression test stable).
3. Write `run-magic-link-browser-test.mjs`:
   - Accept magic-link URL via `process.argv[2]`
   - Launch Puppeteer with fresh `userDataDir`
   - `page.on('response')` — log status + Set-Cookie for any URL matching `/api/welcome/validate/`
   - `await page.goto(url, { waitUntil: 'networkidle0' })`
   - `await page.waitForFunction(() => location.pathname.includes('/setup-wizard'), { timeout: 15_000 })`
   - Snapshot cookies via `page.cookies()`
   - Assert: setup-wizard selector visible
   - Output JSON: `{verdict: 'PASS'|'FAIL', cookies: [...], finalUrl, statusChain: [...], screenshot?: 'path'}`
4. Run from terminal: `node scripts/e2e/run-magic-link-browser-test.mjs "$MAGIC_LINK_URL"`
5. On FAIL: save screenshot to `plans/260503-0830-sophia-magic-link-e2e-validation/reports/fail-screenshot.png`

## Todo List
- [x] Confirm `setup-wizard/page.tsx` has stable selector — added `data-testid="setup-wizard-root"` (1-line surgical edit)
- [x] Implement `run-magic-link-browser-test.mjs` — includes button click logic (welcome page requires user click, not auto-POST)
- [x] Test against URL produced by Phase 01 — PASS
- [x] Capture Set-Cookie chain in output JSON — `__Secure-better-auth.session_token` confirmed HttpOnly; Secure; SameSite=Lax
- [x] On FAIL: first run failed (no button click) → screenshot saved, root cause identified, test updated to click button → PASS on re-run

## Success Criteria
- Browser test exits with code 0
- Output JSON contains `verdict: 'PASS'` and `cookies[].name === '__Secure-better-auth.session_token'`
- `finalUrl === 'https://sophia.agencyos.network/setup-wizard'` (NOT `/login`)
- DOM contains setup-wizard form

## Risk Assessment
- **R1:** Puppeteer not installed → mitigation: skill ships with bundled `node_modules`; pre-flight check `require('puppeteer')` and instruct `npm i puppeteer` in skill dir if missing
- **R2:** Welcome page does NOT auto-post (depends on user click) → mitigation: read `welcome-page-client.tsx`; if click required, simulate via `page.click()`. If button is hidden behind translation key, fall back to direct fetch+`document.cookie` shim
- **R3:** Cloudflare bot detection blocks Puppeteer → mitigation: set realistic UA + viewport; PROD WAF rules don't block standard Puppeteer (verified for sophia.agencyos.network in past audits)
- **R4:** Test token expires mid-test (1h TTL) → mitigation: re-run Phase 01 seed if Phase 02 takes >55m

## Security Considerations
- Browser uses fresh `userDataDir` — no credential carryover from developer's main profile
- Test runs against PROD with synthetic test user (Phase 01 ensured email is non-routable)
- Token is single-use (`consumeMagicLink` clears it on POST) — token cannot be reused by an attacker even if logs leak

## Next Steps
- Phase 03 starts `wrangler tail` BEFORE Phase 02 click
- Phase 04 consumes Phase 02 output JSON if FAIL
