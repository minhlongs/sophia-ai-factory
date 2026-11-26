# PROJECT.md

**Updated:** 2026-11-26 · **Live Baseline:** `7e607edb`

## Overview

**Sophia AI Factory** (`apps/sophia-ai-factory/`) is a full-stack Next.js 16 + Cloudflare Workers (OpenNext) platform for **Crypto & SaaS Agentic Affiliate Video Production & Distribution**.

## Active Platform Modules

- **Core Sidebar (5 workflows):**
  1. `Affiliate Studio (4 Steps)` — `/dashboard/first-value`
  2. `5-Min Quickstart Guide` — `/guide`
  3. `Overview` — `/dashboard`
  4. `Affiliate Results` — `/dashboard/affiliates`
  5. `Connections & BYOK` — `/dashboard/settings`
- **Advanced Power Tools (4 collapsible groups):**
  - `YouTube Factory Suite` (`/dashboard/youtube/*`)
  - `Publish Queue` (`/dashboard/publish/queue`)
  - `AI Missions & Approvals` (`/dashboard/missions`, `/dashboard/approvals`)
  - `Image & Niche Studio` (`/dashboard/image-studio`, `/dashboard/niche-studio`)
- **Admin / SRE Only (`isAdmin`):** Handover, Runbooks, System Health, SOPs, Autonomous Loop (`/admin/autonomous`).

## Key Technical Guarantees

- **4-Layer Clean Architecture:** `seed → tree → forest → land` (zero `src/lib/`).
- **Zero `:any`, zero `@ts-ignore`, zero `console.log` in production code.**
- **Bilingual VI + EN** across all customer-facing surfaces (`next-intl`).
- **Dual-Sync Edge Parity:** Production (`sophia-ai-factory`) and Internal R&D (`sophia-ai-factory-pilot`) stay bit-for-bit synced on `main`.
