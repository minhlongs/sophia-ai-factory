# Incident Playbook — Failure → Command Mapping

> **Companion to `handover-decision-tree.md`.** That doc is intent-first ("what do I want to do"). This doc is **failure-first** ("X is broken — what do I run").
> **Scope:** Smoke test through post-launch. Covers operator + maintainer incidents.

---

## Severity Legend

| Tag | Meaning | Response time |
|-----|---------|---------------|
| 🚨 **P0** | Production down OR data loss risk | Drop everything |
| ⚠️ **P1** | User-facing feature broken, workaround exists | Fix within hours |
| ⚡ **P2** | Internal friction, no customer impact | Fix within day |
| 💭 **P3** | Cosmetic / nice-to-fix | Triage weekly |

---

## A. Smoke Test Incidents (Phase 05)

### A1 — Setup Wizard rejects API key (red ❌)

⚡ **P2** · Operator-only · Common

**Symptom:** Paste key in wizard, get red ❌ "Invalid key" toast

**Diagnose:**
1. Recheck key format (OpenRouter: `sk-or-v1-`, ElevenLabs: `xi-`, etc — per procurement doc)
2. Test key directly via `/api/user/byok/test` endpoint OR curl provider's `/v1/models`
3. Check provider dashboard — was key revoked? Quota exhausted?

**Commands:**
- Plain text: `"My OpenRouter key fails wizard validation. Format is sk-or-v1-... and length is 64 chars."`
- Claude inferred command: `/debug byok validation` (will trace `validateApiKey()` in `tree/byok/`)

**Recovery:** Generate new key from provider dashboard → retry

---

### A2 — Telegram bot không reply `/campaign`

⚠️ **P1** · Operator-only · Common

**Symptom:** Send `/campaign` to @Sophia_Bbot, no reply for 30s+

**Diagnose:**
1. Bot online? Check `https://t.me/Sophia_Bbot` profile
2. Webhook bound? `curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
3. Last error? `npx wrangler tail` (in apps/sophia-ai-factory) — filter "telegram"

**Commands:**
- `/debug telegram webhook` — trace webhook handler at `src/app/api/webhooks/telegram/route.ts`
- Plain text: `"Telegram bot stopped responding. Last successful message was [time]. Webhook info shows [paste]"`

**Recovery:**
- Re-bind webhook: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://sophia.agencyos.network/api/webhooks/telegram"`
- Or via dashboard: `/dashboard/integrations/telegram` → click "Re-link"

---

### A3 — Video stage hang > 10 minutes (Stage 3 visual)

⚠️ **P1** · Operator-only

**Symptom:** Mission stuck at `🎥 Video rendering...` past 10 min

**Diagnose:**
1. Provider queue backed up? Check D-ID/HeyGen status page
2. Cost ledger entry? Mission dispatched but no provider call?
3. Hung worker? `npx wrangler tail` filter "video"

**Commands:**
- `/debug video pipeline mission msn_XXX` (substitute mission ID)
- `/scout heygen webhook handler` — if HeyGen, verify webhook bound

**Recovery:**
- Cancel mission via dashboard `/dashboard/missions/msn_XXX` → "Cancel"
- Restart Campaign 1 with same topic
- If repeat hang → file bug, defer Campaign 2/3

---

### A4 — NOWPayments IPN webhook never fires

🚨 **P0** for production · ⚠️ **P1** in smoke (staging)

**Symptom:** Customer paid, tier not activated. No IPN POST received.

**Diagnose:**
1. IPN URL correct in NOWPayments dashboard? Must point to `/api/webhooks/nowpayments`
2. IPN secret matches Sophia env var `NOWPAYMENTS_IPN_SECRET`
3. Check `wrangler tail` for the POST attempt — was it received? rejected? auth-failed?

**Commands:**
- `/debug nowpayments ipn` — trace handler at `src/app/api/webhooks/nowpayments/`
- Plain text: `"Customer X paid $60 at [time]. Tier still BASIC. No IPN in wrangler tail."`

**Recovery:**
- Manual tier grant via admin script (if exists)
- Worst case: SQL update D1 `user_subscriptions` directly with audit trail
- ALWAYS document manual grants in `plans/incidents/`

---

