# Code Review — Go-Live Bundle (BYOK + Video + Wizard)

Date: 260429-2211 | Reviewer: code-reviewer | Tip: 239fd4ba (uncommitted diff)
Verification: `tsc --noEmit` 0 errors | `vitest` 56/56 pass on impacted suites

## Score: 8.0/10

Solid coordinated 3-agent fix. Tier gate correct, rate-limit ordered properly,
TS clean, tests cover all 4 tiers. Two real holes in wizard redirect logic +
one HeyGen retry-storm concern. None block initial ship to NEW signups, but
ALL existing users get rerouted to wizard on next login (UX regression).

## Blockers (P0 — must fix before merge)

- **Existing users force-redirected to wizard** — `src/middleware.ts:135-138`.
  `wizard_done` cookie is ONLY set by `/api/setup/save` POST. Any user who
  signed up before this change has no cookie → first hit on `/dashboard` →
  bounced to `/setup-wizard`. Fix: in wizard `layout.tsx` or `page.tsx`, call
  `listUserApiKeyProviders(user.id)` — if has openrouter|anthropic, set
  `wizard_done` cookie and `redirect('/dashboard')`. Alternative quick fix:
  on login success, set `wizard_done=1` if user already has any BYOK key.

## High (P1 — should fix this batch)

- **Wizard redirect path scope too narrow** — `src/middleware.ts:136`.
  Check is `cleanPath === '/dashboard'` exact only. User who deep-links to
  `/dashboard/byok`, `/dashboard/settings`, `/dashboard/affiliate-discovery`
  bypasses wizard entirely. Either widen to `cleanPath.startsWith('/dashboard')`
  with `&& cleanPath !== '/setup-wizard'` guard, OR document this is intentional
  ("wizard only enforced from root dashboard entry").

- **HeyGen webhook 503 may trigger retry storm** —
  `src/app/api/webhooks/heygen/route.ts:64`. HeyGen retries 5xx aggressively
  (per their docs, exponential backoff up to 24h). If `HEYGEN_WEBHOOK_SECRET`
  missing in prod, every callback hits 503 → retried for hours. Safer:
  return 200 with `{ ok: true, mode: 'cron-fallback' }` and log warn. Cron
  poll handles state anyway, so HeyGen needn't retry.

- **`wizard_done` cookie can be deleted client-side** —
  `src/app/api/setup/save/route.ts:81`. HttpOnly + SameSite=Lax + Secure (prod)
  is correct, BUT user can clear cookies via DevTools → forced back to wizard.
  Acceptable per design decision in fullstack report ("they land on wizard,
  can skip via Settings link") — but Settings link must exist on wizard.
  Verify FinishStep or wizard chrome has "Skip / Go to dashboard" option.
  If not, this is a UX trap.

## Medium / Polish

- **Module-level cache in CF Workers — cross-user leak risk theoretical** —
  `src/app/api/heygen/avatars/route.ts:5`. Avatars/voices lists from HeyGen
  are GLOBAL (not per-user) so OK in practice. But comment "best-effort"
  understates: if isolate is reused across orgs/tiers, returns same data,
  which IS the desired global cache. Just rename comment to "shared global
  cache, isolate-bound" so future readers don't worry.

- **MuAPI verify is no-op** — `src/app/api/setup/verify/route.ts:60`.
  Returns `{ valid: true, verified: false }` always — no format check at all.
  At minimum check `key.length >= 20`. Currently empty string passes.

- **Anthropic regex too loose** — `src/app/api/user/byok/route.ts:30`.
  `/^sk-ant-[A-Za-z0-9_-]{20,}$/` accepts `sk-ant-` + 20 chars; real keys
  are `sk-ant-api03-...` ~108 chars. Tighten to `/^sk-ant-api\d{2}-[\w-]{50,}$/`
  or accept that loose pattern is intentional for forward compat.

- **Pre-existing TS error in `setup/save/route.ts:55` was fixed implicitly**
  by wizard agent (replaced `.errors` → `.issues`). BYOK report flagged it
  as out-of-scope but wizard agent owned the file and silently fixed it.
  Good outcome, but call it out so reviewer knows it's resolved.

- **BYOK `heygen` orphan in `ByokProvider` union** —
  `src/lib/byok/user-api-key-store.ts:16`. Doc comment clarifies "server-managed",
  but admin page filters it out (`page.tsx:25`). Old wizard users may have
  `heygen` row in `user_api_keys` that's now invisible AND unreachable
  (route.ts enum rejects it). They can't see/delete it. Add a one-shot
  D1 cleanup migration `DELETE FROM user_api_keys WHERE provider='heygen'`
  OR keep heygen in admin form but mark "deprecated, will be removed".

## Approved Aspects

- Rate-limit rule ordering correct: `/api/user/byok/*` (admin tier) inserted
  BEFORE `/api/*` catch-all — lookup is first-match wins.
- Tier gate uppercase casing matches Sophia rule (`BASIC|PREMIUM|ENTERPRISE|MASTER`).
- `getUserTier` fail-safe returns `'BASIC'` on null/error → blocks lookup
  failure (correct — no free video for misconfigured users).
- All 4 tier branches covered in tests (BASIC blocked + 3 allowed).
- Layout-level auth check (`layout.tsx:18`) catches unauthenticated users
  BEFORE the page renders any input — magic-link flow safe.
- Zod `.superRefine` field-level errors propagate cleanly to UI.
- Cookie flags correct: HttpOnly + Lax + Secure-in-prod + 1yr Max-Age.
- Tests for happy paths + regressions (heygen rejection, openrouter/anthropic
  required, wizard_done cookie set).

## Cross-Agent Consistency

| Concern | Status |
|---------|--------|
| heygen DB type kept (`ByokProvider`) | OK — back-compat for heygen-client.ts |
| heygen removed from wizard + admin form | OK |
| muapi added wizard + admin + verify | OK |
| anthropic added wizard + admin + verify | OK |
| msg files updated en.json + vi.json | OK (`heygen` only remains in unrelated `heygenJob` analytics key) |
| Orphan: existing user `heygen` keys in D1 | **NOT HANDLED** — see Medium #5 |

## Verdict: REQUEST CHANGES

P0 (existing-user wizard rerouting) is a hard UX regression that will hit
EVERY previously-onboarded user on next visit. Quick fix: in
`setup-wizard/layout.tsx` after auth check, query `listUserApiKeyProviders`,
if user has `openrouter` or `anthropic` → set `wizard_done` cookie and
redirect to `/dashboard`. ~10 lines of code. Without this, "go live full flow
zero bug" goal is not met for the existing user base.

P1 webhook 503 should also flip to 200 before public HeyGen webhook is wired —
otherwise first prod outage of secret causes retry-storm bills.

After P0 fix + webhook 503 → 200 flip, re-review = APPROVE.

## Unresolved Questions

- Does the wizard chrome have a "Skip to dashboard" link visible from any step?
  Couldn't find one in diff. If absent, P1 cookie-deletion concern becomes P0.
- Should `getUserTier` returning 'BASIC' on D1 unavailable block video creation
  silently, or should we 503 with "tier unknown, retry"? Current behavior
  silently degrades — fine for security, but UX for paying user during D1 hiccup
  is "your tier is wrong, upgrade". Consider distinguishing "DB error" vs "BASIC".
