# Sophia AI Factory — Project Overview & PDR

**Version:** 2.0.0 (Sprint 3 Complete)
**Last Updated:** 2026-03-20
**Status:** Production Ready (Pilot Phase)

---

## Executive Summary

Sophia AI Factory is an AI-powered proposal generation platform that helps agencies create professional sales proposals in minutes. Built with Next.js, Cloudflare D1, and Polar.sh billing, the platform uses usage-based pricing (MCU - Machine Consumption Units) to charge customers based on actual usage.

### Key Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Sprint Completion | 3 sprints | ✅ Complete |
| Core Features | Auth, AI, Billing, Onboarding | ✅ Complete |
| Pricing Tiers | 4 tiers | ✅ Configured |
| Payment Integration | Polar.sh | ✅ Integrated |
| Pilot Onboarding | < 30 min setup | ✅ Implemented |

---

## Product Vision

**Mission:** Enable agencies to generate high-quality, AI-powered proposals 10x faster than manual creation.

**Target Customer:** Digital agencies, video production studios, marketing firms that create custom client proposals regularly.

**Value Proposition:**
- 10x faster proposal creation
- Professional, consistent formatting
- AI-powered content generation
- Usage-based pricing (pay for what you use)

---

## Sprint History

### Sprint 1: Auth & Organization Management (Complete)

**Duration:** 1 week
**Status:** ✅ Complete

**Features:**
- Custom JWT Auth integration (Web Crypto API)
- Organization management (create, join, switch)
- Role-based access control (admin/member)
- Protected routes via middleware

**Key Files:**
- `lib/db/client.ts`
- `middleware.ts`
- `app/api/auth/*`

---

### Sprint 2: AI Proposal Engine (Complete)

**Duration:** 1 week
**Status:** ✅ Complete

**Features:**
- Anthropic Claude integration
- Proposal template system
- AI-powered content generation
- Quality validation
- MCU cost tracking per generation

**Key Files:**
- `lib/ai/proposal-templates.ts`
- `lib/ai/quality-check.ts`
- `app/api/proposals/generate/route.ts`

---

### Sprint 3: Polar Billing + Pilot Onboarding (Complete)

**Duration:** 1 week
**Status:** ✅ Complete

**Features:**
- Polar.sh checkout integration
- Webhook handler for payment events
- MCU tracking system
- Usage dashboard
- Pilot onboarding flow
- NPS survey system

**Key Files:**
- `lib/billing/polar-client.ts`
- `lib/billing/usage-tracker.ts`
- `app/api/webhooks/polar/route.ts`
- `lib/surveys/nps.ts`

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Database | Cloudflare D1 |
| Auth | Custom JWT Auth (Web Crypto) |
| AI | Anthropic Claude API |
| Billing | Polar.sh |
| Hosting | Vercel |
| Testing | Vitest |

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  Landing Pages | Dashboard | Billing | Usage            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   NEXT.JS API LAYER                      │
│  /api/auth | /api/billing | /api/usage | /api/proposals │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                    │
│  Billing Module | AI Engine | Onboarding | Surveys      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│  Cloudflare D1 + Database Functions                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                       │
│  Polar.sh (Billing) | Anthropic (AI)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Business Model

### Pricing Tiers

| Tier | Price/Month | MCU Included | Overage Rate | Target Customer |
|------|-------------|--------------|--------------|-----------------|
| Starter | $49 | 500 MCU | $0.10/MCU | Small agencies |
| Growth | $149 | 2,000 MCU | $0.08/MCU | Growing studios |
| Premium | $499 | 10,000 MCU | $0.06/MCU | Established agencies |
| Master | $999 | 25,000 MCU | $0.05/MCU | Large production houses |

### MCU Consumption

| Feature | Base MCU Cost |
|---------|---------------|
| Proposal (basic text) | 10 MCU |
| Proposal (advanced) | 25 MCU |
| Proposal (enterprise) | 50 MCU |
| Video (short, <30s) | 100 MCU |
| Video (medium, 30-60s) | 250 MCU |
| Video (long, 60s+) | 500 MCU |
| Custom template | 50 MCU |
| PDF export | 5 MCU |

**Tier Discounts:**
- Growth: 10% off all features
- Premium: 20% off all features
- Master: 30% off all features

---

## Functional Requirements (PDR)

### FR-1: User Authentication

**Description:** Users must be able to create accounts, login, and manage organizations.

