# Code Review — Founder-Prep Artifacts Wave

**Date:** 2026-05-12 06:07 UTC
**Reviewer:** code-reviewer
**Scope:** 9 files (~505 LOC code + 210 LOC docs)
**Tester baseline:** 238/238 ✅
**Verdict:** **APPROVE-WITH-FIXES**
**Score:** **8.7 / 10**

Critical: 1 (must-fix-now). Major: 2. Minor: 5.

---

## Scope

| File | Type | LOC | Risk |
|---|---|---:|---|
| `src/forest/components/support/crisp-widget.tsx` | NEW | 46 | LOW-arch / HIGH-runtime |
| `src/app/[locale]/layout.tsx` | MOD (+3 lines) | 175 | LOW |
| `src/seed/auth/better-auth-server.ts` | MOD (+2/-1) | — | LOW |
| `.env.example` | MOD (+4) | 130 | LOW |
| `package.json` | MOD (+1 script) | — | LOW |
| `scripts/founder-setup-sentry.sh` | NEW | 118 | MED |
| `scripts/capture-byok-screenshots.ts` | NEW | 131 | LOW |
| `public/byok-guide/README.md` | MOD | 29 | LOW |
| `docs/handover/founder-dns-and-inbox-drill-checklist-260512.md` | NEW | 210 | LOW |

Focus axes per request: architecture, security, robustness, YAGNI/KISS/DRY, founder UX, edge cases.

---

## 🔴 CRITICAL (1) — must land before founder runs setup

### C-1. Crisp widget silently fails — CSP blocks `client.crisp.chat`
**File:** `src/seed/security/content-security-policy-configuration.ts` (not in diff but downstream impact) × `src/forest/components/support/crisp-widget.tsx`
**Severity:** Critical (blocking the very feature this wave delivers)

The widget injects a `<script src="https://client.crisp.chat/l.js">` into `document.head`. Project ships a nonce-based CSP (`src/middleware.ts:46` → `buildCSPHeader(nonce)`). Current `cspConfig.scriptSrc` is `["'self'"]` + `'nonce-{hex}'`. Result:
- Production browser will throw `Refused to load script 'https://client.crisp.chat/l.js' because it violates the following Content Security Policy directive: "script-src 'self' 'nonce-…'"`.
- `connect-src` whitelist also missing `wss://client.relay.crisp.chat` (WebSocket Crisp uses for chat) and `https://*.crisp.chat`.
- `frame-src` / `img-src` also need crisp domains (`game.crisp.chat`, `image.crisp.chat`). `img-src` is `https:` so images are fine; frames are restricted to YouTube.
- Tester didn't catch this because tests don't exercise CSP-in-browser. Vitest unit tests pass — but the widget is DOA in production.

**Fix (recommended; not committed per review-only rule):**
```ts
// src/seed/security/content-security-policy-configuration.ts
scriptSrc: [
  "'self'",
  ...(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ? ['https://client.crisp.chat'] : []),
  ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-eval'"]),
],
connectSrc: [
  "'self'",
  // ...existing...
  ...(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID
    ? ['https://client.crisp.chat', 'wss://client.relay.crisp.chat', 'https://storage.crisp.chat']
    : []),
],
frameSrc: [
  "'self'",
  'https://www.youtube.com',
  ...(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ? ['https://game.crisp.chat'] : []),
],
```
Gating on the env var keeps CSP tight when the founder hasn't enabled Crisp yet.

**Alternative (simpler):** unconditionally allow `https://client.crisp.chat` + `wss://client.relay.crisp.chat`. Acceptable trade-off (first-party Crisp, low XSS surface).

Until C-1 lands, the widget is purely cosmetic (silently blocked). The welcome email + checklist both *advertise* the live-chat bubble (`better-auth-server.ts:185`, `founder-dns-and-inbox-drill-checklist-260512.md:138`) — broken promise to the user.

---

## 🟡 MAJOR (2)

### M-1. Sentry script: 6 `wrangler secret put` calls share no atomicity / rollback
**File:** `scripts/founder-setup-sentry.sh:67-72`

`set -euo pipefail` is correct, but if the 4th `push_secret` fails the founder is left in a half-configured state with 3 secrets present, 3 missing. Re-running the whole script overwrites — fine — but `deploy:full` runs after the loop and will deploy with whatever subset was pushed. Founder might not understand they need to retry from the failed point.

