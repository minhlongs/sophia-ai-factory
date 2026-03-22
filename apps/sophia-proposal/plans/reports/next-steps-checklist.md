# Next Steps Execution Checklist

**Created:** 2026-03-20T05:17:00-07:00
**Owner:** CTO Agent / Human Team
**Deadline:** Gate 1 (2026-06-30)

---

## Week 1: Deploy Production

### 1.1 Cloudflare Pages Setup

- [ ] 1.1.1 Create Cloudflare account (if not exists)
  - URL: https://dash.cloudflare.com/sign-up
  - Tier: Free (for testing)

- [ ] 1.1.2 Install Wrangler CLI
  ```bash
  npm install -g wrangler
  wrangler login
  ```

- [ ] 1.1.3 Create Pages Project
  ```bash
  cd apps/sophia-proposal
  wrangler pages project create sophia-ai-factory \
    --production-branch main \
    --build-command "npm run build" \
    --build-output-dir ".next"
  ```

- [ ] 1.1.4 Connect GitHub Repository
  - Go to https://pages.cloudflare.com
  - Connect: `longtho638-jpg/sophia-ai-factory`
  - Branch: `main`
  - Root directory: `apps/sophia-proposal`

- [ ] 1.1.5 Configure Build Settings
  - Framework preset: Next.js
  - Build command: `npm run build`
  - Output directory: `.next`

**Estimated Time:** 30 minutes
**Dependencies:** None
**Owner:** CTO Agent

---

### 1.2 Supabase Migrations

- [ ] 1.2.1 Check Supabase project status
  - URL: https://supabase.com/dashboard
  - Project: Sophia AI Factory
  - Region: Singapore

- [ ] 1.2.2 Deploy migration 005 (video_tables)
  ```bash
  npx supabase db push \
    --db-url "$SUPABASE_CONNECTION_STRING" \
    --include-all
  ```

- [ ] 1.2.3 Deploy migration 006 (onboarding_tables)
  ```bash
  npx supabase db push \
    --db-url "$SUPABASE_CONNECTION_STRING" \
    --include-all
  ```

- [ ] 1.2.4 Verify tables created
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```

- [ ] 1.2.5 Verify RLS policies enabled
  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
  ```

**Estimated Time:** 15 minutes
**Dependencies:** Supabase project created
**Owner:** CTO Agent

---

### 1.3 Environment Variables

- [ ] 1.3.1 Add Supabase variables
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```

- [ ] 1.3.2 Add Polar.sh variables
  ```
  POLAR_API_KEY=pk_test_...
  POLAR_WEBHOOK_SECRET=whsec_...
  ```

- [ ] 1.3.3 Add Anthropic variable
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ```

- [ ] 1.3.4 Add HeyGen variables
  ```
  HEYGEN_API_KEY=...
  HEYGEN_WEBHOOK_SECRET=...
  ```

- [ ] 1.3.5 Add HubSpot variables
  ```
  HUBSPOT_CLIENT_ID=...
  HUBSPOT_CLIENT_SECRET=...
  HUBSPOT_REDIRECT_URI=https://sophia-ai-factory.pages.dev/api/crm/callback
  ```

- [ ] 1.3.6 Add Sentry variable
  ```
  NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
  ```

**Estimated Time:** 20 minutes
**Dependencies:** All API accounts created
**Owner:** CTO Agent

---

### 1.4 Deploy Test

- [ ] 1.4.1 Run local build test
  ```bash
  npm run build
  ```

- [ ] 1.4.2 Run local tests
  ```bash
  npm test
  ```

- [ ] 1.4.3 Run lint check
  ```bash
  npm run lint
  ```

- [ ] 1.4.4 Deploy to Cloudflare Pages
  ```bash
  ./scripts/deploy-cloudflare.sh
  ```

- [ ] 1.4.5 Verify deployment
  ```bash
  curl -I https://sophia-ai-factory.pages.dev
  # Expected: HTTP 200
  ```

- [ ] 1.4.6 Test homepage loads
  - Open: https://sophia-ai-factory.pages.dev
  - Verify: No console errors

- [ ] 1.4.7 Test auth pages
  - Open: /signup
  - Open: /login
  - Verify: Forms render correctly

- [ ] 1.4.8 Test proposal generation
  - Navigate: /proposals/new
  - Generate test proposal
  - Verify: PDF export works

**Estimated Time:** 30 minutes
**Dependencies:** Steps 1.1-1.3 complete
**Owner:** CTO Agent

---

## Week 2: Email + WebSocket Setup

### 2.1 Resend Email Configuration

- [ ] 2.1.1 Create Resend account
  - URL: https://resend.com
  - Verify domain

- [ ] 2.1.2 Get API key
  - Dashboard → API Keys
  - Copy key

