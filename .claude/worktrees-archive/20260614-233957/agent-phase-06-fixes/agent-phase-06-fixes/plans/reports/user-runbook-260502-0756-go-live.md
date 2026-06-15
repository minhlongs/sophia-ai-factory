# Runbook — Manual Steps for Go-Live (Sophia AI Factory)

**Date:** 2026-05-02
**Plan:** 260502-0756-go-live-zero-bug
**For:** CEO / Ops — these 4 actions cannot be automated.

Run them in this order:

---

## B — Apply Supabase migration 0044 (atomic compensation unique index)

**Why:** Closes M1 race condition where retry cron + webhook could both grant +1 credit (customer gets double).

**Time:** ~3 min

### Option 1 — via Supabase Dashboard (recommended)

1. Open: `https://supabase.com/dashboard/project/<your-project-ref>/sql/new`
   - To find project-ref: read `apps/sophia-ai-factory/.env` → `NEXT_PUBLIC_SUPABASE_URL` (subdomain before `.supabase.co`)
2. Open file: `apps/sophia-ai-factory/supabase/migrations/260502-0800-billing-events-compensation-unique.sql`
3. Copy the SQL body (skip the header comments — start from `CREATE UNIQUE INDEX...`)
4. Paste into SQL editor → Run
5. Verify: run `SELECT indexname FROM pg_indexes WHERE tablename='billing_events';` → expect new index visible

### Option 2 — via CLI

```bash
cd apps/sophia-ai-factory
npx supabase login   # browser opens, paste access token
npx supabase link --project-ref <ref>
npx supabase db push
```

### Verification

After applying, check:
```sql
SELECT indexname FROM pg_indexes WHERE indexname LIKE '%compensation%';
-- Should return at least one row
```

---

## F — Register HeyGen webhook URL (for "instant" video completion)

**Why:** Without webhook, video completion uses 5-min cron polling (latency 5-8 min). Webhook drops it to seconds.

**Time:** ~2 min

### Steps

1. Login HeyGen dashboard: `https://app.heygen.com/`
2. Settings → API → Webhooks (or Settings → Developer → Webhooks)
3. Click **Add Webhook** / **Create Endpoint**
4. URL: `https://sophia.agencyos.network/api/webhooks/heygen`
5. Events to subscribe (all critical):
   - `avatar_video.success`
   - `avatar_video.fail`
   - (optionally `talking_photo.success` / `talking_photo.fail`)
6. **Webhook Signing Secret:** HeyGen will display a secret OR ask you to enter one
   - If HeyGen generates: copy it
   - Set as Cloudflare Worker secret: `echo "<the-secret>" | npx wrangler secret put HEYGEN_WEBHOOK_SECRET`
   - This MUST match `HEYGEN_WEBHOOK_SECRET` already set on Worker (run `npx wrangler secret list` to confirm)
7. Save → HeyGen may send a test event; verify in CF logs: `npx wrangler tail sophia-ai-factory --format pretty | grep heygen`

### Verification

After registering, your next test video should:
- Complete render within 3-5 minutes
- Webhook fires within 5-10 seconds of HeyGen `success` status
- `videos.status` updates to `completed` BEFORE the next 5-min cron poll

---

## E — Real-money $49 USDT smoke test

**Why:** Code is ready and unit-tested but no real $ has flowed through the full chain.

**Time:** ~30-45 min (includes wait for blockchain + render + email)

### Pre-flight

- [ ] B + F above completed
- [ ] Wallet funded with ≥$60 USDT TRC20 + ≥10 TRX gas
- [ ] Test email account ready (e.g., personal Gmail)
- [ ] Open the full playbook: `plans/reports/real-money-smoke-playbook-260502-0733.md`
- [ ] Open Cloudflare tail in a separate terminal: `npx wrangler tail sophia-ai-factory --format pretty`

### Execute

Follow the 12-step playbook. Capture screenshots into `plans/reports/screenshots-real-smoke-260502/`.

### Sign-off

After Step 11 (streaming + auth gate verified):
- Total elapsed time Pay → Email Ready: __ min
- Any errors in tail: yes/no
- Final verdict: **GREEN go live** / yellow / red

---

## H — Restore GitHub Actions (account-level)

**Why:** Currently disabled at user level (HTTP 422). Manual `wrangler deploy` works but CI/CD audit trail + automatic GH Actions cron triggers are off.

**Time:** ~5-30 min (depends on root cause)

### Diagnose

1. Open: `https://github.com/settings/billing` → Actions usage tab
   - If "limit exceeded": add payment method or wait for next billing cycle
2. Open: `https://github.com/settings/security` → 2FA enabled?
   - If not: enable 2FA — required for some org Actions policies
3. Open: `https://github.com/longtho638-jpg/sophia-ai-factory/settings/actions`
   - Confirm Actions enabled for this repo
   - Confirm "Allow all actions" or specific allowlist

### Verify

```bash
gh workflow run test.yml --ref main
gh run list --limit 3
```

If still HTTP 422 "Actions has been disabled for this user" → contact GitHub support with the error message.

### Once Restored

The `deploy-with-sha.sh` script can be replaced with a `git push` workflow — open a PR adding a `wrangler deploy` step to `.github/workflows/test.yml` deploy job that does:
```yaml
- run: echo "${{ github.sha }}" | npx wrangler secret put COMMIT_SHA
- run: echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | npx wrangler secret put DEPLOYED_AT
```

---

## Sign-off Tracking

| Step | Owner | Status | Notes |
|------|-------|--------|-------|
| B Supabase mig | CEO | [ ] |  |
| F HeyGen webhook | CEO | [ ] |  |
| E Real-money smoke | CEO | [ ] |  |
| H GH Actions | CEO | [ ] | Workaround in place; not blocking |

After all 4 done → declare **GREEN GO LIVE** for One-Time STARTER_BUNDLE.

## Open Questions

1. Test wallet ownership — who funds the $50 USDT?
2. HeyGen webhook URL: same `HEYGEN_WEBHOOK_SECRET` already set or new one needed?
3. Refund test: skip or include in real-money smoke (extra $1 transaction)?