## B. Deploy Incidents (Phase D)

### B1 — `npm run deploy:full` exits with "uncommitted changes"

⚡ **P2** · Maintainer · Common

**Symptom:**
```
❌ Refusing to deploy: uncommitted changes in working tree.
```

**Diagnose:**
- `git status` shows file mods
- OR file mode changes (chmod drift)
- OR newline endings drift

**Commands:**
- `git status --short` — confirm scope
- `git diff-index HEAD --` — what diff-index sees

**Recovery:**
- Commit relevant changes: `git add <path>; git commit -m "..."`
- Stash transient: `git stash`
- Emergency bypass: `ALLOW_UNPUSHED_DEPLOY=1 npm run deploy:full` (use sparingly, document reason)

---

### B2 — `npm run deploy:full` exits with "X commits ahead of origin"

⚡ **P2** · Maintainer · Common after local commit

**Symptom:**
```
❌ Refusing to deploy: 1 commit(s) on HEAD but not on origin/main.
```

**Diagnose:** Local commit not pushed. Doctrine 2026-05-15: push BEFORE deploy.

**Commands:** No slash needed.

**Recovery:**
```bash
git push origin main && git push gitlab main
npm run deploy:full
```

---

### B3 — CF API 502 during deploy (`wrangler secret put` fails)

⚡ **P2** · Maintainer · Rare

**Symptom:**
```
✘ [ERROR] Received a malformed response from the API
PUT .../secrets -> 502 Bad Gateway
```

**Diagnose:** Cloudflare API transient outage. NOT a code issue.

**Commands:** No slash needed. Retry is built in (commit `e3f22c36` added 3-attempt exponential backoff).

**Recovery:**
- Wait 30s, retry `npm run deploy:full`
- If 3 attempts ALL fail → check https://www.cloudflarestatus.com
- Last resort: deploy at later hour

---

### B4 — Deploy completes but SHA mismatch on `/api/version`

🚨 **P0** · Maintainer · Catastrophic if undetected

**Symptom:**
```
$ curl https://sophia.agencyos.network/api/version
{"shortSha":"OLD_SHA",...}
$ git rev-parse HEAD | cut -c1-8
NEW_SHA
```

**Diagnose:** Wrangler deployed bundle, but secret injection (commit SHA) didn't propagate OR cached old worker is still routing.

**Commands:**
- `/debug deploy sha mismatch` — trace `/api/version` route at `src/app/api/version/route.ts`
- `npx wrangler tail` — watch incoming requests, see which worker version handles them

**Recovery:**
- Re-run `npm run deploy:full` (rebuilds + reinjects)
- If still mismatch after 2 deploys → `npx wrangler rollback --name sophia-ai-factory --yes` and re-investigate
- File P0 incident report in `plans/incidents/`

---

### B5 — Pre-push hook FAILS (G1/G2/G3/G4/G5)

⚠️ **P1** · Maintainer · Common during dev

**Symptom:** `git push origin main` exits 1 with hook failure message

**Diagnose by gate failure:**

| Gate | Failure means | Fix |
|------|---------------|-----|
| **G1 typecheck** | TS errors exist | `npm run ci:typecheck` → find errors → fix → recommit |
| **G2 lint(340)** | New warnings introduced | `npm run lint` → find → fix OR rebaseline if intentional |
| **G3 test** | Test failed | See B6 (flaky test) below OR `/debug <test name>` |
| **G4 secrets** | secretlint found leak | Inspect output, remove secret, add to `.secretlintignore` if false positive |
| **G5 audit** | `npm audit` HIGH found | Update vulnerable dep OR document tolerable risk |

**Commands:**
- `/cook fix <gate failure>` for code fixes
- Plain text: `"Pre-push G2 lint fails with [count] warnings"` for diagnosis

**Recovery:** Fix root cause + recommit. NEVER `--no-verify` unless documented emergency.

---

### B6 — Pre-push G3 test FLAKES (passes locally, fails on push)

⚡ **P2** · Maintainer · Fixed 2026-05-17 (commit `4897bcb0`)

**Symptom:** Local `npm test` 4431/4431. Pre-push reports 1 failure intermittently.

