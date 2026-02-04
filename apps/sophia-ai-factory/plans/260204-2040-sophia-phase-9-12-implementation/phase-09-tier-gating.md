# Phase 9: Tier Gating & API Security

## Overview
Implement robust server-side access control to ensure users can only access features permitted by their subscription tier (BASIC, PREMIUM, ENTERPRISE).

## Requirements
- **Middleware**: Reusable function to check tier access in API routes and Server Actions.
- **API Endpoint**: Client-side check endpoint `src/app/api/check-access/route.ts`.
- **Integration**: Use existing `src/lib/features.ts`.

## Files to Create/Modify
- `src/lib/tier-gate.ts`: New file for server-side gating logic.
- `src/app/api/check-access/route.ts`: New API route.

## Implementation Steps

1.  **Create `src/lib/tier-gate.ts`**
    - Import `Tier`, `FeatureFlag` from `@/types`.
    - Import `checkTierAccess` from `@/lib/features`.
    - Implement `verifyTierAccess(userTier: Tier, feature: FeatureFlag)` that throws unauthorized error or returns success.
    - Implement `withTierGate` higher-order function (optional, or just utility).

2.  **Create `src/app/api/check-access/route.ts`**
    - GET request handler.
    - Accepts `feature` query param.
    - Mock user tier retrieval (for now, default to BASIC or mock from headers).
    - Returns JSON `{ hasAccess: boolean, reason?: string }`.

3.  **Update `src/types/index.ts`** (if needed)
    - Ensure `AccessCheck` interface is exported (it is).

## Verification
- Test `verifyTierAccess` with BASIC tier trying to access ENTERPRISE feature (should fail).
- Test API route via `curl`.
