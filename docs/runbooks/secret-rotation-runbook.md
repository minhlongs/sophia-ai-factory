# Consolidated Secret Rotation Runbook — Sophia AI Factory

**Gap:** OG-007 — Missing rotation procedures for 5+ secrets beyond NOWPAYMENTS_IPN_SECRET  
**Last reviewed:** 2026-05-20  
**Canonical location:** `docs/runbooks/secret-rotation-runbook.md`  
**Supersedes:** `docs/secret-rotation-runbook.md` (partial — covers CRON_SECRET, INTROSPECT_TOKEN, WEBHOOK_SECRET, CLOUDFLARE_API_TOKEN, TELEGRAM_BOT_TOKEN, NOWPAYMENTS_IPN_SECRET)

---

## Secrets Inventory

| Secret | Location | Rotation cadence | Owner | Blast radius |
|--------|----------|-----------------|-------|-------------|
| `NOWPAYMENTS_IPN_SECRET` | CF Secrets (Worker) | Annual / on compromise | Founder | Payment webhook unauth if wrong |
| `CRON_SECRET` | CF Secrets + GH Secrets | Quarterly | Founder | All cron routes unauthenticated |
| `BETTER_AUTH_SECRET` | CF Secrets (Worker) | Annual / on compromise | Founder | All active sessions invalidated |
| `TELEGRAM_BOT_TOKEN` | CF Secrets (Worker) | On compromise only | Founder | Telegram bot goes offline |
| `INTERNAL_API_SECRET` | CF Secrets (Worker) | Quarterly | Founder | Internal agent→platform calls fail |
| `OPENROUTER_API_KEY` | Per-customer (BYOK) | Customer-managed | Customer | Customer's AI generation stops |
| `ELEVENLABS_API_KEY` | Per-customer (BYOK) | Customer-managed | Customer | Customer's voice synthesis stops |
| `D_ID_API_KEY` | Per-customer (BYOK) | Customer-managed | Customer | Customer's video avatars stop |

> **BYOK secrets (OpenRouter, ElevenLabs, D-ID):** These are customer-owned. The operator is responsible only for documenting the rotation procedure — not for performing it. Customers rotate via the Setup Wizard or account settings.

---

## NOWPAYMENTS_IPN_SECRET — Annual / On Compromise

**Why:** Authenticates incoming IPN webhook from NOWPayments. If leaked, attackers can forge payment confirmations and activate tiers without paying.

**Blast radius:** Forged payment confirmations → unauthorized tier activations.

```bash
# 1. Log in to NOWPayments dashboard → Settings → IPN → Generate new IPN secret
#    Copy the new secret value.

# 2. Update CF Worker secret (keep old secret until step 4)
NEW_IPN_SECRET="<paste from NOWPayments dashboard>"
echo "$NEW_IPN_SECRET" | wrangler secret put NOWPAYMENTS_IPN_SECRET --name sophia-ai-factory

# 3. Verify webhook endpoint still responds:
#    NOWPayments dashboard → IPN → Send test IPN
#    Expect: 200 response from /api/payments/nowpayments/webhook

# 4. Confirm old secret is no longer accepted by NOWPayments (automatic after step 1)

# 5. Log rotation below
```

**Verification:** Monitor Sentry for `PaymentWebhookAuthFailed` errors in the 10 minutes after rotation.

---

## CRON_SECRET — Quarterly (every 3 months)

**Why:** Authenticates all 18+ cron routes. Stale = potential cron auth bypass.

**Blast radius:** All cron jobs (dunning, email, fulfillment, usage) become unauthenticated. Must rotate atomically — old secret stops working immediately after CF secret update.

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "New CRON_SECRET: $NEW_SECRET"

# 2. Update CF Worker secret (instant effect on Workers runtime)
echo "$NEW_SECRET" | wrangler secret put CRON_SECRET --name sophia-ai-factory

# 3. Update GH Secret (used by any manually-triggered workflows)
gh secret set CRON_SECRET --body "$NEW_SECRET" --repo longtho638-jpg/sophia-ai-factory

# 4. Verify cron auth is working (run immediately after rotation):
curl -H "Authorization: Bearer $NEW_SECRET" \
  https://sophia.agencyos.network/api/cron/uptime-check
# Expected: {"ok":true,...}

# 5. Log rotation below
```

**Verification:** Wait for next scheduled cron trigger (up to 10 min). Check `cron_run_log` table via `/api/admin/cron-run-log` for success entries.

---

## BETTER_AUTH_SECRET — Annual / On Compromise

**Why:** Used by Better Auth to sign session tokens. Rotating invalidates ALL active user sessions — users must re-login.

**Blast radius:** ALL active sessions invalidated immediately. Every logged-in user is signed out. Do NOT rotate unless compromised or as part of annual schedule.

```bash
# 1. Schedule maintenance window (notify users if possible — "brief sign-out required")

# 2. Generate new secret (minimum 32 chars)
NEW_AUTH_SECRET=$(openssl rand -hex 32)
echo "New BETTER_AUTH_SECRET: $NEW_AUTH_SECRET"

# 3. Update CF Worker secret
echo "$NEW_AUTH_SECRET" | wrangler secret put BETTER_AUTH_SECRET --name sophia-ai-factory

# 4. Immediately verify sign-in still works:
#    Open https://sophia.agencyos.network/login → attempt login
#    Expected: new session created, dashboard accessible

