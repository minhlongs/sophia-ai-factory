# /mk:brainstorm — Binh Pháp Strategic Contract & Execution Plan (Sophia AI Factory)

> **Session Date:** 2026-10-17
> **Design System Anchor:** Stitch Project `8279482791013273159` (*Direction A — Director's Control Deck*)
> **Status:** Approved & Executed via `/mk:brainstorm` → `/mk:plan` → `/mk:cook`

---

## 1. Brainstorm Contract (4 Mandatory Fields)

| Field | Contract Specification |
|---|---|
| **Outcome** | Unified execution of all 3 strategic tracks:<br>1. **Production Route Rollout:** Wire the 9-screen Stitch *Director's Control Deck* (`/[locale]/dashboard/control-deck`) and quick-launch banner (`DashboardControlDeckBanner`) into `/[locale]/dashboard`.<br>2. **Deep Binh Pháp 4-Layer Consolidation:** Consolidate fragmented `tree/growth-v13..v16` engines under canonical barrel `@/tree/growth-triad` and enforce `< 180 LOC` across all new modules.<br>3. **Live Backend Wiring:** Connect `getCurrentUser`, `verifyUserReadiness`, `fetchCurrentUserDashboard`, and live Thompson Sampling + Half-Kelly calculation (`computeLiveControlDeckDataset`) via `@/forest/control-deck`. |
| **Constraints** | • Preserve Protected Flows (Setup Wizard, `@Sophia_Bbot` Telegram Bot, NOWPayments USDT IPN).<br>• Strict 4-layer import boundaries (`seed -> tree -> forest -> land`).<br>• Do not mutate the 14-item `SOPHIA_NAV_MODULES` array pinned by `dashboard-sidebar-nav.challenger.test.tsx`.<br>• `< 180 LOC` per file, `zero :any`, `zero console.log`, bilingual `VI/EN` parity. |
| **Non-goals** | • No breaking SQL/D1 schema migrations.<br>• No non-approved payment providers (strictly NOWPayments USDT primary + PayOS domestic backup). |
| **Acceptance Criteria** | • Plan written to `docs/architecture/mk-brainstorm-control-deck-restructuring-plan.md`.<br>• `check-layer-boundaries.sh` = 0 violations.<br>• `npm run i18n:validate` = 0 missing keys.<br>• `npm run ci:typecheck` (`tsc --noEmit`) = 0 errors.<br>• Vitest unit suites for `ControlDeckHub`, `DashboardComponents`, and `ControlDeckTelemetryService` = 100% PASS. |

---

## 2. Architecture & Trade-Off Matrix (3 Combined Tracks)

```mermaid
flowchart TD
  subgraph SEED["Layer 1: Seed (Foundational Types & Auth)"]
    S1["@/seed/types/stitch-control-deck.ts"]
    S2["@/seed/auth/better-auth-session.ts"]
  end

  subgraph TREE["Layer 2: Tree (Domain Logic & Consolidated Growth Triad)"]
    T1["@/tree/growth-triad/index.ts (v13–v16 Barrel)"]
    T2["@/tree/control-deck/live-bandit-calculator.ts"]
    T3["@/tree/readiness/readiness-checker.ts"]
  end

  subgraph FOREST["Layer 3: Forest & Stitch UI (Orchestration & Components)"]
    F1["@/forest/control-deck/control-deck-telemetry-service.ts"]
    F2["@/components/stitch/screens/control-deck/control-deck-hub.tsx"]
    F3["@/components/stitch/screens/dashboard/dashboard-control-deck-banner.tsx"]
  end

  subgraph APP["Next.js 16 App Router (/[locale]/dashboard)"]
    A1["/[locale]/dashboard/page.tsx"]
    A2["/[locale]/dashboard/control-deck/page.tsx"]
  end

  S1 --> T2
  T1 --> T2
  S2 --> F1
  T2 --> F1
  T3 --> F1
  F1 --> A2
  F2 --> A2
  F3 --> A1
```

| Track | Approach | YAGNI / KISS / DRY Rationale |
|---|---|---|
| **Track 1: Production Route Rollout** | Mount `DashboardControlDeckBanner` inside `DashboardPage` linking to `/dashboard/control-deck` | Exposes all 9 Stitch screens on the main `/dashboard` entry point while preserving the 14-item `SOPHIA_NAV_MODULES` invariant. |
| **Track 2: 4-Layer Consolidation** | Barrel `@/tree/growth-triad/index.ts` + `< 180 LOC` enforcement | Unifies `thompson-bandit`, `kelly-allocator`, `deliberation-consensus`, `shapley-attribution`, `survival-halt-predictor`, `audience-retention-normalizer`, and `prior-script-steerer` without breaking legacy imports. |
| **Track 3: Live Backend Wiring** | `@/forest/control-deck/control-deck-telemetry-service.ts` | Fetches live auth + BYOK readiness + transaction ledger on the server with graceful unauthenticated fallback. |

---

## 3. Complete 9/9 Stitch Screen → Next.js 16 Route Matrix

| # | Stitch Screen (`site/public/`) | Unified Hub (`/[locale]/dashboard/control-deck`) | Standalone Route Binding (`apps/sophia-ai-factory/src/app/[locale]/`) |
|---|---|---|---|
| 1 | `index.html` (Executive Command & MAB) | `ExecutiveMabPanel` | `/[locale]/dashboard` (`DashboardControlDeckBanner`) |
| 2 | `ask-advisors.html` (`/ask` 4-Advisor Council) | `AdvisorTimelinePanel` | `/[locale]/dashboard/missions` (`StitchStudioDeckStrip`) |
| 3 | `video-studio.html` (AI Video Timeline Studio) | `AdvisorTimelinePanel` | `/[locale]/dashboard/missions` (`StitchStudioDeckStrip`) |
| 4 | `billing-revenue.html` (USDT/PayOS Merkle Ledger) | `RevenuePortalsPanel` | `/[locale]/dashboard/affiliate` (`MerkleSettlementBanner`) |
| 5 | `setup-wizard.html` (Zero-Tech BYOK Vault) | `ControlDeckHub` Inspector | `/[locale]/dashboard/settings` (`StitchByokVaultBanner`) |
| 6 | `agency-portal.html` (White-Label Subaccounts) | `ControlDeckHub` Inspector | `/[locale]/partner` (`StitchAgencySubaccountStrip`) |
| 7 | `mobile-companion.html` (`@Sophia_Bbot` Pocket) | `ControlDeckHub` Inspector | `/[locale]/dashboard/approvals` (`StitchMobileCompanionBanner`) |
| 8 | `pricing.html` (Bilingual Pricing & ROI) | `ControlDeckHub` Inspector | `/[locale]/pricing` (`PricingRoiCalculator`) |
| 9 | `style-guide.html` (Design System v4.2) | `RevenuePortalsPanel` | `design-tokens.css` + `tailwind-theme.css` |

