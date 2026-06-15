# Phase 01: Foundation Setup

## Context Links

- [Main Plan](./plan.md)
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Tailwind 4 Beta](https://tailwindcss.com/docs/v4-beta)
- [Framer Motion Canary](https://www.framer.com/motion/)
- [Polar.sh Docs](https://docs.polar.sh)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Initialize Next.js 15 project with Tailwind 4, Framer Motion (Canary), Supabase/Upstash connections, and Polar.sh SDK integration.

## Key Insights

- **Tailwind 4 Beta**: Uses new CSS-first architecture, requires `@tailwindcss/postcss` plugin
- **Framer Motion Canary**: Latest features for React 19 compatibility, may have breaking changes
- **Polar.sh SDK**: New provider, requires webhook setup for subscription events
- **Supabase + Upstash**: Dual-database strategy (Postgres for persistence, Redis for FSM)

## Requirements

### Functional Requirements
- Next.js 15 app router setup with TypeScript
- Tailwind 4 with custom design tokens
- Framer Motion animations for bot interactions
- Supabase client initialization (Auth + Database)
- Upstash Redis client for session state
- Polar.sh SDK configured with webhook endpoint

### Non-Functional Requirements
- Zero-downtime deployment to Vercel
- Environment variable validation (Zod schema)
- Build time < 10s
- Type safety enforced (no `any` types)
- Security: API keys in Vercel env vars only

## Architecture

```
apps/sophia-ai-factory/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── polar/route.ts    # Polar.sh webhook handler
│   │   │   └── health/route.ts       # Health check
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── clients/
│   │   │   ├── supabase-client.ts    # Supabase setup
│   │   │   ├── upstash-redis-client.ts # Redis setup
│   │   │   └── polar-client.ts        # Polar.sh SDK
│   │   ├── config/
│   │   │   └── environment-config.ts  # Env validation (Zod)
│   │   └── utils/
│   │       └── logger-utility.ts      # Structured logging
│   └── types/
│       └── global-types.d.ts
├── public/
├── tailwind.config.ts          # Tailwind 4 config
├── tsconfig.json
├── next.config.ts
└── package.json
```

**Data Flow**:
1. Next.js app boots → Load env vars (validated by Zod)
2. Initialize Supabase client (Auth + DB)
3. Initialize Upstash Redis (session FSM)
4. Initialize Polar.sh SDK (webhooks)
5. Health check endpoint returns status

## Related Code Files

### Files to Create
- `src/app/api/webhooks/polar/route.ts` - Polar.sh webhook handler
- `src/app/api/health/route.ts` - Health check endpoint
- `src/lib/clients/supabase-client.ts` - Supabase initialization
- `src/lib/clients/upstash-redis-client.ts` - Redis initialization
- `src/lib/clients/polar-client.ts` - Polar.sh SDK wrapper
- `src/lib/config/environment-config.ts` - Environment validation
- `src/lib/utils/logger-utility.ts` - Logging utility
- `src/types/global-types.d.ts` - Global TypeScript types
- `tailwind.config.ts` - Tailwind 4 configuration
- `next.config.ts` - Next.js configuration

### Files to Modify
- `package.json` - Add dependencies
- `.env.example` - Document required env vars
- `tsconfig.json` - Enable strict mode

### Files to Delete
- Any legacy PayPal components (per payment-provider.md rule)

## Implementation Steps

1. **Initialize Next.js 15 Project**
   ```bash
   npx create-next-app@latest sophia-ai-factory \
     --typescript --tailwind --app --src-dir \
     --import-alias "@/*"
   ```

2. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js @upstash/redis \
     @polar-sh/sdk telegraf framer-motion@canary zod
   npm install -D @tailwindcss/postcss@next
   ```

3. **Configure Tailwind 4**
   - Update `tailwind.config.ts` to use v4 syntax
   - Add custom design tokens (colors, spacing, typography)
   - Enable JIT mode and purge unused CSS

4. **Setup Environment Variables**
   - Create `.env.local` with:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`
     - `POLAR_ACCESS_TOKEN`
     - `POLAR_WEBHOOK_SECRET`
   - Create Zod schema in `src/lib/config/environment-config.ts`

5. **Initialize Supabase Client**
   - Create `src/lib/clients/supabase-client.ts`
   - Server client (with service role key)
   - Browser client (with anon key)
   - Type generation: `npx supabase gen types typescript`

6. **Initialize Upstash Redis Client**
   - Create `src/lib/clients/upstash-redis-client.ts`
   - Singleton pattern for connection reuse
   - TTL defaults for session state (24h)

7. **Initialize Polar.sh SDK**
   - Create `src/lib/clients/polar-client.ts`
   - Wrap SDK methods with error handling
   - Add types for subscription events

8. **Create Webhook Endpoint**
   - Create `src/app/api/webhooks/polar/route.ts`
   - Verify webhook signature using `POLAR_WEBHOOK_SECRET`
   - Log events to Supabase (audit trail)
   - Return 200 OK to prevent retries

9. **Create Health Check Endpoint**
   - Create `src/app/api/health/route.ts`
   - Check Supabase connection
   - Check Redis connection
   - Return JSON status

10. **Configure Next.js**
    - Update `next.config.ts`:
      - Enable React 19 features
      - Configure environment variables
      - Add security headers
      - Enable compression

11. **Setup Logging**
    - Create `src/lib/utils/logger-utility.ts`
    - Structured JSON logging
    - Log levels: debug, info, warn, error
    - Include request IDs for tracing

12. **Verify Build**
    ```bash
    npm run build
    # Must complete in < 10s
    # Zero TypeScript errors
    ```

## Todo List

- [ ] Initialize Next.js 15 project with TypeScript
- [ ] Install all dependencies (Supabase, Upstash, Polar.sh, Framer Motion)
- [ ] Configure Tailwind 4 with custom design tokens
- [ ] Setup environment variables with Zod validation
- [ ] Create Supabase client (server + browser)
- [ ] Create Upstash Redis client with singleton pattern
- [ ] Create Polar.sh SDK wrapper
- [ ] Implement Polar.sh webhook endpoint
- [ ] Implement health check endpoint
- [ ] Configure Next.js security headers
- [ ] Setup structured logging utility
- [ ] Verify build succeeds in < 10s
- [ ] Verify zero TypeScript errors
- [ ] Deploy to Vercel preview environment
- [ ] Test health endpoint returns 200 OK

## Success Criteria

- [x] Next.js 15 app builds successfully
- [x] Tailwind 4 classes render correctly
- [x] Framer Motion animations work in dev mode
- [x] Supabase client connects successfully
- [x] Upstash Redis client connects successfully
- [x] Polar.sh webhook endpoint returns 200 OK
- [x] Health check endpoint returns valid JSON
- [x] All environment variables validated via Zod
- [x] Zero TypeScript `any` types
- [x] Build time < 10s
- [x] Vercel preview deployment succeeds

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Framer Motion Canary breaking changes | High | Medium | Pin version, test animations thoroughly |
| Tailwind 4 Beta instability | Medium | Low | Use stable v3 fallback if needed |
| Polar.sh webhook signature validation fails | Medium | High | Test with Polar.sh webhook testing tool |
| Redis connection timeout | Low | Medium | Implement retry logic with exponential backoff |
| Supabase rate limits | Low | Low | Use connection pooling, cache queries |

## Security Considerations

- **API Keys**: Store in Vercel environment variables, NEVER commit to git
- **Webhook Verification**: Always verify Polar.sh webhook signature before processing
- **CORS**: Restrict API routes to authorized origins only
- **Rate Limiting**: Implement rate limiting on webhook endpoints (10 req/min)
- **Input Validation**: Use Zod schemas for all external inputs
- **Secrets Rotation**: Document process for rotating API keys

## Next Steps

After Phase 1 completion:
1. Proceed to [Phase 2: Bot Architecture](./phase-02-bot-architecture.md)
2. Verify all clients initialized correctly
3. Test webhook endpoint with Polar.sh CLI
4. Monitor Vercel deployment logs for errors
