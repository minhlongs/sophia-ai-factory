# Research Report: Admin Dashboard Architecture (Next.js 16)

**Date:** 2026-02-04
**Focus:** Admin Dashboard Patterns, Auth, UI, and Feature Controls
**Context:** Sophia Enterprise Video Factory

## 1. Next.js App Router Patterns
For a modern admin dashboard in Next.js 16, the **Route Groups** pattern is the standard.
- **Structure:** `app/(admin)/dashboard/layout.tsx` isolates admin layouts from the main app.
- **Parallel Routes (`@modal`)**: Useful for admin quick-actions without losing context.
- **Server Components:** Fetch data directly in `page.tsx` for secure, zero-client-bundle data access.

## 2. Authentication (Static/Edge Friendly)
Since we aim for static/edge compatibility, heavy auth providers (NextAuth/Clerk) might be overkill if simple protection is needed.
- **Middleware Basic Auth:** The most robust static-friendly approach. Uses `middleware.ts` to intercept requests to `/admin/*`.
  - *Pros:* Works on Edge, protects static assets, zero database dependency.
  - *Cons:* No UI login form (browser native prompt), single credential usually.
- **Vercel Edge Middleware:** Check cookies/headers at the edge before serving cached content.

## 3. UI Libraries (Tailwind-Centric)
- **shadcn/ui:** The de-facto standard. Copy-paste components, highly customizable. Best for forms, tables, and shells.
- **Tremor:** Specifically built for dashboards. Excellent for charts, KPIs, and metrics. Composes perfectly with Tailwind.
- **Tailwind Catalyst:** Official application UI kit from Tailwind Labs (React/Next.js).

## 4. Real-time Tier & Feature Controls
To manage tiers without a backend/database:
- **Vercel Edge Config:** The superior choice for "real-time" without rebuilds.
  - Store JSON: `{ "tier_free": { "limit": 5 }, "tier_pro": { "limit": 100 } }`
  - Reads in ms at the edge. Updates propagate instantly.
- **Environment Variables:** Good for build-time configuration but requires redeployment to change.
- **Cookies/Headers:** Can pass tier info via headers if upstream auth handles it.

## 5. Deployment Strategies
- **Hybrid Rendering:** Keep the marketing site static (SSG), but make `/admin` dynamic or edge-rendered to support real-time controls.
- **Private Edge Functions:** Admin actions (like "Ban User") should run as Server Actions protected by the same Middleware auth.

## Unresolved Questions
- Do we need multi-user admin access or just a single "God Mode" key?
- Is Vercel Edge Config enabled on the target project plan?

## Sources
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Vercel Edge Config](https://vercel.com/docs/storage/edge-config)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tremor](https://www.tremor.so/)
