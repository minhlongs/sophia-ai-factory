---
title: "Phase 9: Tier Gating & API Security"
description: "Implement robust server-side access control to ensure users can only access features permitted by their subscription tier."
status: completed
priority: P1
effort: 1d
branch: master
tags: [security, access-control, middleware]
created: 2026-02-04
completed: 2026-02-05
---

# Phase 9: Tier Gating & API Security

## Overview
Implement robust server-side access control to ensure users can only access features permitted by their subscription tier (BASIC, PREMIUM, ENTERPRISE).

## Requirements
- [x] **Middleware**: Reusable function to check tier access in API routes and Server Actions.
- [x] **API Endpoint**: Client-side check endpoint `src/app/api/check-access/route.ts`.
- [x] **Integration**: Use existing `src/lib/features.ts`.

## Files to Create/Modify
- [x] `src/lib/tier-gate.ts`: New file for server-side gating logic.
- [x] `src/app/api/check-access/route.ts`: New API route.
- [x] `src/lib/tier-guard.ts`: Guard logic for limits.

## Implementation Steps

1.  [x] **Create `src/lib/tier-gate.ts`**
    - Import `Tier`, `FeatureFlag` from `@/types`.
    - Import `checkTierAccess` from `@/lib/features`.
    - Implement `verifyTierAccess(userTier: Tier, feature: FeatureFlag)` that throws unauthorized error or returns success.
    - Implement `withTierGate` higher-order function (optional, or just utility).

2.  [x] **Create `src/app/api/check-access/route.ts`**
    - GET request handler.
    - Accepts `feature` query param.
    - Mock user tier retrieval (for now, default to BASIC or mock from headers).
    - Returns JSON `{ hasAccess: boolean, reason?: string }`.

3.  [x] **Update `src/types/index.ts`** (if needed)
    - Ensure `AccessCheck` interface is exported (it is).

## Verification
- [x] Test `verifyTierAccess` with BASIC tier trying to access ENTERPRISE feature (should fail).
- [x] Test API route via `curl`.

