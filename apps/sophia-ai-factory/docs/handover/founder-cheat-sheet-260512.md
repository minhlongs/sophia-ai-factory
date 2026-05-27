# Founder Cheat Sheet — FREE100 Final Push (2026-05-12)

> One-page paste-ready runbook. Each section ≤10 min. Total ~55 min.

| # | Task | Owner | Time | Status |
|---|---|---|---|---|
| 1 | Fix DNS (SPF + DMARC) | Founder | 15 min | ⚠️ Needs action — see Section 1 |
| 2 | Resend tracking off | Founder | 5 min | ⚠️ Needs action — see Section 2 |
| 3 | Sentry signup + run script | Founder | 10 min | ⚠️ Needs action — see Section 3 |
| 4 | Crisp.im signup + env wire | Founder | 10 min | ⚠️ Needs action — see Section 4 |
| 5 | BYOK PNG screenshots | — | — | ✅ DONE (auto-captured 2026-05-12) |
| 6 | 4-inbox drill | Founder | 10 min | Run AFTER tasks 1–2 — see Section 5 |
| 7 | E2E smoke video | Founder | 20 min | Optional — see Section 6 |

After tasks 1–4 + 6 done → FREE100 is greenlit for 42-partner distribution.

---

## Pre-flight — actual DNS state observed 2026-05-12 14:11 UTC

```
SPF:   ❌ EMPTY                    → must add (Section 1.A)
DKIM:  ⚠️ resend._domainkey present BUT missing "v=DKIM1; k=rsa;" prefix → see Section 1.B
DMARC: ⚠️ "v=DMARC1; p=none;"      → ramp to quarantine (Section 1.C)
MX:    ✅ AWS SES (inbound)         → OK
A:     ✅ Cloudflare proxied        → OK
```

The DKIM record may have been stripped of its tag prefix when pasted into Cloudflare.
Verify in Cloudflare DNS UI: the TXT value should start with `v=DKIM1; k=rsa; p=...` not just `p=...`.

---

## Section 1 — DNS fixes (15 min)

Open https://dash.cloudflare.com → **mekongmind.com** → **DNS** → **Records**.

### 1.A Add SPF (MISSING — required)

Click **Add record**:
- **Type:** `TXT`
- **Name:** `@`
- **Content:** `v=spf1 include:_spf.resend.com ~all`
- **TTL:** Auto
- **Proxy status:** DNS only

### 1.B Verify DKIM (check + fix if needed)

Find existing record **Name=`resend._domainkey`**. Click **Edit**.

If the **Content** field starts with just `p=MIGfMA...` → it's missing the prefix. Edit to:
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDv6VwPpWtplYsTkWRymgQ4B2zv0rQXxQ0XWqJchhfjWSTczcR25+ytoU28yN4+2sStT1tIOdES3B9jcqVXCn8F1fHdh2h4P3CC0OaERlME0BQz5o+9yMesqLl5+4J0k5nwrpAwymPEXQtFrdVxtaG15LoxpFkxpWAzTzXZ+qjcGwIDAQAB
```
(copy the ENTIRE block above as one line)

If it already has `v=DKIM1; k=rsa;` at the front → leave alone.

### 1.C Ramp DMARC from `p=none` → `p=quarantine`

Find existing **Name=`_dmarc`**. Click **Edit**. Change **Content** to:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@mekongmind.com; pct=100; aspf=r; adkim=r
```

### 1.D Verify (paste this into a new Terminal tab)

```bash
echo "SPF:"   && dig +short TXT mekongmind.com | grep -i spf
echo "DKIM:"  && dig +short TXT resend._domainkey.mekongmind.com
echo "DMARC:" && dig +short TXT _dmarc.mekongmind.com
```

All 3 lines must show content. Propagation can take 5–60 min.

---

## Section 2 — Resend tracking off (5 min)

Open https://resend.com/login → log in → **Settings** → **Tracking**.

- [ ] **Click Tracking** → toggle **OFF**
- [ ] **Open Tracking** → toggle **OFF**

Why: trackers rewrite the magic link through Resend's redirector; Microsoft/Gmail filters distrust redirected transactional links → spam folder.

Then **Domains** → `mekongmind.com` → click **Verify DNS Records** (re-check after Section 1).

---

## Section 3 — Sentry + Slack alerts (10 min)

### 3.A Sign up + create project

1. https://sentry.io/signup → create account
2. **Organization name:** `sophia-ai-factory`
3. **Create Project** → platform **Next.js** → name `sophia-ai-factory`
4. **Settings → Projects → sophia-ai-factory → Client Keys (DSN)** → copy DSN
5. **Settings → Auth Tokens → Create Token** → name `sentry-cli-upload` → scope `project:releases` only → copy

### 3.B Create Slack Incoming Webhook

1. https://api.slack.com/apps → **Create New App** → **From scratch** → name `Sophia Alerts`
2. **Incoming Webhooks** → toggle ON → **Add New Webhook** → pick `#sophia-alerts` (create channel first) → copy URL

### 3.C Run one-shot script

```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
bash scripts/founder-setup-sentry.sh
```

