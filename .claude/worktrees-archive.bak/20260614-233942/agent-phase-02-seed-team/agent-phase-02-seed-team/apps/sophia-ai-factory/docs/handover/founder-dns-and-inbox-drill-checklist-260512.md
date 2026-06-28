# Founder Checklist — DNS verify + Resend tracking + 4-inbox drill

**Domain:** mekongmind.com
**Sender:** Sophia AI Factory via Resend
**Estimated time:** ~60 minutes
**Companion doc:** `free100-email-deliverability-260512.md` (audit + rationale)

---

## TL;DR (paste-and-run)

```bash
dig +short TXT mekongmind.com | grep -i spf
dig +short TXT resend._domainkey.mekongmind.com
dig +short TXT _dmarc.mekongmind.com
```

If any of the three returns empty → **fix DNS first** (Section A).
Else jump to Section B (Resend tracking) and Section C (inbox drill).

---

## Section A — DNS records (15 min)

### A.1 SPF — confirm Resend include

```bash
dig +short TXT mekongmind.com | grep -i spf
```

✅ Pass example:
```
"v=spf1 include:_spf.resend.com ~all"
```

❌ Fail patterns:
- Empty output → add a new TXT record with the value above.
- `v=spf1 ... -all` without `include:_spf.resend.com` → append the include.
- Two separate `v=spf1` records → **merge them**, never have two.

Fix in Cloudflare DNS: **DNS → Records → Add → Type=TXT, Name=@, Content=`v=spf1 include:_spf.resend.com ~all`, TTL=Auto, Proxy=DNS only**.

### A.2 DKIM — confirm Resend selector

```bash
dig +short TXT resend._domainkey.mekongmind.com
```

✅ Pass example (one long TXT containing `p=<base64 key>`):
```
"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb..."
```

❌ Fail: empty. Fix → copy the DKIM TXT shown in Resend dashboard
(**Domains → mekongmind.com → DNS Records**) and paste into Cloudflare DNS
with **Name=`resend._domainkey`** (Cloudflare appends the apex automatically).

### A.3 DMARC — minimum policy

```bash
dig +short TXT _dmarc.mekongmind.com
```

✅ Pass minimum:
```
"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@mekongmind.com"
```

❌ Fail (empty or `p=none`): add a TXT record:
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@mekongmind.com; pct=100; aspf=r; adkim=r`

> Start with `p=quarantine` for 7 days. If no legitimate mail is rejected
> in DMARC reports, ramp to `p=reject` afterwards.

### A.4 Final DNS verification (one-shot)

```bash
echo "SPF:"   && dig +short TXT mekongmind.com | grep -i spf
echo "DKIM:"  && dig +short TXT resend._domainkey.mekongmind.com
echo "DMARC:" && dig +short TXT _dmarc.mekongmind.com
echo "MX:"    && dig +short MX  mekongmind.com
```

All three (SPF/DKIM/DMARC) must return values. **Do not proceed to drill until each line shows content.**

---

## Section B — Resend dashboard hygiene (10 min)

Open https://resend.com/domains → click `mekongmind.com`.

### B.1 Verify domain status
- All three records should show ✅ **Verified** (green badge).
- If any is ⏳ "Pending" → click **Verify DNS Records** after fixing in Cloudflare. Propagation can take 5–60 min.

### B.2 Disable click/open tracking (transactional hygiene)

Resend → **Settings** → **Tracking**:

- [ ] **Click Tracking** → toggle **OFF**
- [ ] **Open Tracking** → toggle **OFF**

> Click tracking rewrites the magic link URL through Resend's redirector.
> Microsoft/Gmail filters distrust redirected transactional links → spam folder.
> Open tracking inserts a 1×1 pixel that hurts the same scoring.

### B.3 Confirm "From" identity
Resend → **API Keys** → Sender for production must be:
```
Sophia <noreply@mekongmind.com>     # or hello@, support@
```
Avoid generic words like `marketing@`, `offers@`, `team@`.

---

## Section C — 4-inbox deliverability drill (35 min)

**Goal:** confirm magic link lands in **Inbox**, not Spam/Junk/Promotions, across 4 major providers.

### C.1 Test addresses

Use disposable or existing personal inboxes you control:

| Provider | Test address (substitute yours) |
|---|---|
| Gmail (Personal) | `<you>@gmail.com` |
| Outlook / Hotmail / Live | `<you>@outlook.com` |
| Apple iCloud | `<you>@icloud.com` |
| Yahoo Mail | `<you>@yahoo.com` |

If you don't have all four, sign up for free accounts now (5 min each).

### C.2 Drill procedure

For **each** inbox:

1. Open https://sophia.agencyos.network/pricing in an **incognito window**
2. Enter test email → click **Get started**
3. Note the **send timestamp** (HH:MM)
4. Switch to the test inbox
5. Wait up to **2 minutes**, then check:
   - [ ] **Inbox** (primary tab if Gmail Promotions exists)
   - [ ] **Spam** / **Junk** folder
   - [ ] **Promotions** / **Updates** tabs (Gmail)
6. Record outcome in C.4 grid below
7. Open the email → click the magic link → confirm sign-in works
8. **Sign out** before testing the next inbox

### C.3 Subject line to look for

```
Sign in to Sophia AI Factory · Đăng nhập Sophia AI
```

If the subject differs, the wrong template fired — escalate.

### C.4 Results grid

| Inbox | Send time | Landed in | Time to inbox | Action needed |
|---|---|---|---|---|
| Gmail | | ☐ Inbox ☐ Promotions ☐ Spam | | |
| Outlook | | ☐ Inbox ☐ Junk | | |
| iCloud | | ☐ Inbox ☐ Junk | | |
| Yahoo | | ☐ Inbox ☐ Spam | | |

### C.5 Pass / Fail criteria

✅ **PASS** — ready to distribute FREE100:
- All 4 land in **Inbox** (or Gmail Promotions, which is acceptable for transactional)
- Time-to-inbox ≤ 2 minutes
- Magic link signs in successfully on first click

⚠️ **PARTIAL** — distribute but warn partners:
- 1 of 4 lands in Spam, fixable by "Move to Inbox" + "Mark as not spam"
- Document workaround in handover note

❌ **FAIL** — do NOT distribute yet:
- 2+ inboxes spam, OR magic link fails on any inbox
- Action: re-check Section A (DNS), Section B (tracking off), then re-run drill
- If still failing → open Resend support ticket with `request-id` from delivery log

### C.6 Document the result

Save outcome to `apps/sophia-ai-factory/docs/handover/free100-inbox-drill-RESULT-<YYYYMMDD>.md` with:
- Date + tester
- Filled grid
- Screenshots (optional) of each inbox showing the magic link
- Verdict: PASS / PARTIAL / FAIL

---

## Section D — Optional hardening (after PASS)

- [ ] Add BIMI record (brand logo in Gmail) — requires VMC certificate
- [ ] Ramp DMARC to `p=reject` after 7 days of clean reports
- [ ] Schedule weekly Postmaster check at https://postmaster.google.com
- [ ] Enable Resend webhook for bounces → wire to existing Sentry pipeline

---

## Done criteria

- [x] Section A — three `dig` commands return non-empty TXT values
- [x] Section B.1 — all 3 records show ✅ Verified in Resend dashboard
- [x] Section B.2 — click + open tracking both OFF
- [x] Section C.5 — verdict PASS or PARTIAL (with documented workaround)
- [x] Section C.6 — RESULT.md committed

**After all checked → FREE100 distribution is unblocked from the email side.**
