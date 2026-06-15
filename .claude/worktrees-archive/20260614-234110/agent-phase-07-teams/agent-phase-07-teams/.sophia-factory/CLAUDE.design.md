---
phase: 2
title: "Design — Architecture + UX"
description: |
  [VN] Giai đoạn 2: Thiết kế kiến trúc và UX dựa trên requirement đã xác nhận. Output là file design.md đã điền đầy đủ.
  [EN] Phase 2: Design architecture and UX from confirmed requirement. Output is a filled design.md.
input: "Filled requirement.md from Phase 1"
output: "plans/{slug}/design.md (filled)"
next-phase: ".sophia-factory/CLAUDE.code.md"
---

# Phase 2 — Design

## Purpose
Produce a concrete, implementable design that CTO can hand directly to coding without ambiguity. Includes architecture decisions, data flow, component breakdown, and UX wireframe (ASCII or description).

## Agent Instructions

You are acting as a **Solution Architect + UX Designer**. Read the requirement.md fully before starting.

### Step 1 — Architecture Decision

For each requirement, decide:

| Concern | Question | Decision |
|---------|----------|----------|
| Data layer | New D1 table or existing? | |
| API surface | Server Action or route handler? | |
| Auth | Which tier(s) can access? | |
| Edge vs Node | CF Worker or Node runtime? | |
| State | Client state or server state? | |

Rules:
- Server Actions for mutations (NOT API routes for data writes).
- `createServerClient()` from `@/lib/db/client` — sync, NOT async.
- `getCurrentUser()` from `@/lib/better-auth-session`.
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only).
- No new dependencies without CTO approval.

### Step 2 — Component Breakdown

List every file to create or modify:
```
CREATE:
- src/lib/{feature}/{module}.ts       — business logic
- src/app/(app)/{feature}/page.tsx    — UI page
- src/app/api/{feature}/route.ts      — if webhook/cron only

MODIFY:
- src/middleware.ts                    — if new route protection needed
- src/config/tiers.ts                  — if new tier gate needed
```

Each file must be < 200 LOC. If design implies > 200 LOC → split into sub-modules now.

### Step 3 — Data Flow Diagram

Draw ASCII data flow (or describe if complex):
```
User Action → Server Action → DB (D1) → Response
                           ↓
                     Webhook (if payment)
```

### Step 4 — UX Design

For UI changes:
- Describe each screen state: empty / loading / success / error.
- List components: new vs reuse from existing UI kit.
- Responsive: mobile-first. Bilingual labels (VN primary, EN secondary).
- No hardcoded strings — all text via `messages/` i18n files.

### Step 5 — Fill Design Template

Open `.sophia-factory/templates/design.md` and fill all sections.
Save as: `plans/{YYYYMMDD}-{slug}/design.md`

### Step 6 — Security Review Checklist

Before handoff:
- [ ] Auth gate verified (which tiers can access)
- [ ] Input validation: zod schema defined for all API inputs
- [ ] No secrets in client-side code
- [ ] Protected flows unaffected (Setup Wizard / Telegram / NOWPayments)
- [ ] D1 RLS not bypassed

### Step 7 — Journal

Write `.sophia-factory/journal/YYYYMMDD-design-{slug}.md`:
```
## Action: Architecture design for "{feature}"
## Decision: {key architectural choices + rationale}
## Outcome: design.md saved to plans/{slug}/
## Lessons: {any design pattern to remember}
```

## Handoff to Phase 3

Pass to `CLAUDE.code.md`:
- Link to filled `design.md`
- File list (create/modify) with LOC estimates
- Any tricky implementation notes

## Anti-Patterns to Avoid
- Do NOT start coding during design — that's Phase 3.
- Do NOT design features beyond the requirement scope (YAGNI).
- Do NOT duplicate patterns already in `src/lib/` — reference existing modules.
- Do NOT skip the security checklist.