**Acceptance Criteria:**
- [ ] User can sign up with email/password
- [ ] User can login with credentials
- [ ] User can create organization
- [ ] User can invite members to organization
- [ ] User can switch between organizations
- [ ] Admin can manage member roles

**Status:** ✅ Complete (Sprint 1)

---

### FR-2: AI Proposal Generation

**Description:** Users can generate AI-powered proposals using templates.

**Acceptance Criteria:**
- [ ] User can select proposal template
- [ ] User can input project details
- [ ] System generates proposal using Claude
- [ ] Generated content passes quality check
- [ ] User can edit generated proposal
- [ ] User can save/export proposal
- [ ] MCU cost deducted on generation

**Status:** ✅ Complete (Sprint 2)

---

### FR-3: Billing & Subscription

**Description:** Users can subscribe to pricing tiers and manage billing.

**Acceptance Criteria:**
- [ ] User can view pricing tiers
- [ ] User can initiate checkout
- [ ] Polar checkout flow works
- [ ] Payment credits MCU balance
- [ ] Subscription status visible in dashboard
- [ ] User can cancel subscription
- [ ] Webhook handles all events correctly

**Status:** ✅ Complete (Sprint 3)

---

### FR-4: Usage Tracking

**Description:** System tracks MCU consumption per feature.

**Acceptance Criteria:**
- [ ] Each AI call logs usage
- [ ] MCU deducted from balance
- [ ] Insufficient balance returns HTTP 402
- [ ] User can view usage history
- [ ] User can view usage summary
- [ ] Usage grouped by feature and date

**Status:** ✅ Complete (Sprint 3)

---

### FR-5: Pilot Onboarding

**Description:** New customers complete onboarding flow within 30 minutes.

**Acceptance Criteria:**
- [ ] Welcome email sent after payment
- [ ] Onboarding checklist visible
- [ ] NPS survey scheduled for Day 7
- [ ] Milestones tracked (first proposal, call, feedback)
- [ ] Support access available

**Status:** ✅ Complete (Sprint 3)

---

### FR-6: NPS Survey System

**Description:** Collect feedback from pilot customers.

**Acceptance Criteria:**
- [ ] NPS survey triggered at Day 7
- [ ] User can submit score (0-10)
- [ ] User can add optional feedback
- [ ] NPS score calculated correctly
- [ ] Admin can view NPS stats

**Status:** ✅ Complete (Sprint 3)

---

## Non-Functional Requirements

### NFR-1: Security

**Requirements:**
- All API routes protected by auth
- RLS enabled on all database tables
- Webhook signature verification
- No secrets in codebase
- HTTPS enforced

**Status:** ✅ Complete

---

### NFR-2: Performance

**Requirements:**
- Page load < 2.5s (LCP)
- Build time < 10s
- API response < 500ms (p95)

**Status:** ✅ Met (Vercel deployment)

---

### NFR-3: Reliability

**Requirements:**
- Webhook idempotency (no duplicate credits)
- Atomic MCU balance operations
- Error handling on all async operations

**Status:** ✅ Complete

---

### NFR-4: Scalability

**Requirements:**
- Support 1000+ concurrent users
- Database queries optimized with indexes
- Static export for frontend

**Status:** ✅ Architecturally ready

---

## Database Schema

### Core Tables

```sql
-- Authentication & Org (Sprint 1)
users (Custom JWT Auth)
organizations (id, name, slug)
organization_members (org_id, user_id, role)

-- Proposals (Sprint 2)
proposals (id, org_id, title, content, status)

-- Billing (Sprint 3)
subscriptions (id, org_id, tier_name, status, mcu_monthly)
org_balances (org_id, balance, lifetime_credits, lifetime_used)
usage_logs (id, org_id, feature, mcu_cost, metadata)
billing_settings (org_id, polar_customer_id, auto_recharge)
customer_feedback (id, org_id, survey_type, responses, nps_score)
```

### Database Functions

```sql
-- Credit MCU balance (idempotent)
credit_mcu_balance(p_org_id UUID, p_amount INTEGER, p_subscription_id TEXT)

-- Deduct MCU balance (atomic check + deduct)
deduct_mcu_balance(p_org_id UUID, p_amount INTEGER, p_feature TEXT, p_metadata JSONB)
  RETURNS BOOLEAN
```

---

## API Endpoints

### Authentication (Sprint 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |

