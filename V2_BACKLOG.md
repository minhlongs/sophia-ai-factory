---
title: "Sophia AI Factory — V2 Backlog"
version: "1.0"
date: 2026-07-18
status: ACTIVE
---

# Sophia AI Factory — V2 Backlog

> Post-handover improvements. Items here do NOT block V1 delivery.

---

## 🔴 P1 — Tech Debt (Fix trong 1-2 sprints đầu)

### 1. Migration Consolidation
**Problem:** Duplicate migration files across root and app directories.
**Impact:** Wrong apply order → D1 schema errors in production.
**Effort:** 4h
**Affected files:** `apps/sophia-ai-factory/migrations/`, `migrations/`
**Reference:** `plans/20260716-tech-debt-sprint/`
**Status:** ✅ DONE 2026-07-25 — renamed: `0044_error_log.sql` → `0160_error_log.sql`, `0031-video-pipeline-jobs.sql` → `0031b-video-pipeline-jobs.sql`, `0032-voices.sql` → `0032b-voices.sql`, `0033-video-usage-monthly.sql` → `0033b-video-usage-monthly.sql`, `0034-video-onboarding-events.sql` → `0034b-video-onboarding-events.sql`

### 2. Layer Enforcement CI Gate
**Problem:** No automated check to prevent cross-layer imports (e.g., `land` → `seed` direct).
**Impact:** Layer boundaries erode → harder maintenance, circular deps.
**Effort:** 8h
**Affected files:** New `scripts/check-layer-imports.ts`, `package.json` scripts
**Approach:** ESLint custom rule → warning mode first → error mode after 1 sprint

### 3. 169 Failing Tests (Non-Critical)
**Problem:** 30 test files fail on edge cases (TikTok polling, cross-agency credit, IP hashing).
**Impact:** Coverage gap — peripheral features untested.
**Effort:** 2-3 engineer-days
**Affected files:**
- `src/forest/publishing/__tests__/tiktok-publisher.test.ts`
- `src/seed/db/repositories/__tests__/cross-agency-isolation.test.ts`
- `src/tree/audit/usage-event-tracker.test.ts`
- `src/land/middleware/__tests__/social-tier-gate.test.ts`
- `src/forest/video/missions/__tests__/video-create.test.ts`
- + 25 more

---

## 🟠 P2 — Features (Thêm vào trong Q3 2026)

### 4. Advanced Analytics Dashboard
**Problem:** Current analytics là basic (PostHog events). Cần custom dashboard cho:
- Video view trends by campaign
- Conversion funnel (signup → setup → first video → paid)
- Revenue attribution per affiliate/channel
**Effort:** 1-2 weeks
**Files:** `src/app/[locale]/dashboard/analytics/`

### 5. Plugin Marketplace
**Problem:** Customers có thể muốn extend Sophia với custom workflows (Zapier, Make, n8n).
**Effort:** 2-3 weeks
**Approach:** MCP server pattern (codebase đã có Mekong MCP integration)

### 6. Multi-Tenant Sub-Accounts
**Problem:** Agency tier customers cần tạo sub-accounts cho clients.
**Effort:** 1-2 weeks
**Dependency:** CrossRef org ID resolution (`src/tree/auth/resolve-org-id.ts`)

### 7. Batch Video Scheduler v2
**Problem:** Current scheduler là basic cron. Cần visual Gantt-style schedule.
**Effort:** 1 week
**Files:** `src/app/[locale]/dashboard/schedule/`

---

## 🟡 P3 — Nice-to-Have (Q4+)

### 8. Custom Theme Builder
Drag-and-drop branding editor cho white-label. Không hiện tại phải edit code mỗi agency.

### 9. API Marketplace
Expose Sophia features như APIs (REST + GraphQL) cho customer tự build integrations.

### 10. AI Agent Orchestration Builder
Visual flow builder cho multi-step AI workflows (research → script → video → publish).

### 11. D1 → R2 Archival
Auto-move transaction records > 180 days từ D1 sang R2 (parquet) để tránh D1 size limit (10GB).

### 12. Automated Secret Rotation
Auto-rotate API keys (OpenRouter, ElevenLabs) trước khi expired thay vì manual.

---

## 📊 V2 Effort Summary

| Priority | Items | Estimated Effort |
|----------|-------|-----------------|
| P1 (Tech Debt) | 3 | 1-2 engineer-sprints |
| P2 (Features) | 4 | 5-8 engineer-weeks |
| P3 (Nice-to-Have) | 4 | TBD (needs PMF) |
| **TOTAL** | **11** | **~8-12 weeks** |

---

## 🏷️ Tracking

V2 backlog được track trong `plans/` theo format:
```
plans/YYMMDD-{issue}-{slug}/
```

Mỗi item cần:
1. Go/No-Go validation (brainstorm)
2. Plan với acceptance criteria
3. TDD implementation
4. Code review
5. Merge + deploy

---

**V2 Backlog Owner:** Pending assignment
**Next Review:** Week 1 after handover
**V2 Release Target:** Q3 2026