**Recommendation:** Add a pre-flight check (`npx wrangler whoami` before any `secret put`) and after the push loop a verification step:
```bash
echo "▶ Verifying all 6 secrets registered..."
npx wrangler secret list --name sophia-ai-factory | tee /tmp/sophia-secrets.txt
for v in NEXT_PUBLIC_SENTRY_DSN SENTRY_DSN SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT SLACK_OPS_WEBHOOK_URL; do
  grep -q "\"$v\"" /tmp/sophia-secrets.txt || { echo "[ERROR] $v not persisted — re-run script"; exit 1; }
done
```
Cheap, prevents the "partial config + deploy" foot-gun.

### M-2. Sentry script `[WARN]` on DSN/Slack mis-pattern but continues — undermines validation
**File:** `scripts/founder-setup-sentry.sh:50-55`

Two regex checks log `[WARN]` and **continue anyway**. For a non-tech founder this defeats the purpose — if they paste their *Sentry org slug* into the DSN field by accident, the script will happily push garbage as a secret and waste a deploy cycle.

**Recommendation:** Either prompt to retry, or fail-hard with explicit instructions. Suggest fail-hard for the DSN (highest-value validation) and keep warn-only for Slack (URL formats vary across workspaces):
```bash
if [[ ! "$PUBLIC_DSN" =~ ^https://[A-Za-z0-9]+@o[0-9]+\.ingest(\.[a-z]+)?\.sentry\.io/[0-9]+$ ]]; then
  echo "[ERROR] DSN format invalid. Expected https://<key>@oNNN.ingest.sentry.io/NNN" >&2
  echo "  → re-copy from Sentry → Settings → Client Keys (DSN). First section only." >&2
  exit 1
fi
```

---

## 🟢 MINOR (5) — defer-able

### m-1. `crisp-widget.tsx` cleanup is incomplete
**File:** `src/forest/components/support/crisp-widget.tsx:37-42`
Cleanup removes the `<script>` tag but leaves `window.$crisp` / `window.CRISP_WEBSITE_ID` set and the Crisp runtime DOM (iframes, chat bubble) intact. In SPA navigation Next.js may not unmount root-layout children, so this is rarely hit — but if a test or hot-reload triggers unmount, residual globals will prevent re-mount (line 27 guards `if (w.$crisp) return`).

Fix:
```ts
return () => {
  existing?.remove();
  delete (w as Record<string, unknown>).$crisp;
  delete (w as Record<string, unknown>).CRISP_WEBSITE_ID;
};
```

### m-2. `crisp-widget.tsx` deps array `[]` ignores env-var change at runtime
Env vars are baked in at build time for `NEXT_PUBLIC_*` — so this is effectively dead concern. Document it inline (1-line comment) instead of fixing.

### m-3. `buildWelcomeHtml` interpolates `${name}` un-escaped
**File:** `src/seed/auth/better-auth-server.ts:178` (PRE-EXISTING — not introduced by this wave)
Names like `<script>` or `O'Brien` would break the email markup or in theory enable HTML-injection in transactional mail. Low risk (Better Auth user.name is server-controlled at signup), but worth noting since you're auditing this file anyway.

Quick mitigation (1-line helper):
```ts
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// then: <p>Hi ${esc(name)},</p>
```
Apply same to `buildMagicLinkHtml` if applicable. Defer to a hardening pass — not blocking.