- [ ] 2.1.3 Add environment variable
  ```
  RESEND_API_KEY=re_...
  ```

- [ ] 2.1.4 Test welcome email sequence
  ```bash
  # Trigger day_0 email manually
  curl -X POST https://sophia-ai-factory.pages.dev/api/email/test \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"template":"day_0","to":"test@example.com"}'
  ```

- [ ] 2.1.5 Verify email delivery
  - Check inbox
  - Verify: Email received within 5 seconds

**Estimated Time:** 20 minutes
**Dependencies:** Domain verified
**Owner:** Marketing Agent

---

### 2.2 WebSocket Setup (Real-time Sync)

- [ ] 2.2.1 Setup WebSocket server
  - Option A: Pusher (managed)
  - Option B: Ably (managed)
  - Option C: Self-hosted (ws + Redis)

- [ ] 2.2.2 Install WebSocket client
  ```bash
  npm install pusher-js
  ```

- [ ] 2.2.3 Configure `lib/collaboration/realtime-provider.tsx`
  ```typescript
  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: 'us2',
  });
  ```

- [ ] 2.2.4 Test real-time sync
  - Open 2 browser tabs
  - Edit proposal in tab 1
  - Verify: Changes appear in tab 2

**Estimated Time:** 45 minutes
**Dependencies:** None
**Owner:** CTO Agent

---

## Week 2-4: Pilot Recruitment

### 3.1 LinkedIn Outreach

- [ ] 3.1.1 Build target list (100 agencies)
  - Criteria: 5-50 employees, SEA region
  - Source: LinkedIn Sales Navigator

- [ ] 3.1.2 Send 20 connection requests/day
  - Template:
  ```
  Hi [Name], noticed you run [Agency] — impressive work!

  Building Sophia AI: proposals in 30s vs 20hrs.
  Would love to connect.

  Best,
  [Your Name]
  ```

- [ ] 3.1.3 Follow-up sequence (5 messages)
  - Day 1: Connection accepted → Thank you
  - Day 3: Value-first (blog post)
  - Day 7: Soft pitch
  - Day 14: Demo offer
  - Day 21: Break-up

**Estimated Time:** 1 hour/day
**Dependencies:** None
**Owner:** CEO Agent

---

### 3.2 Demo Calls

- [ ] 3.2.1 Setup Calendly
  - URL: https://calendly.com/sophia-ai/demo
  - Duration: 30 minutes
  - Questions: Company size, current proposal process

- [ ] 3.2.2 Prepare demo script
  - 5 min: Problem discovery
  - 15 min: Product demo
  - 5 min: Q&A
  - 5 min: Next steps

- [ ] 3.2.3 Schedule 10 demo calls
  - Target: 2/week
  - Goal: Close 50% → 5 pilots

**Estimated Time:** 2 hours/week
**Dependencies:** LinkedIn connections accepted
**Owner:** CEO Agent

---

### 3.3 Pilot Onboarding

- [ ] 3.3.1 Create pilot welcome email
  - Subject: Welcome to Sophia AI Factory! 🎉
  - Include: Onboarding checklist, support contact

- [ ] 3.3.2 Schedule onboarding calls
  - Duration: 30 minutes
  - Agenda: Setup, first proposal, Q&A

- [ ] 3.3.3 Create case study template
  - Before/After metrics
  - Testimonial quote
  - Logo permission

**Estimated Time:** 2 hours/pilot
**Dependencies:** Demo calls completed
**Owner:** Success Agent

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Production Deploy | GREEN | ⏳ Pending | Not Started |
| Email Config | Working | ⏳ Pending | Not Started |
| WebSocket Sync | Working | ⏳ Pending | Not Started |
| LinkedIn Connections | 100 | 0 | Not Started |
| Demo Calls | 10 | 0 | Not Started |
| Paid Pilots | 10 | 0 | Not Started |
| MRR | $5K | $0 | Not Started |

---

## Blockers + Mitigations

| Blocker | Impact | Mitigation | Owner |
|---------|--------|------------|-------|
| Polar.sh SEA payments | High | Stripe fallback | CEO |
| HeyGen API delays | Medium | D-ID fallback | CTO |
| Low demo conversion | High | Refine pitch | CEO |
| WebSocket complexity | Low | Use managed (Pusher) | CTO |

---

## Weekly Cadence

**Monday:**
- [ ] Team standup (15 min)
- [ ] Review pipeline metrics
- [ ] Set weekly goals

**Wednesday:**
- [ ] Demo call debrief
- [ ] Product feedback sync

**Friday:**
- [ ] Pipeline review
- [ ] Metrics report
- [ ] Week planning

---

**Created:** 2026-03-20T05:17:00-07:00
**Next Review:** 2026-03-27 (Weekly)
**Gate 1 Deadline:** 2026-06-30