### Billing (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/billing/checkout` | Create checkout session |
| POST | `/api/billing/portal` | Create portal session |
| POST | `/api/billing/subscription` | Get/update subscription |
| POST | `/api/webhooks/polar` | Polar webhook handler |

### Usage (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/usage` | Get usage history + summary |

### Proposals (Sprint 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/proposals` | List/Create proposals |
| GET/DELETE | `/api/proposals/[id]` | Get/Delete proposal |
| POST | `/api/proposals/generate` | Generate AI proposal |

### Onboarding (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onboarding/status` | Get onboarding status |
| POST | `/api/feedback` | Submit NPS feedback |

---

## Success Metrics

### Product Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Pilot Customers | 0 | 10 by Q2 end |
| MRR | $0 | $5,000 by Q2 end |
| Activation Rate | N/A | > 60% (Day 7) |
| NPS Score | N/A | > 50 |
| MCU Burn Rate | N/A | Track weekly |

### Technical Metrics

| Metric | Status |
|--------|--------|
| Test Coverage | > 80% |
| Build Time | < 10s |
| API Latency (p95) | < 500ms |
| Uptime | 99.9% |

---

## Roadmap

### Q2 2026 (Current Quarter)

**April:**
- [ ] Onboard first 10 pilot customers
- [ ] Collect NPS feedback
- [ ] Iterate on proposal templates
- [ ] Add email integration (Resend)

**May:**
- [ ] Video generation integration
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] API rate limiting

**June:**
- [ ] Public launch (beyond pilot)
- [ ] Marketing website update
- [ ] SEO optimization
- [ ] Customer success playbook

### H2 2026 (Planned)

- Multi-language support
- White-label proposals
- Advanced template editor
- Integration with CRM tools
- Mobile app (React Native)

---

## Dependencies

### External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Cloudflare D1 | Database | $0 (Free tier) |
| Anthropic | AI proposal generation | ~$0.01/proposal |
| Polar.sh | Billing & payments | 5% + $0.50/transaction |
| Vercel | Hosting | $0 (Hobby tier) |

### Development Tools

| Tool | Purpose |
|------|---------|
| pnpm | Package manager |
| Vitest | Testing framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Polar.sh API changes | Low | High | Abstract client layer |
| Anthropic price increase | Medium | Medium | Multi-provider support |
| D1 query limits | Low | Medium | Query optimization + caching |
| Low pilot activation | Medium | High | Improved onboarding |
| Webhook failures | Low | High | Manual credit fallback |

---

## Related Documentation

- [System Architecture](./system-architecture.md)
- [API Documentation](./api-docs.md)
- [Deployment Guide](./deployment-guide.md)
- [Code Standards](./code-standards.md)
- [Setup Guide](./SETUP.md)

---

## Appendix: Sprint 3 Deliverables Checklist

### Phase 1: Database Schema ✅

- [x] subscriptions table
- [x] usage_logs table
- [x] org_balances table
- [x] billing_settings table
- [x] customer_feedback table
- [x] RLS policies
- [x] Database functions (credit/debit)

### Phase 2: Polar Client ✅

- [x] Polar API client class
- [x] Checkout session creation
- [x] Portal session creation
- [x] Webhook signature verification
- [x] Tier configuration

### Phase 3: Checkout API ✅

- [x] POST /api/billing/checkout
- [x] POST /api/billing/portal
- [x] POST /api/billing/subscription
- [x] Error handling
- [x] Input validation

### Phase 4: Webhook Handler ✅

- [x] POST /api/webhooks/polar
- [x] Signature verification
- [x] Event deduplication
- [x] Idempotency handling
- [x] Event handlers (subscription, order)

### Phase 5: MCU Tracking ✅

- [x] logUsage() function
- [x] getUsageHistory() function
- [x] getUsageSummary() function
- [x] Balance checker
- [x] HTTP 402 middleware

### Phase 6: Billing UI ✅

- [x] Billing dashboard page
- [x] Usage dashboard page
- [x] Upgrade button component
- [x] Usage chart component
- [x] Plan card component

### Phase 7: Pilot Onboarding ✅

- [x] Welcome email function
- [x] Onboarding checklist
- [x] NPS survey system
- [x] Milestone tracking
- [x] Feedback API endpoint

---

**Document Version:** 2.0.0
**Last Updated:** 2026-03-20
**Next Review:** 2026-03-27
