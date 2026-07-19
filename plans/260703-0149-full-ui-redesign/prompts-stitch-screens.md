# Stitch Screen Prompts — Sophia AI Factory Redesign

Stitch MCP not available in this session. Paste these into [stitch.withgoogle.com](https://stitch.withgoogle.com) to generate screens.

---

## Design System

```json
{
  "theme": "DARK",
  "primaryColor": "#D97706",
  "accentColor": "#6366F1",
  "headlineFont": "Inter",
  "bodyFont": "Inter",
  "labelFont": "IBM Plex Sans",
  "roundness": "8px",
  "backgroundDark": "#0F0F11",
  "backgroundLight": "#FAFAFA"
}
```

---

## 1. Landing Page Hero

**Paste into Stitch:**

```
Desktop High-Fidelity landing page hero section for Sophia AI Factory — a Next.js 15 SaaS platform for AI video generation. Clean, Professional, Modern SaaS aesthetic. Tonal spot color palette. Dark mode. Background: Deep charcoal (#0F0F11). Primary: Amber (#D97706). Accent: Indigo (#6366F1). Headline font: Inter 48px/700. Body font: Inter 18px/400. Label font: IBM Plex Sans 13px/500. Roundness: 8px. Comfortable spacing.

Full-width hero section (100vh, centered content, max-width 1200px). Top navigation bar (64px, fixed): Logo "Sophia" in amber left, nav links center (Features, Pricing, Blog, Affiliates), locale toggle Vietnamese/English, "Sign In" ghost button, "Start Free" primary amber filled button right.

Hero content centered: Eyebrow tagline "AI Video Factory for Revenue-as-a-Service" in amber, main headline "Build Your AI Video Empire" 56px/700, subheading "Generate faceless YouTube channels, run affiliate campaigns, and publish across TikTok/YouTube/IG — all from one dashboard." 20px/400 in grey (#A1A1AA). CTA row: Primary "Start Free" button (amber filled, 48px height, rounded-lg), secondary "Watch Demo" ghost button with play icon. Trust bar below: "10,000+ creators · 1M+ videos generated · 4.9/5 rating" with star icons.

Bottom: 3 feature preview cards in a row (280px each, 12px gap). Card 1: "AI Script Writing" — icon, short description. Card 2: "Multi-Channel Publish" — icon, description. Card 3: "Revenue Analytics" — icon, description. Subtle zinc-800 borders, 16px card padding, amber icon accents.
```

---

## 2. Pricing Page

```
Desktop High-Fidelity pricing page for Sophia AI Factory. Dark mode. Background: #0F0F11. Primary amber #D97706 (accent Indigo #6366F1). Inter font. 8px rounding.

Top navigation bar (matching landing). Page heading: "Choose Your Plan" 48px/700, subheading "Scale your AI video business with the right plan" 18px/400 grey.

Monthly/Yearly toggle pill (48px height): "Monthly" | "Yearly" (Save 20%) with amber active state.

4 pricing cards in a row (276px each, 16px gap):
- BASIC $199/mo: "Starter" — amber border accent, features list (10 video campaigns, 3 channels, basic analytics), "Get Started" ghost button
- PREMIUM $399/mo: "Most Popular" badge in amber, highlighted card with amber border. Features (100 campaigns, all channels, advanced analytics, priority support). "Start Free Trial" primary filled button
- ENTERPRISE $799/mo: Features (unlimited campaigns, custom integrations, API access, dedicated manager). "Contact Sales" outlined button
- MASTER Custom: "For agencies" — white text on dark card. Everything unlimited + white-label. "Talk to Us" ghost button

Each card: plan name 20px/600, price 40px/700, period "/mo" 14px/400 grey, feature list with checkmark icons in amber, feature descriptions in grey text 14px/400. Bottom CTA button full-width.

FAQ section below: accordion items with chevron icons, dark surface panels (#18181B), question 16px/600 white, answer 14px/400 grey.
```

---

## 3. Dashboard Shell

```
Desktop High-Fidelity dashboard application shell for Sophia AI Factory. Dark mode. Background: #0F0F11. Primary amber #D97706 (accent Indigo #6366F1). Inter font. 8px rounding. Comfortable spacing.

Left sidebar (240px, full height, zinc-900 #18181B base): Logo "Sophia" at top with small amber dot. Nav sections:
- Main: Dashboard (grid icon), Campaigns (send icon), Videos (play icon), Analytics (chart icon)
- Management: Billing (credit card icon), Affiliates (link icon), Settings (gear icon)
- Admin (only if admin): Users, Licenses, Audit Log, System Health
Each item: icon 20px, label 14px/500, active state has amber left border accent + subtle amber background. Bottom: user avatar circle 32px, name "Jane Vu", email, logout icon.

Top header bar (64px, full-width minus sidebar, dark surface #18181B): Search input (240px, search icon, placeholder "Search campaigns..."). Right: notification bell with red badge, locale toggle (🇻🇳 VI / 🇺🇸 EN), user avatar dropdown.

Main content area: padded 32px, max-width 1400px. Breadcrumb text 13px/400 grey at top.
```

---

## 4. Dashboard Overview

```
Desktop High-Fidelity dashboard overview page matching the shell above. Dark mode. Amber #D97706 primary. Inter font.

Page heading: "Dashboard" 28px/700 left, date range selector "Last 30 days" dropdown right.

KPI row: 4 metric cards (1fr each, 16px gap). Card surface #18181B with subtle zinc-800 border.
- Active Campaigns: number 24 (32px/700 white), label "Active Campaigns", green upward arrow "+3 this week"
- Total Views: 847K, label, sparkline mini-chart in amber
- Revenue MTD: $12,847, label, green arrow "+12% vs last month"
- Credits Used: 3,421 / 10,000, label, progress bar (amber fill at 34%)

Chart section (full-width card): "Performance — Last 30 Days" heading. Area chart with amber gradient fill, grey grid lines. X-axis: dates. Y-axis: views/revenue. Hover tooltip with exact values.

Bottom split (2-column, 16px gap):
- Left: "Recent Campaigns" — table with columns: Campaign Name, Status (Live/Draft/Paused pill), Views, Revenue, Last Updated. 5 rows. Sortable header.
- Right: "Quick Actions" — stacked cards: "Create Campaign" (amber accent) → "View Analytics" → "Generate Report" → "Invite Team Member". Each with icon, title, chevron right arrow.
```

---

## 5. Admin Dashboard

```
Desktop High-Fidelity admin dashboard for Sophia AI Factory. Dark mode. Amber #D97706 primary. Inter font. Compact spacing (admin density).

Left sidebar matching shell, with Admin section expanded showing all admin links with active state.

Page heading: "Admin" 28px/700 with admin badge.

KPI row: 6 stat cards — DAU (1,247), MRR ($48,291), Active Users (847), Server Uptime (99.97%), API Latency (124ms), D1 Queries/s (2,341). Each with trend arrow, compact 14px/600 value, 11px/400 label.

Two-column layout:
- Left (2/3): "User Growth" line chart (30 days), grey grid, amber line, area fill. X-axis dates, Y-axis new users.
- Right (1/3): "System Health" — harness daemon status card showing ONLINE/OFFLINE, last poll timestamp, 6 health check results (D1: ✅, R2: ✅, OpenRouter: ✅, ElevenLabs: ✅, HeyGen: ✅, Remotion: ⚠️). Each test with green/red/amber status dot.

Bottom section: "Recent Signups" table — Avatar, Name, Email, Tier (BASIC/PREMIUM/ENTERPRISE/MASTER pill), Signup Date, Status (Active/Suspended). 8 rows, pagination. "Deploy Status" widget showing latest SHA match (✅ e7ec20ef7 match), environment (Production), last deploy timestamp.
```

---

## 6. Auth — Login Page

```
Desktop High-Fidelity login page for Sophia AI Factory. Dark mode. Background: #0F0F11. Primary amber #D97706 (accent Indigo #6366F1). Inter font.

Centered card layout (max-width 440px, centered vertically and horizontally). Dark surface #18181B card with subtle zinc-800 border, 16px padding, 12px rounding.

Top: Logo "Sophia" in white 24px/700 with amber dot, centered. "Welcome back" 24px/700 white, centered. "Sign in to your account" 14px/400 grey, centered.

Form: "Email" label 13px/500 grey, email input (full-width, 44px height, dark surface #0F0F11, zinc-700 border, focus: amber ring). "Password" label, password input with eye toggle icon. "Forgot password?" text link right in amber 13px/500. "Sign In" primary button full-width (amber filled, 44px height, rounded-lg, white text 15px/600).

Divider "or continue with" with lines.

Social buttons row: "Google" ghost button with Google logo icon, "Magic Link" ghost button with email icon. Both 44px height, half-width.

Footer: "Don't have an account?" grey 13px/400, "Create account" amber link.

Bottom: Language toggle (🇻🇳 VI / 🇺🇸 EN) and "© 2026 Sophia AI Factory" in 11px/400 grey.
```

---

## 7. Campaign Management

```
Desktop High-Fidelity campaign management page for Sophia AI Factory. Dark mode. Matches dashboard shell. Amber #D97706 primary.

Page heading: "Campaigns" 28px/700. "Create Campaign" primary button right (amber filled, with + icon).

Filter bar: Search input (240px), status dropdown (All/Active/Paused/Draft/Done), channel dropdown (All/TikTok/YouTube/Instagram), date range picker. "Clear filters" ghost link.

Campaign grid: card-based layout, 3 columns. Each card 380px width, #18181B surface, zinc-800 border, 16px padding. Card content: Campaign name 16px/600 white, status pill (Live=green, Draft=grey, Paused=amber), niche tag ("Faceless YouTube", "Affiliate"), channel icons (TikTok/YT/IG). Stats row: Views 12.4K, Revenue $847, CTR 3.2%. Progress bar (amber). Last published "2 hours ago". 3-dot menu top-right.

Paginated: "Showing 1-12 of 48" with page number buttons.

Empty state (when no campaigns): ghost illustration (centered, amber-tinted), "No campaigns yet" 20px/600, "Create your first campaign to start generating AI videos" 14px/400 grey, "Create Campaign" primary button.
```

---

## 8. Video Creation Flow

```
Desktop High-Fidelity video creation page for Sophia AI Factory. Dark mode. Amber #D97706 primary. Inter font.

Page heading: "Create New Video" 28px/700.

Multi-step progress indicator: 4 steps — Script → Voice → Visual → Review. Current step highlighted in amber with circle number. Completed steps show checkmark in amber. Future steps grey.

Step content panel (main area, #18181B surface, 16px padding, 12px rounding):
Script step — "Script Input" textarea (full-width, 6 rows, placeholder "Describe your video topic or paste a script..."), "AI Generate" secondary button with sparkle icon. Generated script preview below with edit capability (highlighted text, editable). "Character count: 1,247 / 5,000" progress.

Right sidebar (320px): "Preview" panel showing estimated video thumbnail, duration "3:24", voice preview, visual style preview cards (Template / Cinematic toggle).

Bottom action bar (sticky, #18181B, zinc-800 top border): "Back" ghost button left, "Continue to Voice" primary button right (amber filled).
```

---

## 9. Affiliate Portal

```
Desktop High-Fidelity affiliate portal page for Sophia AI Factory. Dark mode. Amber #D97706 primary. Inter font.

Page heading: "Affiliate Dashboard" 28px/700. "Refer a Friend" primary button right with share icon.

KPI row: 4 compact cards — Total Referrals 47, Active 32, Commission Earned $3,847, Pending $892. Each with amber icon, number 24px/600 white.

Two-column layout:
- Left (1/2): "Affiliate Offers" — card grid, 2 columns. Each offer card: Network logo (TikTok Shop, AccessTrade, ClickBank), offer name, commission rate (%) in amber pill, "Promote" ghost button.
- Right (1/2): "Recent Conversions" — compact table: Conversion ID, Amount, Commission, Status (paid/pending/clawed-back pill), Date. 6 rows.

Bottom: "Referral Link" section with copyable link input (full-width, monospace font "https://sophia.agencyos.network/r/jane-8472"), "Copy" amber button. Social share buttons (Facebook, Twitter, WhatsApp, Telegram).

USDT Wallet section below: Wallet address (TRC20, partially masked), balance "$247.00", "Withdraw" primary button, minimum withdrawal "$50.00" note in grey 12px/400.
```

---

## 10. Settings Page

```
Desktop High-Fidelity settings page for Sophia AI Factory. Dark mode. Amber #D97706 primary. Inter font.

Page heading: "Settings" 28px/700. Left sub-nav (200px): Account, API Keys, Billing, Notifications, Team, Appearance.

Active sub-nav: "Account" with amber left border accent.

Content panel (#18181B surface, 16px padding, 12px rounding):
Section 1: "Profile" — Avatar (64px circle with upload overlay icon), Name input, Email input (greyed, verified), "Save Changes" primary button.
Section 2: "API Keys" — "ElevenLabs API Key" with masked input and eye toggle, "OpenRouter API Key", "D-ID API Key". Each with status indicator (green dot configured / red dot missing). "Add Key" ghost button.
Section 3: "Danger Zone" — red top border. "Delete Account" red outlined button, confirmation text "This action is irreversible" 13px/400 grey.

Locale section: Language selector with 🇻🇳 Vietnamese / 🇺🇸 English radio cards, 44px height, amber selected state.
```


---

## 11. Setup Wizard (BYOK Onboarding)

**CRITICAL — Protected Flow #1.** This is the BYOK API key onboarding wizard for non-tech Vietnamese CEOs. Must preserve all 5 steps, API routes, and localStorage persistence.

```
Desktop High-Fidelity setup wizard for Sophia AI Factory — a Next.js 16 SaaS platform for AI video generation. Dark mode. Primary: Amber (#D97706). Accent: Indigo (#6366F1). Headline font: Inter 28px/700. Body font: Inter 15px/400. Label font: IBM Plex Sans 13px/500. Roundness: 8px. Comfortable spacing.

Centered card layout (max-width 640px, centered vertically and horizontally). Dark surface #18181B card with subtle zinc-800 border, 24px padding, 12px rounding.

Top: Logo "Sophia" in white 22px/700 with amber dot, centered. "Welcome to Sophia AI Factory" 24px/700 white, centered. "Set up your AI services to get started" 14px/400 grey, centered.

Multi-step progress indicator (horizontal, 5 steps): 
- Step 1: OpenRouter (AI LLM) — amber checkmark if done
- Step 2: ElevenLabs (Voice) — amber checkmark if done
- Step 3: D-ID (Avatar) — amber checkmark if done
- Step 4: HeyGen (Video) — amber checkmark if done
- Step 5: System Check — amber checkmark if done
Current step highlighted in amber with filled circle + number. Completed steps show checkmark in amber. Future steps grey outline.

Content panel (full-width, #18181B surface, 20px padding, 12px rounding):

Step content varies by active step. Common elements per step:
- Step title 20px/600 white (e.g., "Step 1: AI Language Model")
- Step description 14px/400 grey (e.g., "Connect OpenRouter to power AI script writing and content generation")
- Form fields: API key input (full-width, 44px height, dark #0F0F11 bg, zinc-700 border, focus: amber ring, rounded-lg), provider label 13px/500 grey above
- Status indicator: green dot with "Connected" or red dot with "Not connected" text
- "Test Connection" secondary ghost button with refresh icon (validates key without page reload)
- "Save & Continue" primary button (amber filled, 44px height, rounded-lg, white text 15px/600)

Bottom navigation row: "Back" ghost button left, "Skip for Now" ghost link grey, step counter "Step 2 of 5" 13px/400 grey center, "Save & Continue" primary button right (amber filled, disabled grey until valid input).

Final step (System Check): Show all 5 services in a checklist format. Each row: provider icon, provider name, status (✅ Connected in green or ❌ Not Connected in amber), "Retry" ghost link if failed. "Go to Dashboard" primary amber button (full-width) when all checks pass.

Bottom: Language toggle (🇻🇳 VI / 🇺🇸 EN) and support link "Need help? Contact us" in amber link 13px/500.
```

---

## Quick Reference — Production Canonical

**Theme:** Dark mode | primary amber `#D97706` | accent indigo `#6366F1` | fonts Inter + IBM Plex Sans

**Pricing (must match `unified-limits.ts`):**
| Tier | Price | Description |
|------|-------|-------------|
| BASIC | $199/mo | Starter |
| PREMIUM | $399/mo | Growth |
| ENTERPRISE | $799/mo | Scale |
| MASTER | $4,999/mo | Unlimited |

**i18n:** All customer-facing text requires bilingual Vietnamese + English via `useTranslations('namespace')`. No hardcoded strings.

**Protected API Routes** (DO NOT break):
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/setup-wizard/save-credentials` | POST | Save encrypted API keys |
| `/api/setup-wizard/test-heygen` | POST | Test HeyGen connection |
| `/api/setup-wizard/test-resend` | POST | Test Resend connection |
| `/api/setup-wizard/list-credentials` | GET | List saved providers |
| `/api/setup-wizard/heygen/auto-register` | POST | Auto-register HeyGen |

**Execution order:** Phase 0 (design system) → Phase 1 (this doc) → Phase 2 (Landing + Pricing + Login) → Phase 3 (Setup Wizard + Dashboard) → Phase 4 (Integration + test)

Generated by `/ck:stitch-orchestrator` prompt-only workflow. Stitch MCP tools not connected — prompts above are ready to paste into stitch.withgoogle.com.
