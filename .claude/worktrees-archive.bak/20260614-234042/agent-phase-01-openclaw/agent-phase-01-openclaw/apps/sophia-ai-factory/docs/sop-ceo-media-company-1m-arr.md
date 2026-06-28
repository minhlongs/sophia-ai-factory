# 🏛️ SOP Workflow: CEO Media Company — Từ Affiliate Link đến $1M ARR

> **Generated:** 2026-06-04 | **Author:** Sophia AI Factory | **Mode:** Solo Full Flow — Auto
> **Input:** `me idea "workflow thiết kế me idea - me solo full luồng SOPs của CEO công ty media từ lúc biết đến sophia qua affilate link đến khi kiếm được $1M ARR đầu tiên --auto"`

---

## 📊 Tổng Quan Hành Trình

```
[AFFILIATE LINK] → [SIGNUP] → [ONBOARD] → [FIRST $] → [SCALE] → [$1M ARR]
     (Phase 0)      (Phase 1)   (Phase 2)    (Phase 3)    (Phase 4)     (Phase 5)
      T=0h           T=24h       T=7d          T=30d         T=90d         T=12mo
```

**Milestone Gates (MRR checkpoints):**

| Gate | MRR | Timeline | Gate Name |
|------|-----|----------|-----------|
| G0 | $0 → $100 | Week 1 | First Customer |
| G1 | $100 → $1K | Month 1 | Product-Market Fit Signal |
| G2 | $1K → $10K | Month 3 | Repeatable Sales |
| G3 | $10K → $100K | Month 6 | Scalable Engine |
| G4 | $100K → $1M | Month 12 | $1M ARR |

---

## 🎯 PHASE 0: DISCOVERY (T=0h) — Affiliate Link Click

**Actor:** CEO (chưa phải customer)
**Trigger:** Click affiliate link từ content creator / SOP marketplace
**Channel:** `sophia.agencyos.network/ref/{code}`

### Step 0.1 — Landing Page Impression

- **Action:** Truy cập `/ref/{affiliate_code}` → redirect sang landing `/` với UTM params
- **Expected:** Hero section visible trong <3s, pricing preview, demo video
- **SOP Gate:** `gate_landing_load` → HTTP 200 + LCP < 2.5s
- **Evidence:** `affiliate_click_{code}_{timestamp}.json`

### Step 0.2 — Affiliate Attribution Capture

- **Action:** Sophia ghi nhận `affiliate_code` vào session + cookie (30d TTL)
- **DB Write:** `affiliate_clicks` row (code, timestamp, IP hash, user_agent_hash)
- **SOP Gate:** `gate_attribution_recorded` → row exists trong D1
- **Attribution Chain:** click → signup → first_payment → MRR (12-month window)

### Step 0.3 — Value Proposition Absorption

- **Action:** CEO đọc landing page: "AI Factory for Media Companies"
- **Key Messages:**
  - Tự động hóa content production (script → video → publish)
  - Revenue từ affiliate marketplace (70/30 split)
  - No-code setup wizard + Telegram bot control
- **Decision Point:** Interested? → Signup | Not interested? → Exit

---

## 🚀 PHASE 1: SIGNUP & SETUP (T=0h → T=24h) — First Login

**Actor:** CEO (đã signup, chưa active)
**Trigger:** Click "Get Started" → nhập email → verify OTP

### Step 1.1 — Account Creation

- **Action:** Đăng ký tài khoản (email + password hoặc OAuth)
- **Auth Flow:** Better Auth → D1 `users` row inserted
- **Tier Mặc Định:** `BASIC` (free trial 14 days)
- **SOP Gate:** `gate_user_created` → user row exists, email verified

### Step 1.2 — Setup Wizard (5 Steps)

- **Duration:** ~15 phút

#### Step 1.2.1 — Company Profile

- **Input:** company_name, industry (media), team_size, monthly_content_target
- **Output:** `company_profiles` row

#### Step 1.2.2 — Content Niche

- **Input:** primary niche (e.g., fashion tech, finance, lifestyle)
- **Output:** `user_preferences.niche` set

#### Step 1.2.3 — Channel Config

