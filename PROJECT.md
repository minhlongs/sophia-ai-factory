# Project: Sophia AI Factory — Full Platform Obsidian Cyber-Glass Dashboard UI/UX Overhaul

## Architecture
- Layer discipline: Canonical 4-layer hierarchy (`seed` → `tree` → `forest` → `land`).
  - `seed`: Design tokens, UI primitives (`card.tsx`, `button.tsx`, `badge.tsx`, `input.tsx`), tier types.
  - `tree`: Metrics processing, navigation definitions, theme resolution.
  - `forest`: Dashboard components and shell orchestration:
    - `src/forest/dashboard/dashboard-shell.tsx` (Unified shell layout)
    - `src/forest/dashboard/dashboard-sidebar-nav.tsx` (Canonical 11-module navigation & bottom user card)
    - `src/forest/dashboard/dashboard-topbar.tsx` (TopBar with search, notifications, locale toggle, drawer trigger)
    - `src/forest/dashboard/dashboard-revenue-chart.tsx` (Bottom-up SVG/gradient revenue chart)
    - `src/forest/dashboard/dashboard-metrics-grid.tsx` (4 glowing glass KPI cards)
    - `src/forest/dashboard/dashboard-activity-table.tsx` (Recent missions & activity table)
    - `src/forest/dashboard/dashboard-onboarding-banner.tsx` (Restyled BYOK banner)
  - `land`: Next.js 16 App Router pages:
    - `src/app/[locale]/dashboard/layout.tsx` (Persistent Dashboard layout)
    - `src/app/[locale]/dashboard/page.tsx` (Dashboard Overview page)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Obsidian Design Tokens & CSS Cleanup | Remove zinc `#18181B` override at line 540 and duplicate `.text-gradient` in `globals.css`; enforce `#08090D` background, `#12141F` cards, `#6366F1` indigo, `#F59E0B` amber | M1 | Survey |
| 2 | Canonical Navigation (11 Sophia Modules) | Wire all 11 Sophia AI modules into `DashboardSidebarNav` with Lucide icons, bilingual labels, and verified routes | M1 | Survey |
| 3 | Active Route Glow & Hover States | Subtle gradient glow (`bg-primary/10`, `border-primary/30`), indigo accent, hover translations | M1 | Survey |
| 4 | Bottom User Card & Quota Bar Fix | Proper avatar, tier badge (MASTER, ENTERPRISE, PRO), 4px quota bar, seamless upgrade CTA with zero text collision (`min-w-0 truncate`) | M1 | Survey |
| 5 | Responsive Mobile Drawer Navigation | Hamburger trigger in TopBar, sliding glass drawer on < 768px viewports, backdrop overlay | M1 | Survey |
| 6 | Persistent App Router Dashboard Layout | Create `src/app/[locale]/dashboard/layout.tsx` so all `/dashboard/*` subroutes inherit the persistent shell | M1 | Survey |
| 7 | Bottom-Up Revenue & Performance Chart | Re-engineer chart with `bottom: 0`, `items-end` or SVG area gradient; eliminate top-down ceiling bars | M2 | Survey |
| 8 | Chart Tooltips & Interactive Time Range | Interactive period selector (`7d`, `30d`, `6m`, `ytd`), hover tooltips with USD amounts, centered Mon-Sun date labels | M2 | Survey |
| 9 | Chart i18n & Obsidian Glass Styling | Add `7d` translation to `en.json` and `vi.json`; subtle horizontal grid lines, glowing active state | M2 | Survey |
| 10 | Obsidian Cyber-Glass TopBar | Fixed header with backdrop-blur (`fixed top-0 left-0 right-0 md:left-[280px]`), clean search input with single icon | M3 | Survey |
| 11 | Notifications, Locale Switcher & User Menu | Unread badge count pill on bell icon, bilingual VI/EN toggle button, high-contrast user dropdown menu | M3 | Survey |
| 12 | Executive KPI Metrics Grid (4 Glass Cards) | Glowing glass cards (`bg-card/85 border border-border`) for Total Campaigns, Active Jobs, Videos Generated, Success Rate with 4 distinct tinted pills (Indigo, Emerald, Violet, Amber) | M3 | Survey |
| 13 | Restyled Onboarding Banner & Quick Actions | BYOK setup banner with proper flex spacing, badges, and action buttons (`/dashboard/setup`, `/dashboard/system-health`) | M3 | Survey |
| 14 | Recent Activity & Video Missions Table | Unified table rendering video creation missions + transactions with status pills (`completed`, `processing`, `failed`) and action links | M3 | Survey |
| 15 | Unit & Component Test Suites | Dedicated Vitest suites for SidebarNav, RevenueChart bottom-up, TopBar, and KPI/Activity widgets | M4 | Survey |
| 16 | TypeScript & Layer Boundary Verification | 0 TypeScript compile errors (`npm run type-check`), 0 layer boundary violations (`bash scripts/check-layer-boundaries.sh`) | M4 | Survey |
| 17 | Forensic Integrity Audit & Challenger Gates | Challenger empirical verification and Forensic Auditor zero-tolerance integrity check | M4 | Survey |
| 18 | Cloudflare Workers Edge CF-Direct Deploy | Deploy via `./scripts/deploy-with-sha.sh` / `npm run deploy:full` | M5 | Survey |
| 19 | Live Edge SHA Parity & Sophia Doctor 11/11 | Bit-for-bit SHA verification at `https://sophia.agencyos.network/api/version` and Sophia Doctor 11/11 GREEN | M5 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Obsidian Shell, Theming & Canonical SidebarNav | CSS token cleanup, `DashboardSidebarNav` with 11 modules, active glow, bottom user card fix, mobile drawer, `dashboard/layout.tsx` | none | DONE |
| 2 | Bottom-Up Revenue & Performance Chart | Rebuilt bottom-up bars / SVG gradient curve, tooltips, Mon-Sun date labels, 7d/30d/6m/ytd selector, i18n keys | M1 | DONE |
| 3 | TopBar, Executive KPI Cards & Activity Table | Obsidian TopBar (search, notifications, VI/EN toggle, drawer trigger), 4 tinted KPI glass cards, restyled onboarding banner, activity table | M1 | DONE |
| 4 | Quality Gates & Comprehensive Verification | TypeScript 0 errors, layer boundaries 0 violations, Vitest test suites 100% pass, Challenger & Forensic Auditor gates | M1, M2, M3 | DONE |
| 5 | CF-Direct Edge Deployment & Doctor 11/11 GREEN | Edge deployment via CF-direct, live edge SHA match, Sophia Doctor 11/11 GREEN certification | M4 | IN_PROGRESS |