The script will prompt 6× — paste each value when asked:
1. NEXT_PUBLIC_SENTRY_DSN (the DSN from 3.A.4)
2. SENTRY_DSN (paste SAME DSN as #1)
3. SENTRY_AUTH_TOKEN (from 3.A.5)
4. SENTRY_ORG (just press Enter to accept `sophia-ai-factory`)
5. SENTRY_PROJECT (just press Enter)
6. SLACK_OPS_WEBHOOK_URL (from 3.B.2)

Script auto-runs: push secrets → verify 6 present → `npm run deploy:full` → go-live user E2E → fire test event.
Before running it, ensure `E2E_TEST_USER_PASSWORD` is exported in the shell; `deploy:full` fails closed without it.
You should see a `[founder-setup]` warning event appear at https://sentry.io within 30s.

---

## Section 4 — Crisp.im live chat (10 min)

### 4.A Sign up

1. https://crisp.chat/en/signup → create account (Free tier: 2 seats, unlimited convos)
2. Add website **`sophia.agencyos.network`**
3. Skip "install code" — we already have the loader. Copy the **Website ID** (8-char-dash-format, e.g., `12345678-90ab-...`)

### 4.B Wire to PROD

Edit `apps/sophia-ai-factory/wrangler.toml` → find `[vars]` section (or add one). Add:
```toml
[vars]
NEXT_PUBLIC_CRISP_WEBSITE_ID = "PASTE-YOUR-ID-HERE"
```

Then re-deploy:
```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
export E2E_TEST_USER_PASSWORD='<production-e2e-user-password>'
npm run deploy:full
```

After deploy, open https://sophia.agencyos.network — you should see the chat bubble bottom-right.

### 4.C (Optional) Crisp dashboard settings

- Set **Operator hours:** 9am–6pm ICT
- Add **Welcome message:** `Hi! I'm Sophia's support concierge. How can I help your team get set up?`
- Add **Trigger:** show message after 30s on `/pricing` page

---

## Section 5 — 4-inbox deliverability drill (10 min)

Run AFTER Section 1 + Section 2 complete.

For **each** of 4 inboxes you control:

| # | Inbox | Test address |
|---|---|---|
| 1 | Gmail Personal | `<you>@gmail.com` |
| 2 | Outlook/Hotmail | `<you>@outlook.com` |
| 3 | iCloud | `<you>@icloud.com` |
| 4 | Yahoo | `<you>@yahoo.com` |

Steps for each:
1. Open https://sophia.agencyos.network/pricing in incognito → enter test email → **Get started**
2. Wait ≤2 min, check each folder:
   - [ ] **Inbox** (or Gmail Promotions = acceptable)
   - [ ] **Spam** / **Junk**
3. If email lands in spam → "Move to Inbox" + "Not Spam"
4. Click magic link → confirm sign-in works → sign out → next inbox

**Pass criteria:** at least 3 of 4 inboxes land in Inbox/Promotions on first try.

---

## Section 6 — E2E smoke video (20 min, optional but recommended)

Record yourself completing the full FREE100 flow on a **fresh non-tech persona**:

1. Open Loom / QuickTime → start screen recording
2. https://sophia.agencyos.network → click **Pricing**
3. Enter `FREE100` in promo code field → **Apply**
4. Enter a fresh email (e.g., `partner-test+260512@gmail.com`) → **Get started**
5. Switch to that inbox → click magic link
6. Land on `/welcome/[token]` → click **Get Started**
7. Land on setup wizard → enter 3 BYOK API keys (use real test keys, you can delete later)
8. Click **Verify HeyGen** → see green checkmark
9. Land on dashboard
10. Click **Connect Telegram** → bot opens → `/start <token>` → bilingual reply
11. Stop recording → upload to private folder → share link with team

This video doubles as: (a) handover demo for new partners, (b) regression smoke baseline.

---

## Verification — when ALL above checked

```bash
# Quick sanity check from your laptop:
curl -s https://sophia.agencyos.network/api/promo/validate \
  -X POST -H "Content-Type: application/json" -d '{"code":"FREE100"}' | jq

# Expect: {"valid":true, "code":"FREE100", "appliesToTier":"MASTER", ...}
```

Then start sending the FREE100 link to partners. 42 redemptions remaining out of 50.

---

## If anything fails

- **DNS not propagating after 60min:** check Cloudflare DNS record exists + proxy status is `DNS only` (not orange cloud).
- **Sentry script halts mid-run:** the script tells you which secret failed + what was pushed. Re-run with the missing creds only.
- **Crisp bubble doesn't appear:** check `npm run deploy:full` exit was 0 + CSP allows `client.crisp.chat` (already wired in `seed/security/content-security-policy-configuration.ts`).
- **Magic link in spam after DNS fixes:** wait 24h for reputation rebuild; meanwhile ask partners to whitelist `@mekongmind.com`.
- **BYOK screenshots wrong:** generated screenshots are docs landing pages, not your real dashboard. Replace `public/byok-guide/{openrouter,elevenlabs,d-id}.png` with screenshots from your own signed-in account for production-grade visuals.

---

## Companion docs

- Sentry deep-dive: `docs/handover/sentry-alerts-setup-runbook-260512.md`
- Email audit: `docs/handover/free100-email-deliverability-260512.md`
- DNS + drill: `docs/handover/founder-dns-and-inbox-drill-checklist-260512.md`
- Support providers: `docs/handover/support-provider-comparison-260512.md`
