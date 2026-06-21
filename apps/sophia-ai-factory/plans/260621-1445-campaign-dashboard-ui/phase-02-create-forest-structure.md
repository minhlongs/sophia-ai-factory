# Phase 2: Create Forest Dashboard Campaign Structure

## Context Links
- `src/forest/dashboard/` (existing dashboard data module)
- `src/forest/components/dashboard/` (existing dashboard UI widgets)

## Overview
Create the directory structure for forest-level campaign UI components: `src/forest/dashboard/campaign/` with proper barrel exports and types.

## Implementation Steps
1. Create directory: `src/forest/dashboard/campaign/`
2. Create `src/forest/dashboard/campaign/__tests__/` for test files.
3. Create `src/forest/dashboard/campaign/types.ts` for component-specific types (if needed).
4. Create `src/forest/dashboard/campaign/index.ts` to export all components.
5. Ensure the module follows forest layer conventions (pure TypeScript/React, no server-only logic).

## Todo List
- [ ] Create directory
- [ ] Create __tests__ folder
- [ ] Create types.ts
- [ ] Create index.ts
- [ ] Add barrel export to parent `src/forest/dashboard/index.ts` (re-export from ./campaign)

## Success Criteria
- Directory structure exists
- TypeScript compiles
- Components can be imported via `@/forest/dashboard/campaign`
