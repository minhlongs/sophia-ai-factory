# Client Handover Documentation Package
# Tai Lieu Ban Giao Cho Khach Hang

> Sophia AI Video Factory — Complete Documentation Set
> Bo Tai Lieu Day Du Cho Sophia AI Video Factory

**Last Updated / Cap Nhat:** 2026-05-21

---

## Documents / Tai Lieu

| # | Document / Tai Lieu | Description / Mo Ta | Audience / Doi Tuong |
|---|---|---|---|
| 1 | [User Journey Visual Guide](./user-journey-visual-guide.md) | A-Z hanh trinh nguoi dung / Complete user journey with screen maps | CEO, All Users |
| 2 | [Getting Started](./getting-started.md) | Huong dan bat dau / First steps guide | New Users |
| 3 | [Telegram Bot Guide](./telegram-bot-guide.md) | Huong dan su dung bot / Bot commands & setup | All Users |
| 4 | [Pricing & Tiers](./pricing-and-tiers.md) | Bang gia goi dich vu / Plan comparison ($199-$4,999) | CEO, Sales |
| 5 | [FAQ](./faq.md) | Cau hoi thuong gap / Common questions | All Users |
| 6 | [Troubleshooting](./troubleshooting.md) | Xu ly su co / Issue resolution | All Users |
| 7 | [Deployment Guide](./deployment-guide.md) | Huong dan deploy CF-direct / Cloudflare deploy doctrine | Developers, Ops |
| 8 | [System Architecture](./system-architecture.md) | Kien truc he thong / Component diagram & data flow | Developers |
| 9 | [Credentials Handover](./credentials-handover.md) | Thong tin dang nhap & quyen truy cap / Access checklist | CEO, Admin |
| 10 | [Support Escalation](./support-escalation.md) | Ho tro & cam ket dich vu / Support tiers & SLA | CEO, All Users |

---

## Admin Ops Source of Truth / Nguon Su That Van Hanh

| # | Document / Tai Lieu | Description / Mo Ta | Audience / Doi Tuong |
|---|---|---|---|
| 1 | [Admin Ops Activation Checklist](./admin-ops/activation-checklist.md) | Go-live evidence tracker | Founder, Ops |
| 2 | [Payment & Pricing Source of Truth](./admin-ops/payment-pricing-source-of-truth.md) | Canonical billing and pricing rules | Founder, Sales, Ops |
| 3 | [Support Ticket SOP](./admin-ops/support-ticket-sop.md) | Ticket lifecycle, severity, escalation | Ops, Support |
| 4 | [Vendor Register](./admin-ops/vendor-register.md) | Production vendors, owners, secret locations | Founder, Ops |
| 5 | [Compliance Obligation Register](./admin-ops/compliance-obligation-register.md) | Legal and policy obligations | Founder, Ops |
| 6 | [First Customer Close SOP](./admin-ops/first-customer-close-sop.md) | Lead → payment → activation workflow | Founder, Sales, Ops |

---

## Technical Modules / Module Ky Thuat

| # | Module | Description / Mo Ta | Location |
|---|---|---|---|
| 1 | OpenClaw Gateway | Tu dong phan phoi noi dung da kenh / Multi-channel content distribution with self-healing retry | `src/tree/gateway/`, `src/lib/openclaw/` |
| 2 | Smart Resume Engine | Luu diem kiem tra / Checkpoint-based pipeline recovery for failed campaigns | `src/tree/gateway/smart-resume-engine.ts` |
| 3 | Auto-Discovery Scoring | Cham diem san pham lien ket / SPS scoring engine for affiliate products (Inngest cron, daily 8AM UTC) | `src/lib/discovery/affiliate-ai-scorer.ts` |
| 4 | Channel Adapters | Bo chuyen doi kenh / ClickBank, ShareASale ingestion + YouTube, TikTok, Telegram distribution | `src/tree/gateway/adapters/` |
| 5 | Campaign Pipeline | Quy trinh chien dich / Script → Voiceover → Video → Distribute (Inngest orchestration) | `src/forest/inngest/functions/generate-campaign.ts` |

---

