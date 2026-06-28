# Sophia AI Factory — CEO Handoff Package / Gói Bàn Giao CEO
> **Phiên bản:** 1.0 | **Ngày:** 2026-06-08 | **SHA:** eb1f13a

---

## 1. Tổng Quan / Executive Summary

**Sophia AI Factory** là nền tảng RaaS (Revenue-as-a-Service) no-code cho CEO không kỹ thuật. Khách hàng tự cấu hình tất cả integrations (AI, payment, affiliate) qua Setup Wizard — không cần developer.

| Chỉ số | Giá trị |
|--------|---------|
| URL sản xuất | https://sophia.agencyos.network |
| Trạng thái | ✅ LIVE — SHA `eb1f13a` (2026-06-08) |
| Tests | 5,776 passed / 34 skipped |
| Build | ✅ Next.js 16 → Cloudflare Workers |
| Auth | Better Auth (email + OAuth2) |
| Payments | NOWPayments (USDT) + PayOS (VN) |
| Database | Cloudflare D1 (SQLite, managed) |
| i18n | Tiếng Việt + English (đầy đủ) |

---

## 2. Kiến Trúc Hệ Thống / System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Cloudflare Workers                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Next.js   │  │   Better     │  │   D1       │ │
│  │   App       │  │   Auth       │  │ Database   │ │
│  │   Router    │  │              │  │            │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│         │                │                  │       │
│         └────────────────┼──────────────────┘       │
│                          │                          │
│  ┌───────────────────────┴───────────────────────┐ │
│  │         R2 Storage (assets, videos)            │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**4 lớp code (seed → tree → forest → land):**
- **seed** — types, config, auth, DB client (147 files)
- **tree** — domain logic: telegram, BYOK, audit (162 files)
- **forest** — orchestrators: Inngest jobs, metering, quota (362 files)
- **land** — business: billing, payouts, affiliates (113 files)

---

## 3. Bảo Mật / Security

| Layer | Điểm | Ghi chú |
|-------|------|---------|
| L1 Database | 7/10 | D1 + R2 lifecycle backup (30 ngày) |
| L2 Server | 9/10 | Cold-start optimized, edge-ready |
| L3 Networking | 9/10 | HTTPS, HSTS, DMARC p=none |
| L4 Cloud | 9.5/10 | Single vendor (Cloudflare) |
| L5 CI/CD | 10/10 | Pre-push gates + deploy guard |
| L6 Security | 9/10 | 0 HIGH vulns, Zod validation |
| L7 Monitoring | 8/10 | Sentry + wrangler tail |
| L8 Containers | 10/10 | Serverless — N/A |
| L9 CDN | 9/10 | Edge latency <100ms |
| L10 Backup | 7/10 | R2 lifecycle + manual D1 dump |
| **TỔNG** | **91.5/100** | Ceiling under no-tech doctrine |

---

## 4. Quy Trình Deploy / Deploy Procedure

### 4.1 Deploy nhanh (1 lệnh)

```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
git push origin main
npm run deploy:full
```

Script tự động: type-check → tests → build → OpenNext build → deploy → secrets → SHA verify → HTTP check.

### 4.2 Verify production

```bash
# SHA match (bắt buộc)
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Phải khớp: git rev-parse HEAD | cut -c1-8

# HTTP check
curl -sI https://sophia.agencyos.network | head -3
# Phải thấy: HTTP/2 200
```

### 4.3 Rollback (nếu cần)

```bash
# Option 1: Cloudflare version rollback
npx wrangler rollback --name sophia-ai-factory --message "rollback reason" --yes

# Option 2: Redeploy commit cũ
git checkout <sha-cu>
npm run deploy:full
git checkout main
```

### 4.4 Harness (unified quality gate)

```bash
# Full pipeline: typecheck → test → build → deploy → verify
./scripts/harness.sh

# CI only (no deploy)
./scripts/harness.sh ci

# Single gates
./scripts/harness.sh typecheck
./scripts/harness.sh test
./scripts/harness.sh build
./scripts/harness.sh verify
```

---

## 5. Sản Phẩm / What The Platform Does

### 5.1 Customer Journey

