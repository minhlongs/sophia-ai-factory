# User Flow / Hanh Trinh Nguoi Dung

> **Sophia AI Factory** — RaaS (Reasoning-as-a-Service) Platform
> Production: https://sophia.agencyos.network

**Last Updated:** 2026-03-26

---

## Overview

Complete user journey: Landing → Signup → Onboarding → Dashboard → Billing → Features → API.

**Stack:** Next.js 15.5 + Cloudflare Workers + D1 Database + Polar.sh Billing

---

## Flow Diagram

```mermaid
graph TD
    A[sophia.agencyos.network] --> B{Have account?}
    B -->|No| C[/signup]
    B -->|Yes| D[/login]

    C --> E[Email + Password]
    E --> F[POST /api/auth/signup]
    F --> G[JWT cookie set 7 days]

    D --> H[Email + Password OR Magic Link]
    H --> G

    G --> I{Has org?}
    I -->|No| J[/onboarding — Create Org]
    I -->|Yes| K[/dashboard]
    J --> K

    K --> L{Action?}
    L -->|New Mission| M[/missions/new]
    L -->|Upgrade Plan| N[/billing/upgrade]
    L -->|Get API Key| O[/settings/api-keys]
    L -->|View Usage| P[/usage]

    M --> Q[Select Template + Configure]
    Q --> R[POST /api/v1/missions]
    R --> S[queued → planning → executing → completed]

    N --> T[Select Tier]
    T --> U[Polar.sh Checkout]
    U --> V[Webhook → Tier Activated]
    V --> W[MCU Credits Added]

    O --> X[Generate sk_live_XXX]
    X --> Y[Use Bearer token for RaaS API]
```

---

## Phase 1: Discovery (Public)

| Step | Action | Route |
|------|--------|-------|
| 1 | Visit platform | `/` (shows landing page) |
| 2 | Explore features, pricing, demo | `/pricing`, `/blog`, `/docs/api` |
| 3 | Click "Sign Up" or "Get Started" | → `/signup` |

**Public pages:** `/`, `/landing`, `/pricing`, `/blog`, `/docs/api`, `/terms`, `/pilot`, `/status`

---

## Phase 2: Registration

### Option A: Email + Password
1. Go to `/signup`
2. Fill: org name, email, password
3. `POST /api/v1/onboard` → creates user + org + 200 MCU free credits
4. JWT `auth-token` cookie set (7 days, PBKDF2 hashing)
5. Redirect to `/dashboard`

### Option B: Magic Link
1. Go to `/login` → enter email → click "Magic Link"
2. `POST /api/auth/login` with `magicLink: true`
3. Email sent with 15-min token
4. Click link → `/magic-link?token=XXX`
5. `POST /api/auth/callback` → verify → JWT cookie set
6. Redirect to `/dashboard`

### Option C: Password Login
1. Go to `/login` → enter email + password
2. `POST /api/auth/login` → verify password → JWT cookie set
3. Redirect to `/dashboard`

---

## Phase 3: Onboarding

1. First login without org → redirect to `/onboarding`
2. Fill: org name, slug
3. `POST /api/v1/onboard` → org created in D1
4. Initial balance: **200 MCU free**
5. Redirect to `/dashboard`

---

## Phase 4: Dashboard

### Main Dashboard `/dashboard`
- Stats: Total Missions, MCU Balance, Active Proposals
- Quick Actions: New Mission, API Keys, View Usage

### Settings `/settings/api-keys`
Add external API keys for AI features:

| Key | Service | Purpose |
|-----|---------|---------|
| ANTHROPIC_API_KEY | Anthropic | AI proposal generation |
| RESEND_API_KEY | Resend | Email delivery |
| HEYGEN_API_KEY | HeyGen | Video generation (optional) |

### Navigation
- `/dashboard` — Overview
- `/missions` — Mission list + launcher
- `/proposals` — Proposal management
- `/usage` — MCU analytics (30-day chart)
- `/billing` — Subscription + upgrade
- `/settings/api-keys` — API key management
- `/referral` — Referral program (20% commission)
- `/affiliate` — Content generation
- `/analytics` — Metrics + conversions
- `/health` — System status

