# Sprint 4 Backlog — Sophia AI Factory

**Sprint:** 4 (Phase 2: Video AI + CRM)
**Dates:** 2026-05-04 to 2026-05-18 (2 weeks)
**Goal:** Ship Video AI Pipeline + CRM Sync + Analytics Dashboard

---

## Sprint Goals

### Primary Goals (Must Deliver)
1. ✅ Video AI Pipeline (HeyGen integration)
2. ✅ CRM Sync (HubSpot bidirectional)
3. ✅ Analytics Dashboard (AARRR funnel)

### Secondary Goals (Stretch)
- [ ] Production deployment
- [ ] 10 pilot customers recruited
- [ ] 20 blog posts published

---

## User Stories

### Epic 1: Video AI Pipeline

**Story 1.1: HeyGen Client Library**
```
As a: Developer
I want: A HeyGen API client
So that: I can generate videos from proposals

Acceptance Criteria:
- [ ] createVideo() function
- [ ] getVideoStatus() function
- [ ] getVideoUrl() function
- [ ] Error handling (rate limits, auth failures)
- [ ] Tests (100% coverage)

Estimate: 5 points
Owner: CTO Agent
Status: TODO
```

**Story 1.2: Video Generation API**
```
As a: User
I want: To generate a video from my proposal
So that: I can send video pitches to clients

Acceptance Criteria:
- [ ] POST /api/video/generate endpoint
- [ ] POST /api/video/webhook endpoint
- [ ] MCU balance check (HTTP 402 on zero)
- [ ] Webhook signature verification
- [ ] Tests (100% coverage)

Estimate: 8 points
Owner: CTO Agent
Status: TODO
```

**Story 1.3: Video React Components**
```
As a: User
I want: A video generator UI
So that: I can create and watch videos

Acceptance Criteria:
- [ ] VideoGenerator component
- [ ] VideoPlayer component
- [ ] VideoList component
- [ ] Loading states
- [ ] Error handling

Estimate: 5 points
Owner: Frontend Agent
Status: TODO
```

**Story 1.4: Video Database Schema**
```
As a: Developer
I want: Database tables for video assets
So that: I can store and query video data

Acceptance Criteria:
- [ ] video_assets table
- [ ] video_templates table
- [ ] RLS policies
- [ ] Migration script (005_video_tables.sql)
- [ ] Tests

Estimate: 3 points
Owner: CTO Agent
Status: TODO
```

---

### Epic 2: CRM Sync (HubSpot)

**Story 2.1: HubSpot Client Library**
```
As a: Developer
I want: A HubSpot API client
So that: I can sync contacts and deals

Acceptance Criteria:
- [ ] OAuth2 authentication
- [ ] Contact CRUD operations
- [ ] Deal CRUD operations
- [ ] Rate limit handling
- [ ] Tests (100% coverage)

Estimate: 5 points
Owner: CTO Agent
Status: TODO
```

**Story 2.2: CRM Sync API**
```
As a: User
I want: Automatic CRM sync
So that: My contacts are always up-to-date

Acceptance Criteria:
- [ ] POST /api/crm/sync endpoint
- [ ] Bidirectional sync logic
- [ ] Conflict resolution
- [ ] Error handling + retry
- [ ] Tests (100% coverage)

Estimate: 8 points
Owner: CTO Agent
Status: TODO
```

**Story 2.3: CRM UI Components**
```
As a: User
I want: CRM connection settings
So that: I can configure HubSpot sync

Acceptance Criteria:
- [ ] CRMSettings component
- [ ] OAuth2 flow UI
- [ ] Sync status indicator
- [ ] Manual sync trigger
- [ ] Error messages

Estimate: 3 points
Owner: Frontend Agent
Status: TODO
```

---

### Epic 3: Analytics Dashboard

**Story 3.1: AARRR Funnel Component**
```
As a: CEO
I want: AARRR funnel visualization
So that: I can track growth metrics

Acceptance Criteria:
- [ ] Acquisition metric
- [ ] Activation metric
- [ ] Retention metric
- [ ] Revenue metric
- [ ] Referral metric
- [ ] Chart visualization (Recharts)

Estimate: 5 points
Owner: Frontend Agent
Status: TODO
```

