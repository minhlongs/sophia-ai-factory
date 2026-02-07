# UI Polish Report: Sophia AI Factory
**Date:** 2026-02-07
**Phase:** 3 - Polish

## 1. Major Issue: Duplicate UI Libraries
We have two competing UI component libraries:
*   **System Library (`src/components/ui`)**: Standard Shadcn/Radix implementation.
*   **Landing Library (`src/app/components/ui`)**: Custom "Neon/Glass" implementation.

**Conflicting Components:** `Badge`, `Button`, `Card`, `Container`, `SectionHeading`.

## 2. Inconsistent Usage
Dashboard components are importing from the Landing library to access specific visual styles ("glow" effect), causing a mix-and-match problem.
*   **Example**: `src/app/dashboard/page.tsx` uses `@/app/components/ui/button`.

## 3. Consolidation Plan
**Goal:** Consolidate all UI components into `src/components/ui` and delete `src/app/components/ui`.

### Phase 3.1: Component Enhancement
1.  **Button**: Port `glow`, `ghost`, and `primary` styles to `src/components/ui/button.tsx` using `cva` variants.
2.  **Card**: Add `glass` variant/prop to `src/components/ui/card.tsx`.
3.  **Badge**: Merge `basic`, `premium`, `enterprise` variants.

### Phase 3.2: Refactor
1.  Update imports in `src/app/components/sections/*` to use `@/components/ui/...`.
2.  Update imports in `src/app/dashboard/*` to use `@/components/ui/...`.

### Phase 3.3: Cleanup
1.  Delete `src/app/components/ui`.
2.  Verify build.