### m-4. `capture-byok-screenshots.ts` — Playwright assumption + brittle selectors
**File:** `scripts/capture-byok-screenshots.ts:25,108`
- Imports `from '@playwright/test'` for `chromium` — works but `playwright` (non-test) package is the conventional source. The test framework re-exports it; fine for a one-shot script.
- `hideSelectors` are heuristic — when targets miss, the screenshot still captures the banner. Per-target try/catch is present (line 79-85: `page.evaluate` is awaited in the loop body but a single failing selector aborts that target's hide phase). The outer per-target try/catch at line 111-116 saves the run, but the lost provider PNG must be re-captured manually. **README already documents this** (`public/byok-guide/README.md:24`) — acceptable.

### m-5. DNS checklist — non-tech accessibility
**File:** `docs/handover/founder-dns-and-inbox-drill-checklist-260512.md`
Generally clear, well-structured, bilingual-aware (Section C.3 mentions VI in subject line). Two micro-nits:
- Section A uses `dig` commands assuming the founder has it (macOS yes, Windows native no). Add 1 line: "Windows: install via `winget install BIND.BIND`, or use https://dnschecker.org as web alternative".
- Section C.4 "Time to inbox" cell — unclear unit. Suggest "(seconds)" suffix.

---

## ✅ Positive observations

- **Architecture compliance ✅** — `crisp-widget.tsx` in `forest/components/support/` is correct (forest = reusable infra components, peer of `guide/`, `dev/`, `providers/`). No banned imports. Single React import.
- **Secrets handling ✅** — Sentry script uses `printf '%s' "$value" | npx wrangler secret put`, NEVER `echo "$VALUE"` — survives values with `\n`, `%s`, or leading dashes. Best practice.
- **Email static content ✅** — The added bilingual sentence (`better-auth-server.ts` diff lines) is fully static, no user-input concatenation in the new code.
- **Dynamic import in layout ✅** — `next/dynamic` keeps Crisp out of the critical bundle; widget is lazy-loaded and SSR-skipped via 'use client' on the inner component.
- **CF-direct doctrine respected ✅** — Sentry script uses `npm run deploy:full` + SHA verify via `/api/version` (matches `sophia-deploy-verify.md`). No `gh run list`. No "Vercel auto-deployed" hallucination.
- **YAGNI/KISS ✅** — Crisp widget is 46 LOC, single responsibility, no abstraction layer. Sentry script is linear, no functions beyond `push_secret`. BYOK script has minimal config and graceful per-target failure.
- **Founder UX ✅** — Sentry prompts use numbered "1/6 … 6/6" + sensible defaults for org/project slugs. DNS checklist has pass/fail examples for each `dig` output.

---

## 📋 Recommended actions

**Land NOW (≤ 30 min):**
1. **[C-1]** Patch `content-security-policy-configuration.ts` — add Crisp domains to `script-src` + `connect-src` (env-gated). Without this, the live-chat feature is unreachable in production despite shipping. **This is the only blocker.**
2. **[M-2]** Sentry script: fail-hard on DSN regex mismatch (4 lines, big UX win).

**Defer to next wave:**
3. **[M-1]** Sentry script atomicity / secret-list verification.
4. **[m-1]** Crisp cleanup: nullify globals.
5. **[m-3]** HTML-escape `${name}` in welcome / magic-link templates (pre-existing tech debt, not this wave's regression).
6. **[m-5]** DNS checklist Windows fallback note.

Items m-2, m-4 → no action needed (documented or non-issue).

---

## 📈 Metrics

- Type coverage: ✅ no `:any` added. `CrispGlobals` interface uses `unknown[]` for `$crisp` (correct).
- Banned imports: 0 (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate` not present in any new file).
- Console.log in production code: 0 (script `console.log` in `capture-byok-screenshots.ts` is acceptable — it's a CLI tool, not bundled into the worker).
- Crisp first-party only: ✅ (no third-party CDN, single script src).
- Tester baseline: ✅ 238/238.

---

## ❓ Unresolved questions

- Has Crisp been load-tested against the existing PostHog + Sentry browser footprint? Three observability scripts on every page may exceed 200 KB combined.
- Does `NEXT_PUBLIC_CRISP_WEBSITE_ID` get set via `wrangler secret put` or via `wrangler.toml` `vars`? `NEXT_PUBLIC_*` must be inlined at **build time**, so a Cloudflare runtime secret won't work — needs to be in `.env` at `npm run build` or in `wrangler.toml [vars]`. The Sentry script handles 6 secrets but Crisp ID isn't in that script — verify the founder runbook covers Crisp activation.
- `m-3` (un-escaped `${name}`): file owner — is the welcome HTML escape gap tracked already, or should this open a new ticket?

---

**Score breakdown:** Architecture 10/10 · Security 7/10 (CSP miss) · Robustness 8/10 · YAGNI/DRY 10/10 · Founder UX 9/10 · Edge cases 8/10 → **8.7 / 10**

C-1 alone is the only blocker; everything else can ship as-is or in a follow-up. With C-1 patched (env-gated CSP allow-list), this wave is a clean **APPROVE**.