- **Input:** YouTube channel ID, TikTok handle, blog URL
- **Output:** `channels` rows (platform, handle, status='pending')

#### Step 1.2.4 — BYOK Keys (Optional)

- **Input:** OpenRouter API key, ElevenLabs key (hoặc skip → dùng Sophia platform keys)
- **Output:** `user_api_keys` rows (encrypted via BYOK_MASTER_KEY)

#### Step 1.2.5 — Telegram Bot Pairing

- **Input:** Telegram chat ID với @Sophia_Bbot
- **Output:** `telegram_paired_chats` row

- **SOP Gate:** `gate_setup_complete` → wizard status = 'completed'

### Step 1.3 — First Mission (Auto-Video)

- **Action:** CEO thử nghiệm lệnh `/auto "fashion trends 2026"` trên Telegram
- **Pipeline:** SEO script → translate (optional) → description → video render → publish schedule
- **Expected Output:** Script + description + mock video URL (proof mode)
- **SOP Gate:** `gate_first_mission` → engine_missions row status='succeeded'

---

## 💰 PHASE 2: FIRST REVENUE (T=7d → T=30d) — $0 → $1K MRR

**Actor:** CEO + nhỏ content team
**Trigger:** Hệ thống đã onboard, CEO hiểu cách dùng

### Step 2.1 — Content Production Ramp

- **Action:** Chạy auto-video missions hàng ngày
- **Schedule:** 3-5 videos/tuần → 12-20 videos/tháng
- **Distribution:** Auto-publish lên YouTube, TikTok, blog
- **KPI Tracking:** views, engagement, affiliate clicks
- **SOP Gate:** `gate_content_ramp` → ≥10 videos trong 30 ngày

### Step 2.2 — Affiliate Revenue Activation

- **Action:** Đăng ký affiliate programs (Amazon Associates, CJ, Impact)
- **Sophia Role:** Inject affiliate links vào video descriptions qua `video-description-injector`
- **Attribution:** UTM params + click tracking → `affiliate_conversions` table
- **Revenue Split:**
  - Affiliate commissions → thuộc về CEO (100%)
  - Sophia platform fee: $0 trong trial → $99/tháng sau upgrade
- **SOP Gate:** `gate_first_affiliate_click` → affiliate_conversions row exists

### Step 2.3 — Tier Upgrade (BASIC → PREMIUM)

- **Trigger:** Trial 14 days hết → CEO thấy value → upgrade
- **Action:** Click `/pricing` → chọn PREMIUM ($99/tháng) → NOWPayments USDT
- **Payment Flow:**
  1. Sophia tạo NOWPayments invoice
  2. CEO thanh toán USDT
  3. Webhook IPN → D1 `subscriptions` row → tier = PREMIUM
  4. Unlock: unlimited missions, priority rendering, advanced analytics
- **SOP Gate:** `gate_first_payment` → subscriptions row status='active', tier=PREMIUM
- **Evidence:** First $99 payment confirmed → **MRR = $99**

### Step 2.4 — Team Onboarding (Optional)

- **Action:** CEO mời team members qua `/invite`
- **Roles:** Editor, Scriptwriter, Publisher
- **Seats:** PREMIUM includes 3 seats; extra seats $29/người
- **SOP Gate:** `gate_team_active` → ≥1 team member logged in trong 7 ngày

---

## 📈 PHASE 3: SCALE (T=90d → T=180d) — $1K → $10K MRR

**Actor:** CEO + team (3-5 người)
**Trigger:** Content engine đã chạy ổn định, có brand recognition

### Step 3.1 — Multi-Channel Expansion

- **Action:** Mở rộng từ 1 channel → 3-5 channels
- **New Channels:** Instagram, Twitter/X, LinkedIn, newsletter
- **Sophia Role:** Auto-adapt content format cho từng platform
- **KPI:** cross-channel followers, engagement rate
- **SOP Gate:** `gate_multi_channel` → ≥3 active channels

### Step 3.2 — SOP Marketplace Monetization

- **Action:** CEO tự tạo SOP templates từ workflows đã success
- **Publish:** Upload lên Sophia SOP Marketplace
- **Revenue Model:**
  - Other users mở SOP → CEO nhận 70% MRR attributable
  - Attribution: `sop_id` tracked qua UTM + checkout flow
