# Sophia AI Factory — CEO Quick Start

> **Target:** Media Company CEO  
> **Delivery Date:** 2026-06-13  
> **Status:** Production Ready (https://sophia.agencyos.network)

---

## 1. What You Got

Sophia AI Factory là **no-code RaaS platform** cho CEOs không có technical background:

- ✅ Fully deployed on Cloudflare Workers
- ✅ Automated AI video creation pipeline
- ✅ Payment integration (NOWPayments USDT + PayOS VietQR)
- ✅ Telegram bot for campaign management
- ✅ Setup Wizard cho customer self-onboarding (BYOK)

---

## 2. First 5 Minutes

```bash
# Clone và setup
git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
cd sophia-ai-factory/apps/sophia-ai-factory
npm install

# Copy env template
cp .env.example .dev.vars
# Edit .dev.vars — add your API keys (OpenRouter, ElevenLabs, etc.)

# Run locally
npm run dev
# → http://localhost:3000
```

---

## 3. Deploy to Production

**Single command:**

```bash
cd apps/sophia-ai-factory
npm run deploy:full
```

**Mandatory rule:** Push before deploy.

```bash
git push origin main   # MUST run BEFORE npm run deploy:full
```

**Verify:**

```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA | Live: $LIVE_SHA"
# Must match → deploy thành công
```

---

## 4. Run Tasks via Agent Team

Project có sẵn **6 AI agents** để tự động hóa công việc:

```bash
# Orchestrator — định tuyến yêu cầu đến đúng team
mekong --agent sophia-orchestrator "Add new feature X"

# CTO — tech, security, infra
mekong --agent cto "Review build output and run deploy verification"

# CMO — content, docs, SEO
mekong --agent cmo "Write LinkedIn post about BYOK launch"

# CSO — sales, pricing, churn
mekong --agent cso "Analyze conversion drop last week"

# COO — ops, support, capacity
mekong --agent coo "Generate support escalation playbook"

# Mekong CLI — cross-repo SDLC, eval
mekong --agent mekong-cli "Run integration tests and generate report"
```

Agents chạy **parallel** nếu task spans multiple domains.

---

## 5. Key URLs

| Purpose | URL |
|---------|-----|
| Production | https://sophia.agencyos.network |
| Health Check | https://sophia.agencyos.network/api/health (auth required) |
| Version (SHA) | https://sophia.agencyos.network/api/version |
| Telegram Bot | @Sophia_Bbot (/campaign, /status, /results) |

---

## 6. Secrets Required (Wrangler)

```bash
# Set all before first deploy
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put HEYGEN_API_KEY
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put CRON_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put CREDENTIALS_MASTER_KEY   # 64 hex chars
npx wrangler secret put BYOK_MASTER_KEY          # base64 32 bytes
```

Full list: `docs/deployment-guide.md`

---

## 7. Quality Gates (Non-Negotiable)

- ✅ `npm run build` → 0 TypeScript errors
- ✅ `npm test` → all pass (844+ tests)
- ✅ Zero `:any` types in production code
- ✅ Zero `console.log` in production
- ✅ Zod validation on all API inputs
- ✅ Deploy script exit 0 + SHA match

---

## 8. Troubleshooting

| Issue | Command |
|-------|---------|
| Build fails | `npm run build` (check errors) |
| Tests fail | `npm test` |
| Deploy rejected | Check unpushed commits: `git log origin/main..HEAD` |
| Stale deploy | SHA mismatch → re-run `npm run deploy:full` |
| Rollback | `npx wrangler rollback --name sophia-ai-factory --yes` |

Full guide: `docs/troubleshooting.md`

---

## 9. Architecture at a Glance

```
src/
├── seed/      (foundational: types, DB client, auth)
├── tree/      (domain reusable: BYOK, audit, Telegram)
├── forest/    (orchestrators: Inngest, RAAS, metering)
└── land/      (business: billing, payouts, affiliates)
```

Full spec: `docs/codebase-summary.md` (740 lines, comprehensive)

---

## 10. Support Resources

- **Project Constitution:** `CLAUDE.md` (read first)
- **Deployment Guide:** `docs/deployment-guide.md`
- **Code Standards:** `docs/code-standards.md`
- **Agent Orchestration:** `.sophia-factory/orchestrator.md`
- **Agent Definitions:** `.sophia-factory/agents/` (6 agents)

---

## TL;DR — Ship Today

```bash
# 1. Setup secrets
npx wrangler secret put <all-keys>

# 2. Push then deploy
git push origin main
cd apps/sophia-ai-factory && npm run deploy:full

# 3. Verify SHA match
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Should equal: git rev-parse HEAD | cut -c1-8

# 4. Run agent tasks as needed
mekong --agent sophia-orchestrator "your request"
```

**Production:** https://sophia.agencyos.network ✅  
**Status:** GREEN — Ready for CEO Media company

---

*Generated: 2026-06-13*  
*Project: Sophia AI Factory — Binh Phap Venture Studio*
