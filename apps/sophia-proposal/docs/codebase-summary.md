# Sophia AI Factory — Codebase Summary

**Generated:** 2026-03-20
**Version:** 2.0.0 (Sprint 3 Complete)
**Tool:** Repomix v1.12.0

---

## Repository Overview

This is a Next.js application for Sophia AI Factory — an AI-powered proposal generation platform with usage-based billing via Polar.sh.

---

## Directory Structure

```
sophia-proposal/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, signup, magic-link)
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── billing/              # Billing management (Sprint 3)
│   │   ├── proposals/            # Proposal management (Sprint 2)
│   │   ├── templates/            # Template browser (Sprint 2)
│   │   └── usage/                # Usage dashboard (Sprint 3)
│   └── api/                      # API routes
│       ├── auth/                 # Auth endpoints (Sprint 1)
│       ├── billing/              # Billing endpoints (Sprint 3)
│       ├── feedback/             # NPS feedback (Sprint 3)
│       ├── onboarding/           # Onboarding status (Sprint 3)
│       ├── proposals/            # Proposal endpoints (Sprint 2)
│       └── webhooks/polar/       # Polar webhook handler (Sprint 3)
├── components/                   # React components
│   ├── billing/                  # Billing UI (Sprint 3)
│   ├── onboarding/               # Onboarding checklist (Sprint 3)
│   ├── surveys/                  # NPS survey (Sprint 3)
│   ├── landing/                  # Landing page components
│   └── ui/                       # Shared UI components
├── lib/                          # Business logic
│   ├── billing/                  # Billing module (Sprint 3)
│   │   ├── polar-client.ts       # Polar.sh API client
│   │   ├── mcu-pricing.ts        # MCU cost calculations
│   │   ├── usage-tracker.ts      # Usage logging
│   │   ├── balance-checker.ts    # Balance queries
│   │   └── pilot-onboarding.ts   # Pilot flow
│   ├── surveys/                  # Survey logic (Sprint 3)
│   │   └── nps.ts                # NPS calculations
│   ├── ai/                       # AI engine (Sprint 2)
│   │   ├── client.ts             # Anthropic client
│   │   ├── proposal-templates.ts # Templates
│   │   └── quality-check.ts      # Validation
│   ├── supabase/                 # Supabase client (Sprint 1)
│   │   ├── client.ts             # Server/client clients
│   │   └── auth.ts               # Auth helpers
│   └── validators/               # Zod schemas
├── tests/                        # Vitest tests
│   ├── billing/                  # Billing tests (Sprint 3)
│   │   ├── polar-checkout.test.ts
│   │   ├── webhook-handler.test.ts
│   │   ├── mcu-pricing.test.ts
│   │   └── balance-checker.test.ts
│   └── ai/                       # AI tests (Sprint 2)
├── docs/                         # Documentation (Sprint 3)
│   ├── SETUP.md                  # Setup guide
│   ├── system-architecture.md    # Architecture overview
│   ├── api-docs.md               # API documentation
│   ├── deployment-guide.md       # Deployment instructions
│   └── project-overview-pdr.md   # Project overview & PDR
├── plans/                        # Implementation plans
│   ├── 260320-0114-sprint-3-polar-billing/
│   │   ├── plan.md
│   │   ├── phase-01-database-schema.md
│   │   ├── phase-02-polar-client.md
│   │   ├── phase-03-checkout-api.md
│   │   ├── phase-04-webhook-handler.md
│   │   ├── phase-05-mcu-tracking.md
│   │   ├── phase-06-billing-ui.md
│   │   └── phase-07-pilot-onboarding.md
│   └── reports/                  # Agent reports
├── middleware.ts                 # Auth middleware (Sprint 1)
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
└── vitest.config.ts              # Vitest configuration
```

---

## Key Files by Sprint

### Sprint 1: Auth & Organization

| File | Purpose |
|------|---------|
| `lib/supabase/auth.ts` | Auth helpers, session management |
| `lib/supabase/client.ts` | Supabase client (server/browser) |
| `middleware.ts` | Route protection, org context injection |
| `app/api/auth/login/route.ts` | Login endpoint |
| `app/api/auth/signup/route.ts` | Signup endpoint |
| `app/api/auth/logout/route.ts` | Logout endpoint |
| `app/api/org/route.ts` | Organization management |

### Sprint 2: AI Proposal Engine

| File | Purpose |
|------|---------|
| `lib/ai/client.ts` | Anthropic Claude client |
| `lib/ai/proposal-templates.ts` | Template definitions |
| `lib/ai/quality-check.ts` | Output validation |
| `app/api/proposals/generate/route.ts` | AI generation endpoint |
| `app/api/proposals/route.ts` | List/create proposals |
| `app/api/proposals/[id]/route.ts` | Get/delete proposal |
| `app/api/templates/route.ts` | Template API |

### Sprint 3: Billing & Onboarding

