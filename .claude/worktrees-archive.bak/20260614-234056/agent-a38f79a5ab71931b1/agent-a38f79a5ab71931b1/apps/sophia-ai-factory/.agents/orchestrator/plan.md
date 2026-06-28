# Implementation Plan: Sophia AI Factory R2 Settings & Guide Dashboard

## Milestones

### Milestone 1: Fix video-create.test.ts Unit Test Mock
- **Goal**: Patch mock in `src/forest/missions/handlers/video-create.test.ts` to export `getD1Raw` alongside `createServerClient`.
- **Verify**: Run `npm run ci:test` to confirm the test failure is resolved.

### Milestone 2: Implement Storage Settings Form (R2 BYOS)
- **Goal**: Add a "Storage (R2 BYOS)" tab to `CustomizePageClient` in `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` with inputs for:
  - `r2AccessKeyId`
  - `r2SecretAccessKey`
  - `r2BucketName`
  - `r2Endpoint`
  - `r2PublicBaseUrl`
  - `useTenantStorage` (toggle)
- **Security**: Obfuscate/mask credential keys after saving. Avoid sending the mask value `••••••••••••••••` back on PATCH.
- **Verify**: Type check passes, and PATCH updates the database.

### Milestone 3: Implement Local Engine Setup Guide
- **Goal**: Create a new component `src/app/[locale]/dashboard/components/local-setup-guide.tsx` displaying the setup steps, installer curl command, copy button, and user's active connection API key.
- **Goal**: Update `src/app/[locale]/dashboard/page.tsx` to fetch the first active API key from the D1 table `raas_user_api_keys` and render the setup guide.
- **Verify**: Guide loads correctly, displays correct curl command and copies successfully.

### Milestone 4: Final Quality Check & Compilation Verification
- **Goal**: Run compilation type checks and the full test suite.
- **Verify**: `npm run ci:typecheck` and `npm run ci:test` pass with zero errors.
