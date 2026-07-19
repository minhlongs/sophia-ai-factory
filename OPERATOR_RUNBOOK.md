---
title: "Sophia AI Factory — Operator Runbook"
version: "1.0"
date: 2026-07-18
audience: "Operations team / Customer"
---

# Sophia AI Factory — Operator Runbook

## 📋 Daily Health Checks

### Morning (5 min)
```bash
# 1. Check production health
curl -s https://sophia.agencyos.network/api/health/detail

# 2. Check recent errors
# → Cloudflare dashboard → Workers → Logs → Filter: error

# 3. Check Inngest queue depth
# → inngest.com/dashboard → sophia-ai-factory → Queue
```

### Weekly (15 min)
```bash
# 1. Run full verification
cd apps/sophia-ai-factory
npm run deploy:verify

# 2. Check D1 database size
npx wrangler d1 info sophia-db

# 3. Review Sentry errors
# → sentry.io → sophia → Issues

# 4. Check MCU credit balance trends
# → Dashboard → Billing → Credit usage
```

---

## 🔧 Common Issues + Fixes

### Issue 1: Video Generation Stuck
**Symptoms:** Customer report video không generate, status stuck ở "Processing"
**Check:**
1. Inngest dashboard → có events không?
2. HeyGen/ElevenLabs API status page
3. Worker logs → có error message gì?
**Fix:**
- Nếu API error → verify API key khách hàng còn valid
- Nếu Inngest stuck → restart Inngest serve function
- Nếu D1 error → check D1 connection

### Issue 2: Payment Not Activating Tier
**Symptoms:** Customer paid nhưng tier vẫn BASIC/PREMIUM
**Check:**
1. NOWPayments dashboard → IPN có được gửi không?
2. `/api/webhook/nowpayments` → có log entry không?
3. `org_balances` table → có transaction mới không?
**Fix:**
- Verify `NOWPAYMENTS_IPN_SECRET` trong wrangler secrets
- Manual tier activation: update D1 directly (emergency only)

### Issue 3: Telegram Bot Not Responding
**Symptoms:** @Sophia_Bbot không trả lời commands
**Check:**
1. Worker logs → webhook có receive requests không?
2. Bot token valid? → `curl https://api.telegram.org/bot<TOKEN>/getMe`
3. Webhook URL đúng? → `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
**Fix:**
- Re-set webhook: `/api/telegram/set-webhook`
- Verify bot token trong wrangler secrets

### Issue 4: Setup Wizard Fails on API Key Save
**Symptoms:** Customer nhập API key nhưng lỗi "Failed to save"
**Check:**
1. Browser console → có CORS error không?
2. Network tab → `/api/setup-wizard/save` response status
3. D1 → `org_api_keys` table có insert attempt không?
**Fix:**
- Verify DB connection (D1 binding)
- Check Zod validation error message (có thể format API key sai)

---

## 🔄 Deployment Rollback

### Quick Rollback (5 min)
```bash
# Find last known-good commit
git log --oneline -10

# Tag previous release
git tag -d v-current
git tag -a v-previous <SHA> -m "Rollback target"

# Re-deploy
git push origin <SHA>:main --force
cd apps/sophia-ai-factory && npm run deploy:full
```

### Full Rollback (15 min)
```bash
# Reset to last stable tag
git reset --hard v1.0.0-stable

# Clean build
rm -rf .next .open-next

# Re-deploy
npm run build && npm run deploy:full
```

---

## 📊 Monitoring Checklist

### Metrics to Watch
| Metric | Target | Alert If |
|--------|--------|----------|
| API Response Time (p95) | <500ms | >1s |
| Video Gen Success Rate | >95% | <90% |
| Payment Success Rate | >99% | <95% |
| Error Rate (Sentry) | <1% | >3% |
| D1 DB Size | <8GB | >9GB |

### Tools
- **Cloudflare Dashboard** — Worker logs, performance, D1
- **Inngest Dashboard** — Queue depth, failure rate
- **Sentry** — Error tracking
- **PostHog** — User analytics
- **Honeycomb** — Distributed tracing

---

## 🆘 Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|--------------|-----------------|
| P0 — Production Down | <30 min | On-call → Telegram ops channel → Claude |
| P1 — Feature Broken | <2h | Support team → Discord #ops |
| P2 — Minor Bug | <24h | GitHub Issues |
| P3 — Enhancement | Next sprint | V2 Backlog |

### Emergency Contacts
| Role | Contact |
|------|---------|
| Infrastructure | Cloudflare Support (paid plan) |
| Payments | NOWPayments: support@nowpayments.io |
| Video APIs | HeyGen: enterprise support |
| Internal | support@mekongmind.com |

---

## 📁 Important Paths

| Path | Purpose |
|------|---------|
| `apps/sophia-ai-factory/wrangler.toml` | CF Workers config |
| `apps/sophia-ai-factory/migrations/` | D1 migrations |
| `apps/sophia-ai-factory/scripts/deploy-with-sha.sh` | Deploy script |
| `docs/sophia-activation-runbook.md` | Full activation guide |
| `plans/260718-1200-handover-gate/` | Handover plan |

---

## 🔐 Security Checklist

- [ ] All secrets stored in wrangler secrets (not .env in prod)
- [ ] API keys encrypted in D1 (BYOK pattern)
- [ ] MFA enabled for admin accounts
- [ ] Webhook signatures verified (NOWPayments, HeyGen)
- [ ] Rate limiting on public endpoints
- [ ] CORS configured for production domains only

---

## 📈 Metrics & KPIs

Track these post-handover:
- **Acquisition:** Signups/week, activation rate (% who complete Setup Wizard)
- **Activation:** Time-to-first-video, setup wizard drop-off
- **Retention:** DAU/MAU, video gen frequency
- **Revenue:** MRR, churn rate, ARPU
- **Referral:** Affiliate conversion rate

---

**Runbook Version:** 1.0
**Next Review:** 2026-07-25 (weekly for first month)
**Maintained by:** Sophia Operations Team