- **Example:** "Fashion Video Production SOP" → 50 creators mua → $2.5K MRR attributable
- **SOP Gate:** `gate_sop_published` → ≥1 SOP template live trên marketplace

### Step 3.3 — Enterprise Tier Consideration

- **Trigger:** MRR > $3K, cần white-label, custom integrations
- **Action:** Contact sales → upgrade ENTERPRISE ($499/tháng)
- **Benefits:** White-label dashboard, custom AI models, dedicated support
- **SOP Gate:** `gate_enterprise_interest` → sales inquiry submitted

### Step 3.4 — Agency Reseller Program

- **Action:** Đăng ký làm Sophia Reseller Agency
- **Model:** Mua Sophia wholesale → bán cho clients với markup
- **Wholesale:** $49/user/tháng (ENTERPRISE tier) → retail $199/user/tháng
- **Clients:** 10 small media agencies × $199 = $1,990 MRR (after wholesale)
- **SOP Gate:** `gate_reseller_active` → ≥3 clients onboarded

---

## 🚀 PHASE 4: GROWTH ENGINE (T=180d → T=360d) — $10K → $100K MRR

**Actor:** CEO + team (10-15 người) + reseller network
**Trigger:** Proven playbook, scalable systems

### Step 4.1 — Content Network Effect

- **Action:** Scale từ 5 → 20+ channels, 50-100 videos/tuần
- **Automation Level:**
  - Auto-script generation (AI)
  - Auto-voiceover (ElevenLabs BYOK)
  - Auto-video render (HeyGen BYOK)
  - Auto-publish schedule (multi-platform)
- **Revenue Streams:**
  - Ad revenue (YouTube Partner Program)
  - Affiliate commissions (multi-program)
  - SOP marketplace (70% share từ other creators)
  - Sophia reseller margin
- **SOP Gate:** `gate_content_volume` → ≥100 videos/tháng

### Step 4.2 — Strategic Partnerships

- **Action:** Partner với brands cho sponsored content
- **Model:** Brand pays $5K-$50K/tháng cho dedicated content series
- **Sophia Role:** Track sponsorship deals → revenue attribution
- **SOP Gate:** `gate_brand_deals` → ≥3 active sponsorships

### Step 4.3 — Employee #1-5 Hiring

- **Action:** Scale team từ solo → small agency
- **Hires:**
  - Content Strategist ($3K/tháng)
  - Video Editor ($2.5K/tháng)
  - Community Manager ($2K/tháng)
  - Sales/Biz Dev ($3.5K/tháng)
  - Finance/Admin ($2K/tháng)
- **Total OPEX:** $13K/tháng
- **SOP Gate:** `gate_team_scaled` → 5 FTE onboarded

### Step 4.4 — International Expansion

- **Action:** Mở rộng sang 2-3 thị trường mới (US, EU, SEA)
- **Localization:** Dịch content + SOP templates sang EN, ES, VI
- **Revenue:** Cross-border affiliate programs, local brand deals
- **SOP Gate:** `gate_geo_expansion` → revenue từ ≥2 countries

---

## 🏆 PHASE 5: $1M ARR (T=12 months) — The Milestone

**Actor:** CEO + team (15-30 người) + reseller network (20-50 agencies)
**Trigger:** Compound growth từ all revenue streams

### Revenue Breakdown at $1M ARR (Directional)

| Revenue Stream | % of ARR | $/year | Notes |
|---------------|----------|--------|-------|
| **Ad Revenue** (YouTube, display) | 35% | $350K | 50M views/tháng × $0.70 RPM |
| **Affiliate Commissions** | 25% | $250K | Multi-program, 500K clicks/tháng |
| **Brand Sponsorships** | 20% | $200K | 10-15 deals/tháng × $15K avg |
| **SOP Marketplace (70% share)** | 10% | $100K | 100 active SOPs × $10K MRR pool |
| **Sophia Reseller Margin** | 7% | $70K | 50 agencies × $1.2K net/tháng |
| **Enterprise SaaS (Sophia platform)** | 3% | $30K | Team seats, premium features |

