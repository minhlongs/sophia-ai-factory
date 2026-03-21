# Sophia AI Factory — Setup Guide

**Version:** 2.0.0 (Sprint 3)
**Last Updated:** 2026-03-20

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API keys (see Environment Variables below)

# 3. Run development server
pnpm dev

# 4. Build for production
pnpm build

# 5. Run tests
pnpm test
```

## Environment Variables

Required environment variables in `.env`:

### Core Services

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API token | Yes (AI features) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |

### Billing (Sprint 3)

| Variable | Description | Required |
|----------|-------------|----------|
| `POLAR_API_URL` | Polar API base URL | Yes (billing) |
| `POLAR_API_KEY` | Polar API key | Yes (billing) |
| `POLAR_WEBHOOK_SECRET` | Polar webhook signing secret | Yes (billing) |

### Getting Your API Keys

#### Anthropic API
1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Copy the key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

#### Supabase
1. Go to https://supabase.com/dashboard/project/_/settings/api
2. Copy `Project URL` to `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key to `SUPABASE_SERVICE_ROLE_KEY`

#### Polar.sh
1. Go to https://polar.sh/dashboard/settings/api
2. Copy API key to `POLAR_API_KEY`
3. Set up webhook (see [Deployment Guide](./deployment-guide.md))
4. Copy webhook secret to `POLAR_WEBHOOK_SECRET`

## Security Notes

- ✅ `.env` and `.env.local` are gitignored by default
- ✅ Never commit API tokens or secrets
- ✅ Rotate tokens periodically
- ✅ Use environment-specific files for different environments

## Project Structure

```
sophia-proposal/
├── app/                        # Next.js app router
│   ├── (dashboard)/            # Protected dashboard pages
│   │   ├── billing/            # Billing pages (Sprint 3)
│   │   │   ├── page.tsx        # Billing dashboard
│   │   │   ├── success/page.tsx # Payment success
│   │   │   └── upgrade/page.tsx # Upgrade page
│   │   ├── usage/              # Usage dashboard (Sprint 3)
│   │   │   └── page.tsx        # Usage tracking
│   │   └── proposals/          # Proposal management
│   ├── (auth)/                 # Auth pages
│   │   ├── login/
│   │   └── signup/
│   ├── api/                    # API routes
│   │   ├── auth/               # Auth endpoints
│   │   ├── billing/            # Billing endpoints (Sprint 3)
│   │   ├── usage/              # Usage endpoints (Sprint 3)
│   │   ├── webhooks/polar/     # Polar webhook handler (Sprint 3)
│   │   ├── proposals/          # Proposal endpoints
│   │   └── onboarding/         # Onboarding endpoints (Sprint 3)
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/
│   ├── billing/                # Billing components (Sprint 3)
│   │   ├── billing-status.tsx
│   │   ├── plan-card.tsx
│   │   ├── usage-chart.tsx
│   │   └── upgrade-button.tsx
│   ├── onboarding/             # Onboarding components (Sprint 3)
│   │   └── pilot-checklist.tsx
│   ├── surveys/                # Survey components (Sprint 3)
│   │   └── nps-survey.tsx
│   ├── landing/                # Landing page components
│   │   ├── hero-section.tsx
│   │   ├── features-section.tsx
│   │   └── pricing-section.tsx
│   └── ui/                     # UI components
│       └── button.tsx
├── lib/
│   ├── billing/                # Billing logic (Sprint 3)
│   │   ├── polar-client.ts     # Polar API client
│   │   ├── mcu-pricing.ts      # MCU cost calculations
│   │   ├── usage-tracker.ts    # Usage logging
│   │   ├── balance-checker.ts  # Balance queries
│   │   └── pilot-onboarding.ts # Pilot customer flow
│   ├── surveys/                # Survey logic (Sprint 3)
│   │   └── nps.ts              # NPS calculations
│   ├── ai/                     # AI proposal engine
│   │   ├── client.ts
│   │   ├── proposal-templates.ts
│   │   └── quality-check.ts
│   ├── supabase/               # Supabase client
│   │   ├── client.ts
│   │   └── auth.ts
│   └── validators/             # Zod schemas
├── tests/
│   ├── billing/                # Billing tests (Sprint 3)
│   │   ├── polar-checkout.test.ts
│   │   ├── webhook-handler.test.ts
│   │   ├── mcu-pricing.test.ts
│   │   └── balance-checker.test.ts
│   └── ai/                     # AI tests
├── docs/                       # Documentation
│   ├── SETUP.md
│   ├── system-architecture.md  # System architecture (Sprint 3)
│   ├── api-docs.md             # API documentation (Sprint 3)
│   └── deployment-guide.md     # Deployment guide (Sprint 3)
├── .env                        # Environment variables (gitignored)
├── .env.example               # Example environment file
└── .gitignore                  # Git ignore rules
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Static Export

The project is configured for static export (`output: 'export'`):

```bash
pnpm build
# Output: ./out directory
# Deploy anywhere (Netlify, Cloudflare Pages, S3, etc.)
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test -- app/page.test.tsx
```

## Code Quality

```bash
# TypeScript check
pnpm type-check

# Build (includes type check)
pnpm build
```