**Diagnose:** Singleton state leak across test files. Most common = `globalRateLimiter`. Confirmed root cause fixed in commit `4897bcb0` via `globalRateLimiter.clear()` in `src/test/setup.tsx beforeEach`.

**Commands:**
- If recurs: `/debug flaky vitest test setup.tsx`
- Capture verbose: `npx vitest run --reporter=verbose 2>&1 | tee /tmp/flake.log`

**Recovery:**
- Retry push (often passes on 2nd try)
- If recurs systematically → identify new singleton leak, add to setup.tsx clear list

---

## C. Production Incidents (Phase E)

### C1 — Production HTTP 5xx spike (>1% requests)

🚨 **P0** · Maintainer · Customer-facing

**Symptom:** Cloudflare Analytics dashboard shows 5xx percentage climbing OR customer reports of broken pages

**Diagnose:**
1. `npx wrangler tail` — live error stream
2. Sentry dashboard (if SENTRY_AUTH_TOKEN set) — symbolicated stacks
3. Check recent deploys — was current SHA freshly deployed?

**Commands:**
- `/debug production 5xx` — Claude pulls recent error patterns
- `/scout <error message pattern>` — find code path

**Recovery:**
- If recent deploy caused it: `npx wrangler rollback --name sophia-ai-factory --yes`
- If config issue: identify env var / secret, fix in CF dashboard, no redeploy needed
- If hot bug: `/cook fix <specific bug>` → deploy hotfix

---

### C2 — D1 query timeouts

⚠️ **P1** · Maintainer · Performance

**Symptom:** API endpoints return after 5s+ OR D1 quota exhausted

**Diagnose:**
1. Check D1 dashboard for query patterns
2. Run `scripts/verify-d1-backup.sh` to inspect schema state
3. Recent migrations? `git log -- migrations/`

**Commands:**
- `/scout slow d1 query` — find candidates
- `/debug d1 timeout endpoint <name>` — trace specific route

**Recovery:**
- Add index (write migration, apply via `bash scripts/apply-migrations.sh`)
- Cache hot read via D1 KV-fronted pattern
- Worst case: paginate / restrict query scope

---

### C3 — `/api/version` returns stale SHA (post-deploy)

⚠️ **P1** · Maintainer · Symptoms of B4

**Symptom:** Local commit pushed + deployed, but `/api/version` shows OLD SHA hours later

**Diagnose:**
- Worker bundle on CF didn't update — wrangler may have soft-failed silent
- Cache layer between user + worker (Cloudflare edge cache) holding old response

**Commands:** Same as B4. Plus:
- `curl -H "Cache-Control: no-cache" https://sophia.agencyos.network/api/version` — bypass cache
- Compare bundle hash via `npx wrangler deployments list --name sophia-ai-factory`

**Recovery:** Redeploy. If repeat → wrangler config audit.

---

### C4 — Customer reports "video generation failed" with specific mission ID

⚠️ **P1** · Customer-facing

**Symptom:** Support email / Telegram: "My mission msn_XXX never finished"

**Diagnose:**
1. Inspect mission in dashboard: `/dashboard/missions/msn_XXX` (admin view)
2. Check provider event log — which stage failed?
3. Check user's BYOK keys — quota exhausted? key revoked?

**Commands:**
- `/debug mission msn_XXX` — Claude traces dispatcher → handler chain
- `/scout mission stage handler video.<failed_stage>`

**Recovery:**
- If provider issue (customer-side): respond with provider dashboard link + diagnosis
- If Sophia bug: `/cook fix <specific stage>` → deploy → notify customer
- ALWAYS refund credits on Sophia-side failure (precedent matters for trust)

---

### C5 — NOWPayments tier auto-charge failed (customer banked)

🚨 **P0** for affected customer · ⚠️ **P1** trend

**Symptom:** Trial day 8: should auto-charge $60. Customer dashboard shows "tier expired" not "growth active"

**Diagnose:**
1. Check `user_subscriptions` D1 table state
2. NOWPayments dashboard — was charge initiated? declined?
3. IPN webhook log — was confirmation received?

**Commands:**
- `/debug nowpayments trial conversion <user_id>` — trace charge flow
- `/scout trial expiration handler`

**Recovery:**
- Manual tier grant for customer (avoid bad UX while diagnosing)
- Email customer transparently: "We hit a billing snag, your access continues"
- Fix root cause + backport to other customers in same state