| File | Purpose |
|------|---------|
| `lib/billing/polar-client.ts` | Polar.sh API client |
| `lib/billing/mcu-pricing.ts` | MCU cost calculations |
| `lib/billing/usage-tracker.ts` | Usage logging |
| `lib/billing/balance-checker.ts` | Balance queries |
| `lib/billing/pilot-onboarding.ts` | Pilot customer flow |
| `lib/surveys/nps.ts` | NPS survey logic |
| `app/api/webhooks/polar/route.ts` | Webhook handler |
| `app/api/billing/checkout/route.ts` | Checkout endpoint |
| `app/api/billing/portal/route.ts` | Portal endpoint |
| `app/api/billing/subscription/route.ts` | Subscription endpoint |
| `app/api/usage/route.ts` | Usage API |
| `app/api/onboarding/status/route.ts` | Onboarding status |
| `app/api/feedback/route.ts` | NPS feedback |

---

## Database Schema Summary

### Tables (lib/supabase/migrations/004_billing_tables.sql)

```sql
-- Sprint 1: Auth & Org
organizations
  - id, name, slug, created_at

organization_members
  - org_id, user_id, role (admin/member)

-- Sprint 2: Proposals
proposals
  - id, org_id, title, content, status, created_at

-- Sprint 3: Billing
subscriptions
  - id, org_id, polar_subscription_id, polar_customer_id
  - polar_product_id, tier_name, status
  - mcu_monthly, mcu_overage_rate
  - current_period_start, current_period_end
  - cancel_at_period_end, ended_at

org_balances
  - org_id (PK), balance, lifetime_credits, lifetime_used

usage_logs
  - id, org_id, feature, mcu_cost, metadata (JSONB)

billing_settings
  - org_id (PK), polar_customer_id, auto_recharge
  - recharge_threshold, recharge_amount

customer_feedback
  - id, org_id, survey_type, responses (JSONB), nps_score
```

### Database Functions

```sql
-- Credit MCU (idempotent)
credit_mcu_balance(p_org_id UUID, p_amount INTEGER, p_subscription_id TEXT)

-- Deduct MCU (atomic check + deduct)
deduct_mcu_balance(p_org_id UUID, p_amount INTEGER, p_feature TEXT, p_metadata JSONB)
  RETURNS BOOLEAN
```

---

## Test Coverage

### Billing Tests (tests/billing/)

| Test File | Coverage |
|-----------|----------|
| `polar-checkout.test.ts` | Checkout session creation, error handling |
| `webhook-handler.test.ts` | Webhook signature, event handlers, idempotency |
| `mcu-pricing.test.ts` | MCU cost calculations, tier discounts |
| `balance-checker.test.ts` | Balance queries, insufficient balance |

### AI Tests (tests/ai/)

| Test File | Coverage |
|-----------|----------|
| `quality-check.test.ts` | Proposal validation |
| `proposal-templates.test.ts` | Template rendering |

---

## Dependencies (package.json)

### Core

```json
{
  "next": "15.x",
  "react": "19.x",
  "typescript": "5.x"
}
```

### Database & Auth

```json
{
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "latest"
}
```

### Validation

```json
{
  "zod": "^3.x"
}
```

### Testing

```json
{
  "vitest": "^1.x",
  "@testing-library/react": "latest"
}
```

---

## Configuration Files

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Static export
  images: {
    unoptimized: true,  // Required for static export
  },
};

module.exports = nextConfig;
```

### tsconfig.json

Standard Next.js TypeScript configuration with strict mode enabled.

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test configuration
  },
});
```

---

## Environment Variables (.env.example)

```bash
# Anthropic (AI)
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (Database + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Polar.sh (Billing)
POLAR_API_URL=https://api.polar.sh
POLAR_API_KEY=sk_live_your_api_key
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret
```

---

## Code Patterns

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id');
    const supabase = createServerClient();

    // Business logic
    const result = await supabase.from('table').select('*');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MCU Cost Calculation Pattern

```typescript
import { calculateMcuCost } from '@/lib/billing/mcu-pricing';
import { logUsage } from '@/lib/billing/usage-tracker';

export async function POST(request: NextRequest) {
  const orgId = request.headers.get('x-org-id');
  const feature = 'proposal:text:basic';

  // Calculate cost
  const mcuCost = calculateMcuCost(feature, tierName);

  // Log usage and deduct balance
  const { success, error } = await logUsage({
    orgId,
    feature,
    metadata: { proposalId },
  });

  if (!success) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 402 }
    );
  }

  // Continue with business logic
}
```

### Webhook Handler Pattern

```typescript
export async function POST(request: NextRequest) {
  // 1. Get raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('x-polar-signature');

  // 2. Verify webhook signature
  const polarClient = getPolarClient();
  const isValid = polarClient.verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // 3. Parse and route to handler
  const event = JSON.parse(rawBody);
  await handleEvent(event);

  return NextResponse.json({ received: true });
}
```

---

## Build & Deploy

### Build Command

```bash
pnpm build
# Output: ./out directory (static export)
```

### Deploy Flow

```
git push origin main
    │
    ▼
GitHub Actions (CI/CD)
    │
    ▼
Vercel Auto-Deploy
    │
    ▼
Production: https://sophia.agencyos.network
```

---

## Related Documentation

- [System Architecture](./system-architecture.md)
- [API Documentation](./api-docs.md)
- [Deployment Guide](./deployment-guide.md)
- [Project Overview PDR](./project-overview-pdr.md)
- [Setup Guide](./SETUP.md)

---

**Generated by:** Repomix v1.12.0
**Generation Date:** 2026-03-20
**Total Files Packed:** 140+ files
**Total Tokens:** ~160,000+ tokens
