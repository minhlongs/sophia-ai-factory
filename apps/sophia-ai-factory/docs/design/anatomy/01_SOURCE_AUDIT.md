# 01_SOURCE_AUDIT.md — Sophia Creative Assembly Line Forensic Source Audit

**Document Code:** `docs/design/anatomy/01_SOURCE_AUDIT.md`  
**System:** Sophia AI Factory (`apps/sophia-ai-factory`)  
**Feature Branch:** `feat/sophia-anatomy-workflow-explainer`  
**Auditor:** Sophia Lead Systems Architect & UI Engineer  
**Date:** 2026-10-27  

---

## 1. Executive Summary & Forensic Scope

This document provides a bit-for-bit audit of existing source files, UI components, data structures, and styling tokens across the two targeted presentation surfaces:
1. **Public Landing Hero (`Surface A`)**: `src/components/stitch/screens/landing-hero/` hosting `PipelineMockup` and `HeroHeader`.
2. **Authenticated Mission Console (`Surface B`)**: `src/app/[locale]/dashboard/missions/[id]/page.tsx` hosting `MissionAgentRunsSection`.

The audit establishes the exact baseline before implementing the **Sophia Creative Assembly Line (Isometric 2D Pure SVG)** explainer, ensuring zero disruption to existing protected flows (`Setup Wizard`, `Telegram Bot @Sophia_Bbot`, `NOWPayments IPN`) and zero layer boundary violations.

---

## 2. Inventory of Audited Components & Files

| Component / File Path | Architectural Layer | Responsibility / Content | Forensic Observations |
|---|---|---|---|
| `src/components/stitch/screens/landing-hero/modular/pipeline-mockup.tsx` | Presentation (`apps/` Client/Server UI) | 3-card static pipeline preview | Contains static cards with hardcoded estimates (e.g. `+$1,248.50 USD`). Target for replacement by isometric SVG explainer. |
| `src/components/stitch/screens/landing-hero/modular/hero-header.tsx` | Presentation UI | Hero headlines, CTAs, Trust Bar | Trust Bar contains unverified claims (`+10k creators`, `1M+ videos`). Must be aligned with honest technical claims. |
| `src/app/[locale]/dashboard/missions/[id]/page.tsx` | Presentation Page (Server Component) | Authenticated creative mission detail | Server-rendered, queries `getMission` and `listAgentRunsForMission`. Strictly multi-tenant isolated via `workspaceId`. Target for `verified-job` mode integration. |
| `src/tree/mission/agent-repo/types.ts` | Domain Reusable (`tree`) | `AgentRunRecord`, `PendingApprovalRecord` | Statuses: `queued`, `running`, `completed`, `failed`, `cancelled`, `awaiting_approval`. |
| `src/seed/types/creative-economy/entities-schema.ts` | Foundational (`seed`) | `CreativeMissionStatusSchema` | Canonical statuses: `draft`, `planned`, `approval_required`, `running`, `paused`, `review`, `completed`, `learning`, `iterating`. |
| `src/app/globals.css` | Design System Root | CSS Variables & Design Tokens | Source of truth: `--primary: 243 75% 48%` (Deep navy), `--accent: 37 91% 44%` (Bronze amber), `--background: 220 27% 98%` (Ivory marble), `--foreground: 228 63% 8%` (Crisp ink). |
| `messages/en.json` & `messages/vi.json` | Localization (`next-intl`) | Bilingual strings | Required namespaces: `stitch.landing`, `missionConsole`. Strict validation via `npm run i18n:validate`. |

---

## 3. Marketing Claims vs. Technical Ground Truth Audit

| Location | Existing String / Claim | Technical Reality & Forensic Grounding | Action Taken in Refactor |
|---|---|---|---|
| `hero-header.tsx` / `messages/*.json` | `+10k creators worldwide`, `10,000+ creators` | Pre-launch beta / early access platform; no static telemetry verifying 10k concurrent creators. | Replace with sovereign technical guarantee: `BYOK Sovereign AI Architecture • Zero Operator Lock-in`. |
| `hero-header.tsx` / `messages/*.json` | `1M+ videos generated` | Production database has real generated videos, but 1M+ is an unverified static copy statement. | Replace with architectural feature: `7-Level Evidence Chain • Non-Custodial Multi-Tenant Pipelines`. |
| `pipeline-mockup.tsx` | `Domain B Net (0% Fee): +$1,248.50 USD` | Hardcoded mock number in presentation card. | Replace with dynamic live or explicit illustrative status: `Illustrative Pipeline Simulation / Sổ cái đối soát 0% phí`. |

---

## 4. Architectural Boundaries & Anti-Bloat Verification

1. **Clean Architecture Compliance**:
   - `seed`: Pure types and utilities (`workflow-view-model.ts` types).
   - `tree`: Mission state transition rules and agent repo mapping.
   - `land` / `app`: Presentation components (`creative-assembly-line-svg.tsx`).
   - Run `bash scripts/check-layer-boundaries.sh` must return `0 errors`.
2. **Bundle Size & Edge Compatibility (Gate G1)**:
   - **NO** `@react-three/fiber`, Three.js, or Babylon.js.
   - **Zero** external runtime dependencies.
   - 100% vector SVG with inline CSS / Tailwind animations.
   - Safe for Next.js SSR and Cloudflare Workers runtime.
