# Phase 2: Core Infrastructure (Tiers & Data)

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Implement the business logic for Tiers, Feature Flags, and Data Models.

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: Pending
- **Description**: Build the backend-logic-on-frontend. This includes defining the Tiers (Basic, Premium, Enterprise), the Feature Flag configuration (Local Config pattern), and the Data Models for the Affiliate Engine. This ensures type safety across the application.

## Key Insights
- **YAGNI**: Don't use external SaaS (PostHog/LaunchDarkly) yet. Use TypeScript constants (`Local Config`).
- **Entitlements**: Tiers are static entitlements. Feature flags are dynamic overrides.
- **RSC**: Use Server Components to check tiers/flags to prevent leaking logic to the client.

## Requirements
1.  **Tier System**:
    -   `BASIC`: Limited access.
    -   `PREMIUM`: Full access to tool, limited affiliate list.
    -   `ENTERPRISE`: Full access + Admin + API integrations.
2.  **Feature Flags**:
    -   `enable_affiliate_engine`
    -   `enable_admin_dashboard`
    -   `enable_roi_calculator`
3.  **Data Models**:
    -   `AffiliateProgram` interface (name, commission, cookie, category, etc.).
    -   `User` mock interface (for tier checking).

## Architecture
- **Config**: `config/tiers.ts` (Static definitions).
- **Lib**: `lib/features.ts` (Logic to check access).
- **Data**: `data/affiliate-programs.json` (The "Clean 20" list).
- **Types**: `types/index.ts` (Shared types).

## Related Code Files
- `config/tiers.ts`
- `config/flags.ts`
- `lib/features.ts`
- `types/index.ts`
- `data/affiliate-programs.json`

## Implementation Steps
1.  **Define Types**: Create `types/index.ts` with `Tier`, `FeatureFlag`, `AffiliateProgram`.
2.  **Create Tier Config**: Implement `config/tiers.ts` with limits and capabilities per tier.
3.  **Create Feature Flags**: Implement `config/flags.ts` with default values (environment variable overrides supported).
4.  **Implement Logic**: Create `lib/features.ts` with functions like `checkTierAccess(tier, feature)` and `getFeatureFlag(flag)`.
5.  **Seed Data**: Create `data/affiliate-programs.json` with 20 dummy/real "Clean" programs based on the research.
6.  **Create Data Access Layer**: Create `lib/affiliates.ts` to read/filter the JSON data.

## Todo List
- [ ] Create `types/index.ts`.
- [ ] Implement `config/tiers.ts`.
- [ ] Implement `config/flags.ts`.
- [ ] Implement `lib/features.ts` (Access Control).
- [ ] Create `data/affiliate-programs.json` (20 items).
- [ ] Implement `lib/affiliates.ts` (getPrograms, filterPrograms).
- [ ] Verify type safety.

## Success Criteria
- [ ] `checkTierAccess('BASIC', 'admin_dashboard')` returns false.
- [ ] `checkTierAccess('ENTERPRISE', 'admin_dashboard')` returns true.
- [ ] Affiliate data is typed and accessible via `lib/affiliates.ts`.

## Risk Assessment
- **Risk**: Hardcoding user state.
- **Mitigation**: Create a mock `getCurrentUser()` function in `lib/auth.ts` that reads a cookie or header, allowing us to simulate different users easily.

## Next Steps
- Proceed to Phase 3: Landing Page Core.
