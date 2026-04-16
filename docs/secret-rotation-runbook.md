# Secret Rotation Runbook — Sophia AI Factory

## Secrets inventory

| Secret | Location | Rotation cadence | Owner |
|--------|----------|-----------------|-------|
| `CRON_SECRET` | CF Secrets (Worker) + GH Secrets | Quarterly | Founder |
| `INTROSPECT_TOKEN` | CF Secrets (Worker) + GH Secrets | Annually | Founder |
| `WEBHOOK_SECRET` | GH Secrets (Better Stack→GH dispatch auth) | When BS alert URL rotates | Founder |
| `CLOUDFLARE_API_TOKEN` | GH Secrets | Annually or on staff change | Founder |
| `TELEGRAM_BOT_TOKEN` | GH Secrets | On compromise only | Founder |
| `NOWPAYMENTS_IPN_SECRET` | CF Secrets (Worker) | Annually | Founder |

---

## CRON_SECRET — Quarterly Rotation (every 3 months)

**Why:** Used by P2/P3 cron routes to authenticate scheduled CF Worker triggers. Stale secrets = unauth cron attacks.

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "New CRON_SECRET: $NEW_SECRET"

# 2. Update CF Worker secret
echo "$NEW_SECRET" | wrangler secret put CRON_SECRET --name sophia-ai-factory

# 3. Update GH Secret (via gh CLI)
gh secret set CRON_SECRET --body "$NEW_SECRET" --repo longtho638-jpg/sophia-ai-factory

# 4. Verify cron routes respond (run after next scheduled trigger)
curl -H "Authorization: Bearer $NEW_SECRET" \
  https://sophia.agencyos.network/api/cron/uptime-check

# 5. Log rotation in this doc (append to Rotation Log below)
```

---

## INTROSPECT_TOKEN — Annual Rotation

**Why:** Gates `/api/version` full SHA + `/api/health/detail`. Low traffic, low risk — annual is sufficient.

```bash
# 1. Generate new token
NEW_TOKEN=$(openssl rand -hex 40)

# 2. Update CF Worker secret
echo "$NEW_TOKEN" | wrangler secret put INTROSPECT_TOKEN --name sophia-ai-factory

# 3. Update GH Secret
gh secret set INTROSPECT_TOKEN --body "$NEW_TOKEN" --repo longtho638-jpg/sophia-ai-factory

# 4. Verify health endpoint (use new token)
curl -H "Authorization: Bearer $NEW_TOKEN" \
  https://sophia.agencyos.network/api/health/detail

# 5. Share new token with CTO agent if needed (see plan.md Unresolved Questions)
```

---

## WEBHOOK_SECRET — Rotate when Better Stack alert URL changes

**Why:** Authenticates Better Stack → GitHub Actions dispatch for auto-rollback.

```bash
# 1. Generate new secret
NEW_WH_SECRET=$(openssl rand -hex 32)

# 2. Update GH Secret
gh secret set WEBHOOK_SECRET --body "$NEW_WH_SECRET" --repo longtho638-jpg/sophia-ai-factory

# 3. Update Better Stack alert webhook authorization header:
#    Better Stack UI → Alert → Webhook → Authorization: Bearer <new_secret>

# 4. Test: manually trigger rollback workflow
gh workflow run canary-rollback.yml \
  -f reason="rotation-test" \
  --repo longtho638-jpg/sophia-ai-factory
```

---

## CLOUDFLARE_API_TOKEN — Annual or on staff change

**Required scopes:** Workers Scripts:Edit + Workers Scripts:Read (no Analytics — Better Stack drives rollback)

```bash
# 1. Create new token in CF Dashboard:
#    My Profile → API Tokens → Create Token
#    Template: Edit Cloudflare Workers
#    Scope: Account > Workers Scripts > Edit
#    Scope: Account > Workers Scripts > Read

# 2. Update GH Secret
gh secret set CLOUDFLARE_API_TOKEN --body "<new_token>" --repo longtho638-jpg/sophia-ai-factory

# 3. Revoke old token in CF Dashboard
```

---

## Emergency Manual Rollback

If Better Stack is down and canary causes incidents:

```bash
# Immediate manual rollback (no backoff check — emergency only)
gh workflow run canary-rollback.yml \
  -f reason="manual-emergency" \
  --repo longtho638-jpg/sophia-ai-factory

# Or directly via wrangler (fastest)
wrangler rollback --name sophia-ai-factory --message "emergency manual rollback"
```

---

## Rotation Log

| Date | Secret | Rotated by | Reason |
|------|--------|-----------|--------|
| 2026-04-17 | All | P1 bootstrap | Initial provisioning |