### Step 5.1 — Operational Excellence

- **Action:** Implement OKRs + quarterly business reviews
- **Systems:** CRM (HubSpot), Finance (QuickBooks), HR (Deel)
- **SOP Gate:** `gate_operational_maturity` → all departments have runbooks

### Step 5.2 — Next $1M (Year 2)

- **New Vectors:**
  - SaaS productization (white-label Sophia cho agencies)
  - Media buying services (paid media management)
  - Content licensing (syndication deals)
  - Acquisition targets (buy smaller media companies)
- **Target ARR Year 2:** $3M

---

## 🔄 Luồng SOP Theo Phòng Ban (Department SOP Chain)

```
CEO
 ├── [STRATEGY]   → ceo strategy         → quarterly OKRs + roadmap
 ├── [BUSINESS]   → ae-close-report      → deal tracking + forecast
 ├── [ACCOUNTING] → accounting-daily     → P&L + cash flow
 ├── [BOARD]      → board-minutes        → governance + compliance
 ├── [PRODUCT]    → product-roadmap      → feature prioritization
 ├── [ENGINEERING]→ backend-api-build    → API development
 ├── [QA]         → test-report          → quality gates
 ├── [DEVOPS]     → deploy-with-sha      → CI/CD pipeline
 ├── [LEGAL]      → audit-compliance     → regulatory checks
 └── [SALES]      → ae-outreach          → pipeline generation
```

---

## 📋 Evidence Contract (Gate Artifacts)

Mỗi gate bắt buộc tạo evidence file trong `plans/reports/`:

```json
{
  "gate": "gate_first_payment",
  "phase": "Phase 2",
  "timestamp": "2026-07-01T10:30:00Z",
  "status": "passed",
  "evidence": {
    "subscription_id": "sub_xxx",
    "tier": "PREMIUM",
    "amount_usd": 99,
    "payment_method": "NOWPayments_USDT",
    "mrr_after": 99,
    "milestone": "G0"
  },
  "next_gate": "gate_content_ramp"
}
```

---

## 🛡️ Anti-Patterns (Điều CEO phải tránh)

| Anti-Pattern | Risk | Mitigation |
|--------------|------|------------|
| Chạy nhiều tools cùng lúc | Overwhelm, burnout | 1 tool mỗi phase |
| Scale content trước khi có PMF | Waste, churn | Đợi G1 ($1K MRR) trước scale |
| Ignore unit economics | Unprofitable growth | Track CAC:LTV từ ngày đầu |
| No SOP từ early stage | Chaos ở scale | Document từ bước đầu tiên |
| Hire trước khi có revenue | Cash burn | Self-fund đến G2 ($10K MRR) |

---

## 🔗 Cross-References

- **SOP Creator Incentive:** `docs/sop-creator-incentive-program.md`
- **Production Smoke Test:** `docs/sop-ceo-production-smoke.md`
- **SOP Executor Engine:** `src/forest/sops/sop-executor.ts`
- **SOP Affiliate Links:** `src/land/sop-marketplace/sop-affiliate-links.ts`
- **Affiliate Scout Report:** `plans/reports/affiliate-scout-260503.md`
- **Auto-Video Mission:** `src/land/missions/auto-video-mission.ts`

---

## 📊 Revenue Ladder (Visual)

```
$0 ──────── $100 ──────── $1K ──────── $10K ──────── $100K ──────── $1M ARR
  │           │            │             │              │               │
  │ G0        │ G1         │ G2          │ G3           │ G4            │ G5
  │ First     │ PMF        │ Repeatable  │ Scalable     │ $1M ARR       │ $3M ARR
  │ Customer  │ Signal     │ Sales       │ Engine       │ Milestone      │ Year 2
  │           │            │             │              │               │
  Week 1     Month 1     Month 3      Month 6       Month 12
```

---

_Built by Sophia AI Factory | Input: `me idea "workflow thiết kế me idea - me solo full luồng SOPs của CEO công ty media từ lúc biết đến sophia qua affilate link đến khi kiếm được $1M ARR đầu tiên --auto"` | 2026-06-04_
