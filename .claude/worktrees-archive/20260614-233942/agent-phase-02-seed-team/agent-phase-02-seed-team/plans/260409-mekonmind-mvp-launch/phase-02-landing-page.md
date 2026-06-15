## Phase 2: Landing Page

### Context Links
- Existing React components: `~/mekong-cli/packages/ui/src/components/marketing/`
- CF Pages deploy: `mekong/infra/templates/cf-pages/`
- M3 Design tokens: `.claude/rules/m3-strict.md`

### Overview
- **Priority:** P0 — the storefront
- **Status:** pending
- **Description:** Single-page static site: hero, features, pricing, CTA. Deploy to CF Pages.

### Key Insights
- Existing React components (`pricing-table.tsx`, `hero-section.tsx`, `feature-bento.tsx`) exist but are unwired
- For SPEED: build as static HTML + Tailwind CDN, not full React app. Can upgrade later.
- CF Pages deploys from git push — create `sites/mekonmind/` directory in repo

### Requirements
**Functional:**
- Hero section: headline, subtitle, CTA button
- Feature grid: 4-6 key capabilities of MekongMind
- Pricing section: 3 tiers with "Subscribe" buttons linking to Polar checkout
- Footer: links, copyright

**Non-functional:**
- LCP < 2.5s
- Mobile responsive
- No JS framework needed — static HTML
- Tailwind CSS via CDN for speed

### Architecture
```
sites/mekonmind/
├── index.html          # Single page: hero + features + pricing + footer
├── success.html        # Post-checkout success page (Phase 3)
├── dashboard.html      # Minimal customer dashboard (Phase 4)
└── _headers            # CF Pages security headers
```

### Related Code Files
- **Create:** `~/mekong-cli/sites/mekonmind/index.html`
- **Create:** `~/mekong-cli/sites/mekonmind/_headers`
- **Reference:** `~/mekong-cli/packages/ui/src/components/marketing/pricing-table.tsx` (design reference)

### Implementation Steps

1. Create directory: `mkdir -p ~/mekong-cli/sites/mekonmind`

2. Create `index.html` with sections:
   ```
   <!DOCTYPE html>
   <head>
     <title>MekongMind — AI Operations Platform</title>
     <script src="https://cdn.tailwindcss.com"></script>
     <meta name="viewport" content="width=device-width, initial-scale=1">
   </head>
   ```

3. **Hero section:**
   - Headline: "Ship 10x Faster with AI Operations"
   - Subtitle: "MekongMind automates code review, testing, deployment, and monitoring. Your AI engineering team that never sleeps."
   - CTA: "Start Free" button → `/v1/onboard` or Polar checkout
   - Secondary CTA: "View Pricing" → scroll to #pricing

4. **Features section** (grid of 4-6):
   - AI Code Review — automated PR review with actionable feedback
   - Automated Testing — generate and run tests across your codebase
   - Deployment Orchestration — zero-downtime deploys to any platform
   - Real-time Monitoring — SSE dashboard with credit usage tracking
   - Multi-Agent Workflows — parallel task execution for complex missions
   - API-First — RESTful API with MCU credit billing

5. **Pricing section** (#pricing):
   - 3 cards matching revenue_router.py tiers
   - Each card has "Subscribe" button → Polar checkout URL (placeholder `POLAR_CHECKOUT_URL_{TIER}`)
   - Highlight "Growth" tier as recommended

6. **Footer:**
   - "Built by Mekong AI" + copyright
   - Links: API Docs, GitHub, Contact

7. Create `_headers` for CF Pages:
   ```
   /*
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```

8. Create `wrangler.toml` for CF Pages project:
   ```toml
   name = "mekonmind"
   compatibility_date = "2026-04-09"
   
   [site]
   bucket = "./sites/mekonmind"
   ```

### Todo List
- [ ] Create `sites/mekonmind/` directory
- [ ] Build `index.html` with hero, features, pricing sections
- [ ] Add Tailwind CDN + responsive meta tags
- [ ] Wire pricing buttons with placeholder checkout URLs
- [ ] Create `_headers` file for security headers
- [ ] Test locally: `npx wrangler pages dev sites/mekonmind`
- [ ] Verify mobile responsiveness

### Success Criteria
- Page loads in < 2s
- All 3 pricing tiers visible with correct prices
- CTA buttons present (URLs wired in Phase 3)
- Mobile responsive
- Security headers configured

### Risk Assessment
- **Tailwind CDN:** Fine for MVP. Migrate to build-time CSS later for production.
- **SEO:** Static HTML = good baseline. Add meta tags for social sharing.

### Next Steps
- Phase 3 wires actual Polar checkout URLs into the buttons