## Screenshots / Hinh Chup Man Hinh

Screenshots captured from the actual app at `docs/screenshots/`:

| # | File | Screen / Man Hinh |
|---|---|---|
| 1 | `screenshots/01-setup-wizard-step1-system-check.png` | Setup Wizard — System Check (Buoc 1) |
| 2 | `screenshots/02-setup-wizard-step2-api-keys.png` | Setup Wizard — API Keys (Buoc 2) |
| 3 | `screenshots/03-landing-page-hero.png` | Landing Page — Full Page (Trang Chu) |
| 4 | `screenshots/04-pricing-page.png` | Pricing — 3 Plans (Bang Gia) |
| 5 | `screenshots/05-dashboard-main.png` | Dashboard — Stats & Campaigns (Tong Quan) |
| 6 | `screenshots/06-campaign-creation.png` | Campaign Creation — Templates (Tao Chien Dich) |
| 7 | `screenshots/07-campaigns-list.png` | Campaigns List (Danh Sach Chien Dich) |
| 8 | `screenshots/08-analytics.png` | Analytics — Charts & Metrics (Phan Tich) |
| 9 | `screenshots/09-settings.png` | Settings — Dashboard Layout (Cai Dat) |

---

## Quick Access / Truy Cap Nhanh

| What / Gi | Where / O Dau |
|---|---|
| Production Site | https://sophia.agencyos.network |
| Telegram Bot | @Sophia_Bbot |

---

## App Screen Map / Ban Do Man Hinh

```
sophia.agencyos.network
├── / ........................ Landing Page (Trang Chu)
│   ├── Hero Section
│   ├── Workflow Section
│   ├── Features Section
│   ├── Pricing Section
│   ├── Affiliate Discovery
│   ├── ROI Calculator
│   ├── FAQ Section
│   └── Footer
│
├── /setup-wizard ........... Setup Wizard (Thiet Lap)
│   ├── Step 1: System Check
│   ├── Step 2: AI Keys (OpenRouter + ElevenLabs + D-ID)
│   ├── Step 3: Database (Airtable)
│   └── Step 4: Finish & Launch
│
├── /dashboard .............. Dashboard (Trung Tam Dieu Khien)
│   ├── Stats Cards (Total / Active / Completed)
│   ├── Campaign List
│   ├── /dashboard/create .......... Create Campaign
│   ├── /dashboard/campaigns ....... Campaigns List
│   ├── /dashboard/campaigns/[id] .. Campaign Detail
│   ├── /dashboard/analytics ....... Analytics & Reports
│   └── /dashboard/settings ........ Settings & API Keys
│
├── /pricing ................ Pricing Page (Bang Gia)
│   ├── Starter — $199/thang
│   ├── Growth — $399/thang
│   ├── Premium — $799/thang
│   └── Master — $4,999 (mot lan)
│
└── /admin .................. Admin Panel (Quan Tri)
    ├── Dashboard
    ├── Affiliates
    ├── Features
    └── Settings & Integrations
```

---

## Tier Comparison / So Sanh Goi

| Feature | Starter ($199/mo) | Growth ($399/mo) | Premium ($799/mo) | Master ($4,999) |
|---|---|---|---|---|
| YouTube Channels | 1 | 3 | Unlimited | Unlimited |
| Campaigns/month | 10 | 50 | Unlimited | Unlimited |
| MCU credits | 1,000/mo | 5,000/mo | 20,000/mo | 100,000 |
| Templates | 5 | Unlimited | Unlimited + Custom | Unlimited + Custom |
| Support | Email 48h | Priority 24h | Priority 12h + Account Manager | Priority Technical 4h |
| Data Export | No | CSV, PDF | CSV, PDF, API | Full Access |
| API Access | No | Yes | Yes | Yes |
| Source Code | No | No | No | Yes |

---

## Support Contacts / Lien He Ho Tro

- **Telegram Bot:** @Sophia_Bbot (type `/help`)
- **Priority Support:** Growth, Premium, and Master plans
- **Fastest SLA:** Master plan
- **See:** [Support Escalation Guide](./support-escalation.md)
