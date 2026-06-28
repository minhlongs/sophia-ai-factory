# Secret Rotation Runbook — Sophia AI Factory

## Secrets inventory

| Secret | Location | Rotation cadence | Owner |
|--------|----------|-----------------|-------|
| `CRON_SECRET` | CF Secrets (Worker); GH secret only for optional cron-smoke workflow | Quarterly | Founder |
| `INTROSPECT_TOKEN` | CF Secrets (Worker) | Annually | Founder |
| `WEBHOOK_SECRET` | Optional GH workflow auth only, if Better Stack -> GitHub rollback is enabled | When BS alert URL rotates | Founder |
| `CLOUDFLARE_API_TOKEN` | Local Wrangler auth; optional GH secret for canary rollback workflow | Annually or on staff change | Founder |
| `TELEGRAM_BOT_TOKEN` | CF Secrets (Worker); optional GH secret for rollback workflow alert | On compromise only | Founder |
| `NOWPAYMENTS_IPN_SECRET` | CF Secrets (Worker) | Annually | Founder |

---

## CRON_SECRET — Quarterly Rotation (every 3 months)

**Why:** Used by P2/P3 cron routes to authenticate scheduled CF Worker triggers. Stale secrets = unauth cron attacks.

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "New CRON_SECRET: $NEW_SECRET"

# 2. Update CF Worker secret (canonical runtime value)
echo "$NEW_SECRET" | wrangler secret put CRON_SECRET --name sophia-ai-factory

# 3. If the optional GitHub cron-smoke workflow is enabled, update GH Secret too.
# gh secret set CRON_SECRET --body "$NEW_SECRET" --repo longtho638-jpg/sophia-ai-factory

# 4. Verify cron routes respond
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

# 3. Verify health endpoint (use new token)
curl -H "Authorization: Bearer $NEW_TOKEN" \
  https://sophia.agencyos.network/api/health/detail

# 4. Share new token with CTO agent if needed (see plan.md Unresolved Questions)
```

---

## WEBHOOK_SECRET — Rotate when Better Stack alert URL changes

**Why:** Authenticates the optional Better Stack -> GitHub Actions dispatch for canary rollback. This is not the canonical deploy/rollback path; direct Wrangler rollback remains canonical.

```bash
# 1. Generate new secret
NEW_WH_SECRET=$(openssl rand -hex 32)

# 2. Update GH Secret if optional workflow dispatch is enabled
gh secret set WEBHOOK_SECRET --body "$NEW_WH_SECRET" --repo longtho638-jpg/sophia-ai-factory

# 3. Update Better Stack alert webhook authorization header:
#    Better Stack UI → Alert → Webhook → Authorization: Bearer <new_secret>

# 4. Test optional rollback workflow
gh workflow run canary-rollback.yml \
  -f reason="rotation-test" \
  --repo longtho638-jpg/sophia-ai-factory
```

---

## CLOUDFLARE_API_TOKEN — Annual or on staff change

**Required scopes:** Workers Scripts:Edit + Workers Scripts:Read. Local `wrangler` auth is the canonical deploy path; the GitHub secret is needed only for optional rollback workflow execution.

```bash
# 1. Create new token in CF Dashboard:
#    My Profile → API Tokens → Create Token
#    Template: Edit Cloudflare Workers
#    Scope: Account > Workers Scripts > Edit
#    Scope: Account > Workers Scripts > Read

# 2. Authenticate local Wrangler or update optional GH rollback secret
npx wrangler login
# gh secret set CLOUDFLARE_API_TOKEN --body "<new_token>" --repo longtho638-jpg/sophia-ai-factory

# 3. Revoke old token in CF Dashboard
```

---

## Emergency Manual Rollback

If Better Stack is down and canary causes incidents:

```bash
# Immediate manual rollback (canonical, fastest)
wrangler rollback --name sophia-ai-factory --message "emergency manual rollback"

# Optional auxiliary workflow, only when GH Actions secrets are provisioned
gh workflow run canary-rollback.yml \
  -f reason="manual-emergency" \
  --repo longtho638-jpg/sophia-ai-factory
```

---

## Rotation Log

| Date | Secret | Rotated by | Reason |
|------|--------|-----------|--------|
| 2026-04-17 | All | P1 bootstrap | Initial provisioning |