---

## D. Operator Confusion Incidents (Process)

### D1 — "Which environment am I in?"

⚡ **P2** · Operator · Common

**Symptom:** Operator unsure if changes apply to sandbox or production

**Diagnose:**
```bash
# What's the URL pointing at?
curl -s https://sophia.agencyos.network/api/version

# What's local pointing at?
cat wrangler.toml | head -10
echo $NEXT_PUBLIC_APP_URL
```

**Recovery:** Reference `apps/sophia-ai-factory/CLAUDE.md` PRODUCTION block. Always treat URLs as canonical source of truth.

---

### D2 — "Did my change get deployed?"

⚡ **P2** · Operator · Common

**Symptom:** Operator made a doc/code change, unsure if live

**Diagnose:**
```bash
LOCAL=$(git rev-parse HEAD | cut -c1-8)
LIVE=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL  Live: $LIVE"
```

If LOCAL != LIVE → push + deploy needed.

**Commands:** `npm run deploy:full` if code change. NO deploy needed for `docs/` changes (don't bake into worker bundle).

---

### D3 — "I deleted a file by accident"

🚨 **P0** if not committed yet · ⚡ **P2** if committed

**Symptom:** `rm` mistake or wrong `git checkout`

**Diagnose:** Check git status, git reflog

**Commands:**
- `git reflog` — list all HEAD movements
- `git checkout <reflog_sha>` — restore prior state
- `git stash list` — check if husky lint-staged backed it up

**Recovery:**
- Restore from reflog (`git checkout HEAD@{N} -- <file>`)
- Restore from stash (`git stash apply stash@{N}`)
- Worst case: recover from remote (`git fetch && git checkout origin/main -- <file>`)

---

## E. Decision Quick Reference

```
Production down? ───────────────→ Plain text: "🚨 PROD HTTP 5xx, SHA Y"
                                    Claude: triage → /debug → /cook fix → deploy

Customer bug report? ───────────→ Plain text: paste customer message
                                    Claude: /debug + verify → /cook fix → notify

Smoke step blocked? ────────────→ Plain text: "Stuck at [step]. Error: [paste]"
                                    Claude: diagnose → recovery path

Pre-push fails? ────────────────→ Read which gate (G1-G5) failed
                                    Apply gate-specific fix per B5

Don't know if shipped? ─────────→ D2 — SHA comparison curl

Accidentally deleted? ──────────→ D3 — git reflog FIRST, panic NEVER
```

---

## What NOT in this playbook

- **Customer support scripts** (email templates, refund policy) — separate doc
- **Cloudflare account recovery** — depends on account credentials, can't be scripted
- **Domain / DNS incidents** — out of code scope, handled at registrar level
- **Legal / compliance incidents** — escalate to operator's legal counsel directly

---

## Building This Up Over Time

Every NEW real incident → add row to this doc following pattern:
```
### [Group][N] — One-line symptom

[P0/P1/P2/P3] · [audience] · [frequency]

**Symptom:** Exact reproduction
**Diagnose:** Step 1, step 2, step 3
**Commands:** /command1, /command2
**Recovery:** Exact steps
```

Doc grows from real fires, not from speculation. Don't pre-add hypothetical incidents.

---

## Unresolved

1. **Sentry sourcemap upload not wired** — without it, production stacks are minified. Operator can opt-in by setting `SENTRY_AUTH_TOKEN`. Doctrine considers this OPTIONAL (per `sophia-no-tech-doctrine.md`).
2. **No automated rollback trigger** — operator must run `wrangler rollback` manually after detection. Consider auto-rollback on >5% 5xx burst window if friction observed.
3. **D1 backup recovery procedure** — not yet drilled. R2 lifecycle exists but restore-from-backup never tested end-to-end. Add to quarterly DR drill cadence.
4. **No status page** — when prod degrades, no public signal to customers. Defer until first incident with customer impact.
5. **NOWPayments sandbox vs prod mismatch detection** — operator could accidentally use sandbox key in prod env. Add startup check `if (NOWPAYMENTS_KEY.startsWith('sandbox') && NODE_ENV === 'production') throw` — defer to next sweep.