---

## Phase 5: Subscription & Billing

### View Plan `/billing`
Shows: current tier, MCU balance, usage chart, upgrade button

### Upgrade `/billing/upgrade`

| Tier | Price | MCU/month | Discount | Best For |
|------|-------|-----------|----------|----------|
| Starter | $49/mo | 500 | — | Solo consultants |
| Growth | $149/mo | 2,000 | 10% | Small agencies |
| Premium | $499/mo | 10,000 | 20% | Mid-size agencies |
| Master | $999/mo | 25,000 | 30% | Enterprise teams |

### Checkout Flow
1. Select tier → Polar.sh checkout (credit card)
2. Payment processed → `POST /api/webhooks/polar`
3. Webhook verifies signature → updates `billing_settings` in D1
4. MCU credits allocated → `/billing/success` confirmation

---

## Phase 6: Using Features

### Missions `/missions`
1. Click "New Mission" → `/missions/new`
2. Select template → configure inputs
3. `POST /api/v1/missions` → mission queued
4. Status tracking: `queued → planning → executing → verifying → completed`
5. View results at `/missions/[id]`

### MCU Cost Per Feature

| Feature | MCU Cost |
|---------|----------|
| `proposal:text:basic` | 10 |
| `proposal:text:advanced` | 25 |
| `proposal:text:enterprise` | 50 |
| `video:intro` | 100 |
| `video:section` | 250 |
| `video:full_proposal` | 500 |
| `affiliate:blog` | 50 |
| `affiliate:social` | 10 |
| `email:send` | 1 |
| `api:call` | 1 |

### MCU Balance Check
- Middleware checks balance for `/api/proposals/*` and `/api/video/*`
- Insufficient balance → `402 Payment Required`
- Balance derived from authenticated JWT (not headers)

---

## Phase 7: API Integration (RaaS)

### Generate API Key
1. `/settings/api-keys` → "Create New Key"
2. System generates: `sk_live_XXXXXXXX` (shown once)
3. User copies + stores securely

### API Usage

**Create Mission:**
```bash
curl -X POST https://sophia.agencyos.network/api/v1/missions \
  -H "Authorization: Bearer sk_live_XXX" \
  -H "Content-Type: application/json" \
  -d '{"template_id": "...", "inputs": {...}}'
```

**Check Status:**
```bash
curl https://sophia.agencyos.network/api/v1/missions/MISSION_ID \
  -H "Authorization: Bearer sk_live_XXX"
```

**Stream Progress (SSE):**
```bash
curl -N https://sophia.agencyos.network/api/v1/missions/MISSION_ID/stream \
  -H "Authorization: Bearer sk_live_XXX"
```

---

## Phase 8: Referral & Growth

### Referral `/referral`
- Get personal referral code
- Share link → referred users sign up
- Earn **20% monthly commission** on referrals

### Affiliate `/affiliate`
- Add affiliate programs (auto-scrape details)
- AI-generate content: blog posts, social media, videos
- Track clicks + conversions

### Analytics `/analytics`
- Command metrics, conversion tracking, export CSV

---

## For Non-Tech CEOs / Cho CEO Khong Biet Code

1. **Dang ky** tai sophia.agencyos.network/signup (email + mat khau)
2. **Chon goi** phu hop ($49–$999/thang) tai /billing/upgrade
3. **Them API key** (Anthropic, Resend) tai /settings/api-keys
4. **Tao mission** tai /missions/new — AI tu dong xu ly
5. **Theo doi** tien trinh tai /missions va /usage
6. **Kiem tien** gioi thieu ban be (20% hoa hong) tai /referral

**Khong can biet code. Khong can lam thu cong. Tu dong hoan toan.**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot login | Check email/password, try magic link |
| MCU balance 0 | Upgrade at /billing/upgrade |
| API returns 401 | Check Bearer token, regenerate key |
| API returns 402 | Insufficient MCU, top up credits |
| Page shows 500 | Check /status, report to support |
| Forgot password | Use magic link login |

**Support:** support@agencyos.network | **Status:** /status | **API Docs:** /docs/api
