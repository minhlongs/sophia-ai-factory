---
title: "Sprint 1 — Auth + Onboarding + Polar Setup"
description: "Week 1-2: Foundation for self-serve signup and billing"
phase: Market Validation
priority: P1
effort: 2 weeks
status: pending
created: 2026-03-19
---

# SPRINT 1 — AUTH + ONBOARDING + POLAR SETUP

**Dates:** Week 1-2 (2026-03-23 to 2026-04-05)
**Owner:** CTO / Full-stack Engineer
**Target:** Users can self-serve signup without manual intervention

---

## Context Links

- Strategy: `../../reports/studio/strategy/SUMMARY.md`
- Technical Roadmap: `../../reports/studio/strategy/technical-roadmap.md`
- Supabase Docs: https://supabase.com/docs
- Polar.sh Docs: https://docs.polar.sh

---

## Overview

**Priority:** P1 (Critical Path)
**Status:** ✅ Completed (2026-03-20)
**Effort:** 2 weeks

This sprint establishes the foundation for the entire platform: user authentication, organization management, and billing infrastructure. Without these, no product features can be delivered or monetized.

---

## Key Insights

From execution-plan.md:
- **Gate 1 Deadline:** 2026-06-30 (10 paid pilots at $499/mo)
- **Critical Dependency:** Polar.sh must support SEA payment methods
- **Risk:** Auth delays cascade to all subsequent sprints

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Users can sign up with email/password | P1 |
| FR1.2 | Users can login with magic link or password | P1 |
| FR1.3 | Users can create organization during onboarding | P1 |
| FR1.4 | Users can invite team members to organization | P2 |
| FR1.5 | Polar.sh checkout for 4 pricing tiers | P1 |
| FR1.6 | Webhook handler for subscription events | P1 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1.1 | Auth latency | <500ms |
| NFR1.2 | Session security | JWT + HTTP-only cookies |
| NFR1.3 | Password policy | Min 8 chars, complexity |
| NFR1.4 | MFA support | TOTP optional |
| NFR1.5 | Webhook reliability | 99.9% delivery rate |

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  /signup     │  │  /login      │  │  /onboarding │  │
│  │  /dashboard  │  │  /settings   │  │  /billing    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Edge)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  /api/auth/* │  │  /api/org/*  │  │  /api/bill/* │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase   │  │  Polar.sh    │  │   Resend     │
│   (Auth+DB)  │  │  (Billing)   │  │   (Email)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Data Model (Sprint 1 Tables)

```sql
-- Users (managed by Supabase Auth)
users (
  id uuid primary key,
  email text unique not null,
  created_at timestamptz default now()
)

-- Organizations
organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- Organization Members
org_members (
  org_id uuid references organizations(id),
  user_id uuid references users(id),
  role text not null default 'member',
  created_at timestamptz default now(),
  primary key (org_id, user_id)
)

-- Subscriptions (synced from Polar.sh webhooks)
subscriptions (
  id uuid primary key,
  org_id uuid references organizations(id),
  polar_subscription_id text unique,
  tier text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now()
)

-- MCU Transactions (for usage tracking)
mcu_transactions (
  id uuid primary key,
  org_id uuid references organizations(id),
  amount integer not null,
  type text not null,
  reference_id text,
  created_at timestamptz default now()
)
```

### Row-Level Security (RLS) Policies

```sql
-- Users can only see their own organizations
create policy "Users can view their orgs"
  on organizations for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
    )
  );

-- Org members can only view their org's subscriptions
create policy "Members can view org subscriptions"
  on subscriptions for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = subscriptions.org_id
      and org_members.user_id = auth.uid()
    )
  );
```

---

## Related Code Files

### Files to Create

```
app/
├── (auth)/
│   ├── signup/
│   │   └── page.tsx              # Signup form
│   ├── login/
│   │   └── page.tsx              # Login form
│   ├── magic-link/
│   │   └── page.tsx              # Magic link handler
│   └── layout.tsx                 # Auth layout
├── onboarding/
│   ├── page.tsx                   # Org creation wizard
│   └── welcome.tsx                # Welcome component
├── dashboard/
│   └── page.tsx                   # Main dashboard
└── api/
    ├── auth/
    │   ├── signup/route.ts        # POST /api/auth/signup
    │   ├── login/route.ts         # POST /api/auth/login
    │   └── logout/route.ts        # POST /api/auth/logout
    ├── org/
    │   ├── route.ts               # GET/POST /api/org
    │   └── members/route.ts       # GET/POST /api/org/members
    └── webhooks/
        └── polar/route.ts         # POST /api/webhooks/polar

lib/
├── supabase/
│   ├── client.ts                  # Supabase client setup
│   ├── auth.ts                    # Auth helpers
│   └── rls.ts                     # RLS policy helpers
├── polar/
│   ├── client.ts                  # Polar API client
│   ├── products.ts                # Product/tier definitions
│   └── webhook.ts                 # Webhook signature verification
└── validators/
    ├── auth.ts                    # Zod schemas for auth
    └── org.ts                     # Zod schemas for org

components/
├── auth/
│   ├── signup-form.tsx
│   ├── login-form.tsx
│   └── magic-link-form.tsx
├── onboarding/
│   ├── org-setup-form.tsx
│   └── welcome-checklist.tsx
└── dashboard/
    ├── dashboard-header.tsx
    └── quick-start.tsx

tests/
├── auth/
│   ├── signup.test.ts
│   ├── login.test.ts
│   └── rls.test.ts
└── api/
    ├── org.test.ts
    └── webhook.test.ts
```

### Files to Modify

```
app/
├── layout.tsx                     # Add auth provider
└── globals.css                    # Add auth page styles

lib/
└── utils.ts                       # Add auth helpers

.env.local                         # Add Supabase + Polar keys
```

---

## Implementation Steps

### Week 1: Auth Foundation

**Day 1-2: Supabase Setup**

1. Create Supabase project (Singapore region)
2. Configure auth providers (email/password, magic link)
3. Run migrations for organizations, org_members tables
4. Enable RLS policies
5. Set up Resend for transactional emails

**Day 3-4: Auth UI Components**

1. Build `/signup` page with form validation
2. Build `/login` page with password + magic link tabs
3. Implement auth context provider
4. Add protected route middleware

**Day 5: Organization Management**

1. Build `/onboarding` wizard (org name, slug, industry)
2. Create `/api/org` endpoints (create, get, update)
3. Test org creation flow end-to-end

### Week 2: Polar Integration + Dashboard

**Day 6-7: Polar.sh Setup**

1. Create Polar.sh account and verify
2. Configure 4 products (Starter/Growth/Premium/Master)
3. Build `/api/billing/checkout` endpoint
4. Implement webhook signature verification

**Day 8-9: Webhook Handler**

1. Build `/api/webhooks/polar` endpoint
2. Handle events: subscription.created, subscription.updated, subscription.cancelled
3. Sync subscription status to database
4. Add MCU transaction logging

**Day 10: Dashboard + Testing**

1. Build basic `/dashboard` with org info
2. Add subscription status display
3. Full integration testing
4. Fix any auth/billing edge cases

---

## Todo List

### Week 1

- [ ] Create Supabase project (Singapore)
- [ ] Configure auth providers
- [ ] Run database migrations
- [ ] Enable RLS policies
- [ ] Set up Resend email
- [ ] Build signup page
- [ ] Build login page
- [ ] Implement auth context
- [ ] Add protected route middleware
- [ ] Build onboarding wizard
- [ ] Create /api/org endpoints

### Week 2

- [ ] Create Polar.sh account
- [ ] Configure 4 pricing tiers
- [ ] Build checkout endpoint
- [ ] Implement webhook handler
- [ ] Handle subscription events
- [ ] Sync MCU transactions
- [ ] Build basic dashboard
- [ ] Display subscription status
- [ ] Integration testing
- [ ] Bug fixes

---

## Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Auth working | Email + magic link | Test signup/login flows |
| Org creation | <2 min setup | Time from signup to dashboard |
| Polar configured | 4 tiers active | Verify in Polar dashboard |
| Webhook delivery | 99%+ success | Check webhook logs |
| No manual intervention | Self-serve | Zero human ops required |

### Validation Commands

```bash
# Test auth flow
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'

# Test org creation
curl -X POST http://localhost:3000/api/org \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Org","slug":"test-org"}'

# Test Polar webhook
curl -X POST http://localhost:3000/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: test" \
  -d @test-webhook-payload.json
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Supabase auth delays | Low | High | Use managed auth, skip custom |
| Polar.sh not available in SG | Medium | Critical | Stripe fallback research |
| Webhook signature validation fails | Low | Medium | Follow Polar docs exactly |
| RLS policies too restrictive | Medium | Medium | Test with multiple users |
| Email deliverability issues | Low | Low | Use Resend (managed) |

---

## Security Considerations

### Authentication

- JWT tokens with short expiry (1 hour)
- Refresh tokens stored HTTP-only
- Password hashing via Supabase (bcrypt)
- MFA optional (TOTP)

### Authorization

- Row-Level Security (RLS) on all tables
- Organization isolation enforced at DB level
- API validates org membership on every request

### Data Protection

- All data encrypted at rest (Supabase default)
- TLS 1.3 for all API calls
- No PII in logs
- Webhook signatures verified

---

## Next Steps

**Dependencies for Sprint 2:**

1. Auth must be stable before AI proposal work
2. Polar webhook must sync MCU credits for usage tracking
3. Dashboard must show org context for proposal history

**Blockers to Resolve:**

- Polar.sh account approval (CEO to follow up)
- Resend domain verification (add DNS records)

---

_Document Version: 1.0.0_
_Created: 2026-03-19_
_Owner: CTO / Full-stack Engineer_
_Next Review: Sprint 1 Retro (2026-04-05)_
