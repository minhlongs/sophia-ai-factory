# 🎯 Client-Ready UX: Xem Xong Biết Dùng Ngay

## OBJECTIVE

Khách vào sophia-ai-factory.vercel.app → biết ngay cách dùng → dùng ngay được.
Zero confusion. Clear onboarding. Professional first impression.

## CRITICAL ISSUES FOUND (Browser Audit)

1. ❌ "Admin" button in header nav — confuses regular users
2. ❌ "Settings" link in header — should not show for non-logged-in users
3. ❌ "Start Free" CTA → non-functional / no clear destination
4. ❌ /login → 404 (locale routing issue — page exists at /[locale]/login)
5. ❌ Dashboard accessible without auth (no redirect to login)
6. ❌ Affiliate Discovery → 500 error (spinner forever)

## PHASE 1: Fix Navigation & CTAs (Header)

### 1.1 Fix Header Navigation

In the header/navbar component:

**REMOVE** from public header:

- "Admin" button — MOVE to footer or hide behind auth check
- "Settings" link — only show when user is authenticated

**ADD** to public header:

- "Dashboard" or "Bảng Điều Khiển" link → goes to /dashboard (with auth redirect)
- "Login" / "Đăng Nhập" link → goes to /login

**KEEP**:

- Features, Pricing, Affiliate Programs, FAQ — these are fine

### 1.2 Fix "Start Free" CTA

The hero "Start Free" button MUST:

- Navigate to `/dashboard` (if logged in) or `/login` (if not logged in)
- Use `<Link href="/dashboard">` — middleware handles auth redirect
- Add visual hover animation (scale up + glow)

### 1.3 Fix "Watch Demo" CTA

- Either link to a YouTube demo video
- OR scroll to the Workflow section (how it works)
- Use smooth scroll to `#workflow` section

## PHASE 2: Fix Login/Auth Flow

### 2.1 Fix /login Route

The login page EXISTS at `src/app/[locale]/login/page.tsx` but direct `/login` returns 404.

**FIX**: Ensure middleware handles redirect from `/login` → `/en/login` (or current locale).
Check `middleware.ts` — the i18n middleware should handle this.

### 2.2 Login Page UX

The login page should:

- Match the dark theme of landing page
- Show clear "Sign in with Magic Link" form
- Have a "Back to Home" link
- Show social proof / trust badges
- Be bilingual (en + vi)

### 2.3 Auth-Protected Dashboard

The middleware MUST:

- Redirect unauthenticated users from `/dashboard/*` → `/login`
- After login, redirect back to original URL
- Show a clear "Please sign in" message, not a broken page

## PHASE 3: Fix Broken Pages

### 3.1 Affiliate Discovery (500 Error)

The affiliate discovery page crashes because the API returns 500.

**FIX**:

- Add error boundary with user-friendly message
- Show cached/static data when API fails
- Display "Coming soon — we're crunching the data" fallback
- Do NOT show an infinite spinner

### 3.2 Dashboard Empty State

When user first arrives at dashboard:

- Show a CLEAR onboarding wizard (not just "No campaigns")
- Steps: 1) Connect your APIs → 2) Choose a template → 3) Create first campaign
- Each step has a CTA button
- Link to documentation/getting-started guide

## PHASE 4: Add Onboarding Guide Component

### 4.1 Create Interactive Onboarding Banner

Add a dismissible onboarding banner at the top of dashboard that shows:

```
🚀 Welcome to Sophia AI Factory!
Here's how to get started in 3 easy steps:

1️⃣ Choose a Template → [Browse Templates]
2️⃣ Configure Your Campaign → [Create Campaign]
3️⃣ Publish & Earn → [View Analytics]

[Dismiss] [Learn More]
```

### 4.2 Add Tooltips to Key Actions

- Hover tooltips on dashboard sidebar items explaining each feature
- "?" icons next to complex features

## PHASE 5: Build + Test + Ship

1. `cd apps/sophia-ai-factory && npx next build` — MUST PASS
2. `npx vitest run` — ALL tests MUST PASS
3. Verify on localhost:
   - Landing page → "Start Free" → Login → Dashboard flow works
   - Header shows correct nav items
   - No "Admin" button visible to regular users
4. Git commit: `feat(ux): client-ready onboarding — fix CTAs, auth flow, nav, empty states`
5. Git push to main
6. Wait for Vercel deploy → verify on production

## QUALITY GATE

| #   | Criterion                               | Required |
| --- | --------------------------------------- | -------- |
| 1   | "Start Free" → working destination      | ✅       |
| 2   | No "Admin" in public header             | ✅       |
| 3   | No "Settings" for unauthenticated users | ✅       |
| 4   | /login route works                      | ✅       |
| 5   | Dashboard has onboarding guide          | ✅       |
| 6   | Affiliate page has error fallback       | ✅       |
| 7   | Build passes                            | ✅       |
| 8   | All tests pass                          | ✅       |
| 9   | Committed & pushed                      | ✅       |

## RULES

- ZERO broken CTAs — every button must go somewhere useful
- Do NOT remove existing working features
- Match dark neon theme consistently
- Keep bilingual (en + vi) support for all new text
- Use existing components/design system where possible