**Story 3.2: Proposal Conversion Tracking**
```
As a: Sales Director
I want: Proposal conversion analytics
So that: I can optimize win rates

Acceptance Criteria:
- [ ] Proposal views tracking
- [ ] Conversion rate calculation
- [ ] Win/loss breakdown
- [ ] Time-to-close metric
- [ ] Export to CSV

Estimate: 5 points
Owner: Full-stack Agent
Status: TODO
```

**Story 3.3: Usage Metrics Dashboard**
```
As a: CTO
I want: Feature usage tracking
So that: I can prioritize product roadmap

Acceptance Criteria:
- [ ] Feature usage by category
- [ ] MCU consumption chart
- [ ] Active users (DAU/WAU/MAU)
- [ ] Session duration
- [ ] Real-time updates

Estimate: 5 points
Owner: Full-stack Agent
Status: TODO
```

---

### Epic 4: Production Deploy

**Story 4.1: Infrastructure Setup**
```
As a: DevOps
I want: Production infrastructure
So that: Users can access the app

Acceptance Criteria:
- [ ] Vercel production project
- [ ] Supabase production project
- [ ] Polar.sh live products
- [ ] Domain + SSL configured
- [ ] DNS records set

Estimate: 3 points
Owner: CTO Agent
Status: TODO
```

**Story 4.2: Monitoring + Alerts**
```
As a: SRE
I want: Monitoring and alerting
So that: I can detect and fix issues quickly

Acceptance Criteria:
- [ ] Sentry error tracking
- [ ] Vercel Analytics
- [ ] Uptime monitoring
- [ ] Slack/email alerts
- [ ] Dashboard configured

Estimate: 3 points
Owner: Ops Agent
Status: TODO
```

**Story 4.3: Smoke Tests**
```
As a: QA
I want: Automated smoke tests
So that: I can verify production health

Acceptance Criteria:
- [ ] Signup flow test
- [ ] Payment flow test
- [ ] Video generation test
- [ ] CRM sync test
- [ ] CI/CD integration

Estimate: 5 points
Owner: Tester Agent
Status: TODO
```

---

## Sprint Capacity

| Agent | Available Days | Capacity (points) |
|-------|---------------|-------------------|
| CTO Agent | 10 days | 25 points |
| Frontend Agent | 10 days | 15 points |
| Full-stack Agent | 10 days | 15 points |
| Ops Agent | 5 days | 8 points |
| Tester Agent | 5 days | 10 points |
| **Total** | | **73 points** |

**Total Estimated:** 58 points
**Buffer:** 15 points (20%)

---

## Sprint Schedule

### Week 1 (May 4-8)
| Day | Focus | Deliverables |
|-----|-------|--------------|
| Mon | Sprint kickoff, setup | Tasks assigned |
| Tue | Video AI (Stories 1.1, 1.4) | HeyGen client, DB schema |
| Wed | Video AI (Story 1.2) | Video API routes |
| Thu | CRM (Stories 2.1, 2.2) | HubSpot client, sync API |
| Fri | CRM (Story 2.3) | CRM UI components |

### Week 2 (May 11-15)
| Day | Focus | Deliverables |
|-----|-------|--------------|
| Mon | Analytics (Stories 3.1, 3.2) | AARRR funnel, conversion tracking |
| Tue | Analytics (Story 3.3) | Usage metrics dashboard |
| Wed | Deploy (Stories 4.1, 4.2) | Infrastructure, monitoring |
| Thu | Deploy (Story 4.3) | Smoke tests |
| Fri | Sprint review, retro | Demo, retrospective |

---

## Definition of Done

All stories must meet:
- [ ] Code implemented
- [ ] Tests written (100% coverage)
- [ ] TypeScript types defined
- [ ] Error handling complete
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Build passes (0 errors)

---

## Risks + Blockers

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| HeyGen API key delay | High | Use mock for dev, test later | CTO |
| HubSpot OAuth complexity | Medium | Start early, test incrementally | CTO |
| Dashboard performance | Medium | Lazy loading, memoization | Frontend |
| Production deploy issues | High | Rollback plan ready | Ops |

---

**Generated:** 2026-03-20T03:32:00-07:00
**Owner:** Product Agent
**Sprint Review:** 2026-05-16
