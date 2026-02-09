# Client Handover Documentation Package
# Tai Lieu Ban Giao Cho Khach Hang

> Sophia AI Video Factory — Complete Documentation Set
> Bo Tai Lieu Day Du Cho Sophia AI Video Factory

**Last Updated / Cap Nhat:** 2026-02-09

---

## Documents / Tai Lieu

| # | Document / Tai Lieu | Description / Mo Ta | Audience / Doi Tuong |
|---|---|---|---|
| 1 | [User Journey Visual Guide](./user-journey-visual-guide.md) | A-Z hanh trinh nguoi dung / Complete user journey with screen maps | CEO, All Users |
| 2 | [Getting Started](./getting-started.md) | Huong dan bat dau / First steps guide | New Users |
| 3 | [Telegram Bot Guide](./telegram-bot-guide.md) | Huong dan su dung bot / Bot commands & setup | All Users |
| 4 | [Pricing & Tiers](./pricing-and-tiers.md) | Bang gia goi dich vu / Plan comparison | CEO, Sales |
| 5 | [FAQ](./faq.md) | Cau hoi thuong gap / Common questions | All Users |
| 6 | [Troubleshooting](./troubleshooting.md) | Xu ly su co / Issue resolution | All Users |
| 7 | [Design Guidelines](./design-guidelines.md) | Huong dan thiet ke / Visual identity | Developers |
| 8 | [System Architecture](./system-architecture.md) | Kien truc he thong / Component diagram & data flow | Developers |

---

## Technical Modules / Module Ky Thuat

| # | Module | Description / Mo Ta | Location |
|---|---|---|---|
| 1 | OpenClaw Gateway | Tu dong phan phoi noi dung da kenh / Multi-channel content distribution with self-healing retry | `src/lib/gateway/` |
| 2 | Smart Resume Engine | Luu diem kiem tra / Checkpoint-based pipeline recovery for failed campaigns | `src/lib/gateway/smart-resume-engine.ts` |
| 3 | Auto-Discovery Scoring | Cham diem san pham lien ket / SPS scoring engine for affiliate products (Inngest cron, daily 8AM UTC) | `src/lib/intelligence/scoring.ts`, `src/lib/discovery/affiliate-ai-scorer.ts` |
| 4 | Channel Adapters | Bo chuyen doi kenh / ClickBank, ShareASale ingestion + YouTube, TikTok, Telegram distribution | `src/lib/ingestion/adapters/`, `src/lib/gateway/adapters/` |
| 5 | Campaign Pipeline | Quy trinh chien dich / Script → Voiceover → Video → Distribute (Inngest orchestration) | `src/lib/inngest/functions/generate-campaign.ts` |

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
| Production Site | https://sophia.agency |
| Telegram Bot | @Sophia_Bbot |
| Support Email | support@sophia.agency |
| Sales Email | sales@sophia.agency |

---

## App Screen Map / Ban Do Man Hinh

```
sophia.agency
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
│   ├── BASIC — $500/thang
│   ├── PREMIUM — $1,200/thang
│   └── ENTERPRISE — $3,500/thang
│
└── /admin .................. Admin Panel (Quan Tri)
    ├── Dashboard
    ├── Affiliates
    ├── Features
    └── Settings & Integrations
```

---

## Tier Comparison / So Sanh Goi

| Feature | BASIC | PREMIUM | ENTERPRISE |
|---|---|---|---|
| Price/month | $500 | $1,200 | $3,500 |
| YouTube Channels | 1 | 3 | Unlimited |
| Videos/month | 20 | 100 | Unlimited |
| Templates | 5 | Unlimited | Unlimited + Custom |
| Support | Email | Priority 4h | 24/7 + Account Manager |
| Data Export | No | CSV, PDF | CSV, PDF, API |
| Auto YouTube Publish | No | Yes | Yes |

---

## Support Contacts / Lien He Ho Tro

- **Telegram Bot:** @Sophia_Bbot (type `/help`)
- **Email:** support@sophia.agency
- **Priority Support:** PREMIUM and ENTERPRISE plans
- **24/7 Support:** ENTERPRISE plan only