# 5. Log rotation below
```

**Verification:** Confirm at least one successful login via `/api/auth/session` returning a valid session. Monitor Sentry for auth errors.

---

## TELEGRAM_BOT_TOKEN — On Compromise Only

**Why:** Authenticates the @Sophia_Bbot Telegram bot. Rotating causes brief bot downtime while webhook is re-registered.

**Blast radius:** Telegram bot offline until webhook re-registration completes (~5 min).

```bash
# 1. Go to Telegram → @BotFather → /mybots → @Sophia_Bbot → API Token → Revoke current token
#    BotFather generates a new token. Copy it.

NEW_BOT_TOKEN="<paste from BotFather>"

# 2. Update CF Worker secret
echo "$NEW_BOT_TOKEN" | wrangler secret put TELEGRAM_BOT_TOKEN --name sophia-ai-factory

# 3. Re-register webhook (new token requires re-registration):
WEBHOOK_URL="https://sophia.agencyos.network/api/telegram/webhook"
curl -s "https://api.telegram.org/bot${NEW_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}"
# Expected: {"ok":true,"description":"Webhook was set"}

# 4. Test bot:
#    Send /status to @Sophia_Bbot in Telegram
#    Expected: response within 30 seconds

# 5. Log rotation below
```

**Verification:** `/api/telegram/health` endpoint returns `{"ok":true}` with new token active.

---

## INTERNAL_API_SECRET — Quarterly

**Why:** Authenticates internal service-to-service calls (agent orchestration → platform API). Rotating breaks agent integrations until callers are updated.

**Blast radius:** Internal agent calls fail with 401 until both CF secret and calling agent configuration are updated atomically.

```bash
# 1. Generate new secret
NEW_INTERNAL_SECRET=$(openssl rand -hex 32)

# 2. Coordinate with any running agents — notify before rotating

# 3. Update CF Worker secret
echo "$NEW_INTERNAL_SECRET" | wrangler secret put INTERNAL_API_SECRET --name sophia-ai-factory

# 4. Update any agent configurations that use INTERNAL_API_SECRET
#    (check .env or wrangler secrets for dependent services)

# 5. Verify internal API still accepts the new secret:
curl -H "Authorization: Bearer $NEW_INTERNAL_SECRET" \
  https://sophia.agencyos.network/api/internal/health
# Expected: 200 OK

# 6. Log rotation below
```

---

## Per-Customer BYOK Secrets (Customer-Managed)

The following secrets are owned and managed by individual customers via the Setup Wizard. The operator does NOT rotate these — but this section documents the procedure for customer support scenarios.

### OPENROUTER_API_KEY

**How to rotate (customer instruction):**
1. Log in to https://openrouter.ai → Keys → Create new key
2. Log in to Sophia dashboard → Settings → AI Configuration → Update OpenRouter API Key
3. Delete the old key from OpenRouter

**Operator support:** If a customer reports AI generation stopped, verify their key is active via `/api/admin/check-customer-byok?userId=<id>` (admin-only).

### ELEVENLABS_API_KEY

**How to rotate (customer instruction):**
1. Log in to https://elevenlabs.io → Profile → API Keys → Generate new key
2. Log in to Sophia dashboard → Settings → Voice Configuration → Update ElevenLabs API Key
3. Delete the old key from ElevenLabs

**Operator support:** Monitor Sentry tag `byok_provider=elevenlabs` for 401 errors to identify customers with expired keys.

### D_ID_API_KEY

**How to rotate (customer instruction):**
1. Log in to https://studio.d-id.com → Settings → API → Regenerate API key
2. Log in to Sophia dashboard → Settings → Video Configuration → Update D-ID API Key

**Operator support:** Monitor Sentry tag `byok_provider=d-id` for 401 errors.

---

## Emergency Rotation Procedure

If a secret is compromised:

1. **Rotate immediately** — do not wait for off-peak window
2. **Update CF Worker secret first** (takes effect within seconds)
3. **Update GH Secrets** (if applicable)
4. **Monitor Sentry** for auth errors in the 5 minutes after rotation
5. **File a postmortem** at `docs/postmortems/{YYYY-MM-DD}-secret-compromise.md`

```bash
# Emergency verification after any rotation:
curl -sI https://sophia.agencyos.network/api/health | head -3
# Must return HTTP 200
```

---

## Rotation Log

| Date | Secret | Rotated by | Reason |
|------|--------|-----------|--------|
| 2026-04-17 | CRON_SECRET, INTROSPECT_TOKEN, WEBHOOK_SECRET, CLOUDFLARE_API_TOKEN, TELEGRAM_BOT_TOKEN, NOWPAYMENTS_IPN_SECRET | Founder | Initial provisioning |
| 2026-05-20 | INTERNAL_API_SECRET, BETTER_AUTH_SECRET | — | First documented (was missing from prior runbook) |

---

## Rotation Calendar

| Secret | Next rotation due | Notes |
|--------|-----------------|-------|
| CRON_SECRET | 2026-07-17 | Quarterly from initial |
| INTERNAL_API_SECRET | 2026-07-17 | Quarterly from initial |
| BETTER_AUTH_SECRET | 2027-04-17 | Annual |
| NOWPAYMENTS_IPN_SECRET | 2027-04-17 | Annual |
| CLOUDFLARE_API_TOKEN | 2027-04-17 | Annual |
| TELEGRAM_BOT_TOKEN | On compromise | No scheduled rotation |

---

## Cross-references

- `docs/secret-rotation-runbook.md` — partial prior runbook (CRON_SECRET, INTROSPECT_TOKEN, WEBHOOK_SECRET, CLOUDFLARE_API_TOKEN, TELEGRAM_BOT_TOKEN, NOWPAYMENTS_IPN_SECRET)
- `docs/runbooks/cron-escalation-contacts.md` — who to notify during rotation
- `docs/postmortems/` — file postmortem if rotation was triggered by compromise
