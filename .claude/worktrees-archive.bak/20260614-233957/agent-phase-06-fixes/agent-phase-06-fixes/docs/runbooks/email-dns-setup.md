# Email DNS Setup Runbook — Sophia AI Factory

**Gap:** CG-004 — Email DNS (SPF/DKIM/DMARC) verification  
**Sending provider:** Resend (https://resend.com)  
**Sending domain:** `mekongmind.com` (or operator-configured domain)  
**DNS provider:** Cloudflare  
**Last reviewed:** 2026-05-20

---

## Why This Matters

Without correct SPF/DKIM/DMARC records:
- Welcome emails land in spam → customers never activate their account
- Resend bounces accumulate → Resend may suspend the account
- DMARC `p=quarantine`/`p=reject` graduation (OG-003, scheduled 2026-06-12) is impossible

---

## Step 1 — Get Exact Values from Resend Dashboard

1. Log in to https://app.resend.com
2. Navigate to **Domains** → click your domain (`mekongmind.com`)
3. Copy the exact record values shown. The table below uses placeholders — **always use the exact values from Resend**, not this doc.

---

## Step 2 — Add DNS Records in Cloudflare

Log in to https://dash.cloudflare.com → select `mekongmind.com` → **DNS** → **Records**.

### SPF Record

| Field | Value |
|-------|-------|
| Type | `TXT` |
| Name | `@` (root domain) |
| Content | `v=spf1 include:amazonses.com ~all` |
| TTL | Auto |
| Proxy | DNS only (orange cloud OFF) |

> **Note:** Resend routes through Amazon SES. If Resend shows a different `include:` target in their dashboard, use that value instead.
>
> If an SPF record already exists for `@`, **do not create a second one**. Instead, add `include:amazonses.com` inside the existing record before `~all` or `-all`.

### DKIM Record

Resend provides a CNAME record (not TXT) for DKIM. Example:

| Field | Value |
|-------|-------|
| Type | `CNAME` |
| Name | `resend._domainkey` |
| Content | `<value from Resend dashboard>` |
| TTL | Auto |
| Proxy | DNS only (orange cloud OFF) |

> **IMPORTANT:** CNAME records for DKIM must have Cloudflare proxy **disabled**. Proxied CNAMEs break DKIM verification.

### DMARC Record

| Field | Value |
|-------|-------|
| Type | `TXT` |
| Name | `_dmarc` |
| Content | `v=DMARC1; p=none; rua=mailto:support@mekongmind.com; ruf=mailto:support@mekongmind.com; fo=1` |
| TTL | Auto |
| Proxy | DNS only (orange cloud OFF) |

> **Policy progression:**
> - Now: `p=none` (monitor-only — no mail rejected)
> - 2026-06-12 (after 30-day rua report review): upgrade to `p=quarantine`
> - Goal: `p=reject` (see OG-003)

---

## Step 3 — Trigger Verification in Resend

After adding all records, go back to Resend Domains → your domain → click **Verify DNS records**.

DNS propagation can take up to 48h but usually completes within 15 minutes when using Cloudflare.

---

## Step 4 — Automated Verification Script

Run the provided script to confirm records are live:

```bash
# From project root
pnpm dlx tsx scripts/verify-email-dns.ts mekongmind.com

# Or with custom DKIM selector (if Resend changes it):
DKIM_SELECTOR=resend pnpm dlx tsx scripts/verify-email-dns.ts mekongmind.com
```

Expected output when all records are correctly set:
```
✅ SPF  — OK
✅ DKIM — OK
✅ DMARC — OK
RESULT: ✅ All email DNS records verified
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| DKIM not found | Cloudflare proxy enabled on CNAME | Set proxy to DNS only (grey cloud) |
| SPF record missing | Never added | Add TXT `@` per Step 2 |
| Two SPF records | Duplicate TXT record | Merge into single TXT record |
| DMARC reports empty | `rua` address not monitored | Set up mailbox at `support@mekongmind.com` |
| Resend "unverified" 48h later | TTL caching | Use Cloudflare `dig` tool to confirm propagation |

---

## Rotation / Re-verification

Re-run the script after any DNS change:
```bash
pnpm dlx tsx scripts/verify-email-dns.ts
```

If Resend rotates DKIM keys (rare), they will notify via email — update the CNAME value and re-verify.

---

## Contacts

- Resend support: https://resend.com/support
- Cloudflare DNS docs: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/
- On-call operator: see `docs/runbooks/cron-escalation-contacts.md`
