---
title: "All Goals Execution — Post-GO-LIVE Ship"
description: "Execute all outstanding goals step by step: (1) re-score Phase 5 scorecard with current HEAD, (2) Phase 17 TS18046 batch cleanup, (3) staging deploy + smoke test, (4) tidy untracked source dirs into commits. Mode: cook --auto --parallel where safe."
status: in_progress
priority: P0
created: 2026-06-02
owner: Long Tho
---

# All Goals Execution

## Success criteria
- Phase 5 scorecard re-scored ≥ 75/100 honest
- TS18046 errors reduced from 28 → 26 (admin/dunning batch)
- Staging deploy + smoke test green (curl 200 + smoke per deploy-verify)
- Untracked source dirs committed in coherent groups

## Execution order
1. Phase 5 re-score (sequential — reads current codebase)
2. Phase 17 TS18046 batch (sequential — code cleanup)
3. Staging deploy + smoke test (sequential — deploy)
4. Tidy untracked dirs (parallel-safe — 4 independent groups)

---

## Goal 1 — Re-score Phase 5 Scorecard

**Context:** Scorecard dated 2026-05-22 shows 67/100. Wave A (d707605b), Wave B (1ebd38a6), Wave C (9423e473) shipped after scorecard. Need honest re-score with current HEAD.

**Steps:**
- [x] Read current HEAD SHA + compare against scorecard prod anchor d86659bf
- [x] Verify Wave A fixes still present (V-1.1 ownership check, V-1.2 API key bind, D-5.1 Next.js bump, GAP-R1 d1 backup cron, GAP-R3 publish-execute idempotent)
- [x] Verify Wave B fixes still present (V-1.3 org_id schema, V-2.1 AES-GCM AAD, GAP-R2 migration baseline)
- [x] Verify Wave C fixes still present (NOT NULL enforcement, logger swap, test gate, gitlab mirror)
- [x] Re-score each axis with evidence from codebase (honest, no waivers)
- [x] Update `reports/phase5-go-live-scorecard.md` with new scores + rationale
- [x] Mark Goal 1 plan items done

---

## Goal 2 — Phase 17: TS18046 Batch Cleanup

**Context:** 28 TS18046 errors remain in `src/app/api/admin/dunning/[licenseNonce]/restore.ts` and `suspend.ts`. These are "Object is possibly null/undefined" errors from type narrowing issues.

**Steps:**
- [ ] Read `src/app/api/admin/dunning/[licenseNonce]/restore.ts` — identify TS18046 lines
- [ ] Read `src/app/api/admin/dunning/[licenseNonce]/suspend.ts` — identify TS18046 lines
- [ ] Apply null-safe narrowing (non-null assertions where safe, or optional chaining + early returns)
- [ ] Run `npx tsc --noEmit --pretty` to verify TS18046 count drops from 28 → 26
- [ ] Run affected test files if they exist
- [x] Mark Goal 1 plan items done

---

## Goal 3 — Staging Deploy + Smoke Test

**Context:** Need to verify Wave A/B/C shipped correctly to staging. Per `sophia-deploy-verify.md`: SHA match + curl 200 + smoke.

**Steps:**
- [ ] Read `sophia-deploy-verify.md` for verification procedure
- [x] Run deploy script or confirm current deploy state
- [x] Curl key health endpoints (expect 200)
- [x] Run smoke tests (DB connectivity, auth, campaign creation, BYOK encrypt/decrypt)
- [ ] Log results in `reports/staging-smoke-260602.md`
- [x] Mark Goal 1 plan items done

---

## Goal 4 — Tidy Untracked Source Dirs

**Context:** 4 independent groups of untracked files need coherent commits.

**Group A — Board pack (admin)**
- `src/app/api/admin/board-pack/[id]/route.ts`
- `src/app/api/admin/board-pack/route.ts`

**Group B — Investor room**
- `src/app/investor-room/page.tsx`
- `src/app/investor-room/data-room.tsx`
- `src/app/investor-room/document-section.tsx`

**Group C — SOP marketplace**
- `src/app/api/sop-marketplace/route.ts`
- `src/sop-marketplace/` (existing tracked dir, check for new files)

**Group D — Enterprise features**
- `src/land/enterprise-features.ts`
- `src/land/openclaw/automation-hooks.ts`

**Steps per group:**
- [x] Review each file for coherence + no secrets
- [x] Stage + commit with descriptive message
- [x] Verify build passes after each group (committed in 4 coherent groups)

---

## Execution log