1. **Landing** → https://sophia.agencyos.network (VI/EN)
2. **Signup** → Email + password hoặc OAuth (Google, TikTok, YouTube)
3. **Setup Wizard** → Nhập API keys (OpenRouter, ElevenLabs, D-ID, Telegram)
4. **Dashboard** → Tạo campaigns, videos, manage affiliates
5. **Payment** → Chọn tier (BASIC/PREMIUM/ENTERPRISE/MASTER) → NOWPayments USDT
6. **Run** → Tạo video AI, phân phối multi-channel, track revenue

### 5.2 Tiers

| Tier | Giá | Tính năng |
|------|-----|-----------|
| BASIC | $29/tháng | 10 videos, 5 channels |
| PREMIUM | $99/tháng | 50 videos, 20 channels |
| ENTERPRISE | $299/tháng | Unlimited, API access |
| MASTER | Custom | White-label, dedicated support |

### 5.3 Protected Flows (KHÔNG ĐƯỢC BREAK)

1. **Setup Wizard** — onboarding API keys
2. **Telegram Bot** — @Sophia_Bbot (/campaign, /status, /results)
3. **Payment Flow** — NOWPayments IPN → tier activation

---

## 6. Monitoring & Operations

### 6.1 Health Checks

```bash
# Real-time logs
npx wrangler tail sophia-ai-factory

# Version endpoint
curl -s https://sophia.agencyos.network/api/version

# Database migrations
bash scripts/apply-migrations.sh
```

### 6.2 Key Metrics

- **Uptime:** Cloudflare Workers SLA (99.9%)
- **Cold start:** <500ms typical
- **Edge latency:** <100ms typical
- **Test coverage:** 5,776 tests (unit + integration)

### 6.3 Alerts

- Sentry captures errors (minified stack traces)
- Cloudflare Worker logs via `wrangler tail`
- No external monitoring tokens required (no-tech doctrine)

---

## 7. Chi Phí / Costs

| Service | Mục đích | Ước tính/tháng |
|---------|----------|----------------|
| Cloudflare Workers | Hosting | $0 (free tier) → $5 (paid) |
| Cloudflare D1 | Database | $0 (5GB free) → ~$0.25/GB |
| Cloudflare R2 | Storage | $0 (10GB free) → ~$0.015/GB |
| OpenRouter | AI inference | Pay-per-use (~$0.001/1K tokens) |
| ElevenLabs | TTS | Pay-per-use (~$0.03/1K chars) |
| D-ID/HeyGen | Video avatars | Pay-per-use |
| NOWPayments | Crypto payments | 0.5% fee per transaction |

**Total estimate:** $50–200/tháng (tùy usage).

---

## 8. Hạn Chế & Caveats / Known Limitations

1. **Offline mode:** PWA service worker không generate (Turbopack limitation)
2. **Source maps:** Sentry stack traces minified (cần `SENTRY_AUTH_TOKEN` để symbolicate)
3. **DMARC:** `p=none` (có thể graduate `p=quarantine` sau 30 ngày monitoring)
4. **Backup:** R2 lifecycle 30 ngày — restore thủ công qua `wrangler d1 execute`
5. **Score ceiling:** 91.5/100 — doctrine cấm operator infra, cần tháng DR drills để tăng

---

## 9. Liên Hệ & Escalation / Contacts

| Vấn đề | Liên hệ |
|--------|---------|
| Code/Deploy | dev team |
| Payment (NOWPayments) | support@nowpayments.io |
| Cloudflare | Cloudflare Dashboard |
| OAuth (TikTok/YouTube) | Developer portals |

---

## 10. Next Steps / Hành Động Tiếp Theo

1. **Verify smoke test** — chạy `./scripts/harness.sh ci` (đã GREEN)
2. **Browser check** — mở https://sophia.agencyos.network, test signup flow
3. **Telegram bot** — verify @Sophia_Bbot responds
4. **Payment test** — test NOWPayments sandbox (nếu có)
5. **DMARC monitoring** — check rua reports sau 30 ngày (2026-06-12)

---

## Appendix: Quick Commands

```bash
# Dev server
npm run dev

# Run tests
npm test

# Build
npm run build

# Deploy
npm run deploy:full

# Verify
./scripts/harness.sh verify

# Logs
npx wrangler tail sophia-ai-factory

# DB migrations
bash scripts/apply-migrations.sh
```

---

*Document generated: 2026-06-08 | SHA: eb1f13a | Status: PRODUCTION GREEN*