## Interface Contracts
### `DashboardSidebarNav` Props & Schema
```typescript
export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface DashboardSidebarNavProps {
  currentPath: string;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
    tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' | 'MASTER';
    quotaUsagePercent: number;
    quotaUsed: number;
    quotaTotal: number;
  };
  onCloseMobile?: () => void;
}
```

### `DashboardRevenueChart` Props & Schema
```typescript
export interface RevenueDataPoint {
  period: string; // 'Mon' | 'Tue' | ...
  revenue: number;
  previousRevenue?: number;
}

export interface DashboardRevenueChartProps {
  data?: RevenueDataPoint[];
  currentPeriod?: '7d' | '30d' | '6m' | 'ytd';
  onPeriodChange?: (period: '7d' | '30d' | '6m' | 'ytd') => void;
  className?: string;
}
```

### `DashboardTopBar` Props & Schema
```typescript
export interface DashboardTopBarProps {
  onOpenMobileDrawer?: () => void;
  unreadNotificationCount?: number;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
}
```

## Code Layout
- `apps/sophia-ai-factory/src/app/globals.css` (Obsidian tokens & glass utilities)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-sidebar-nav.tsx` (Canonical sidebar navigation)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-topbar.tsx` (Obsidian TopBar)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-revenue-chart.tsx` (Bottom-up financial chart)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-metrics-grid.tsx` (KPI metrics cards)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-activity-table.tsx` (Activity table)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-onboarding-banner.tsx` (BYOK banner)
- `apps/sophia-ai-factory/src/forest/dashboard/dashboard-shell.tsx` (Composite dashboard shell)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx` (App Router dashboard layout)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx` (Dashboard page overview)
- `apps/sophia-ai-factory/src/components/stitch/screens/dashboard/` (Backward compatibility re-exports)
- `apps/sophia-ai-factory/src/forest/dashboard/__tests__/` (Dedicated unit & component test suites)
