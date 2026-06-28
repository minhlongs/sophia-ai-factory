# Handoff Report — Codebase Exploration

## 1. Observation

- **Settings UI Structure**:
  - `src/app/[locale]/dashboard/settings/page.tsx` renders `<SettingsForm defaultValues={profile} />` imported from `src/forest/components/settings/settings-form.tsx`.
  - `src/forest/components/settings/settings-form.tsx` (lines 49-57) contains the user profile settings form layout:
    ```typescript
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6">
          <ProfileSection form={form} isPending={isPending} />
          <AppearanceSection form={form} />
          <ApiKeysSection form={form} isPending={isPending} defaultValues={defaultValues} />
          <NotificationsSection form={form} isPending={isPending} />
        </div>
      </form>
    );
    ```
  - `src/app/[locale]/dashboard/settings/customize/page.tsx` renders `CustomizePageClient` located in `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx`.
  - `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` (lines 13-21) has the following navigation list for tenant customizations:
    ```typescript
    const NAV_ITEMS: NavItem[] = [
      { id: 'branding', label: 'Branding' },
      { id: 'scoring', label: 'Scoring' },
      { id: 'geo', label: 'Geo Rules' },
      { id: 'cron', label: 'Cron / Scheduling' },
      { id: 'channels', label: 'Channels' },
      { id: 'mcp', label: 'MCP Registry' },
      { id: 'export-import', label: 'Export / Import' },
    ];
    ```

- **Settings Backend & D1 SQLite Storage**:
  - `src/app/api/v1/settings/[namespace]/route.ts` handles all tenant-wide namespace settings under `/api/v1/settings/:namespace`.
  - `src/lib/tenant-settings/types.ts` (lines 8-17) lists the valid settings namespaces including `'storage'`:
    ```typescript
    export type SettingsNamespace =
      | 'branding'
      | 'scoring'
      | 'geo'
      | 'cron'
      | 'channels'
      | 'mcp'
      | 'webhooks-defaults'
      | 'storage'
      | 'misc';
    ```
  - `src/lib/tenant-settings/namespace-validators.ts` (lines 132-139) defines `StorageSchema` with the requested R2 BYOS settings:
    ```typescript
    export const StorageSchema = z.object({
      r2AccessKeyId: z.string().min(1).max(256).nullable(),
      r2SecretAccessKey: z.string().min(1).max(256).nullable(),
      r2BucketName: z.string().min(1).max(128).nullable(),
      r2Endpoint: z.string().url().nullable(),
      r2PublicBaseUrl: z.string().url().nullable(),
      useTenantStorage: z.boolean().default(false),
    });
    ```
  - D1 SQLite Migration file `migrations/0085-tenant-settings.sql` (lines 5-14) shows the schema for the `tenant_settings` table:
    ```sql
    CREATE TABLE IF NOT EXISTS tenant_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      namespace TEXT NOT NULL,    -- 'branding' | 'scoring' | 'geo' | 'cron' | 'channels' | 'mcp' | etc
      value TEXT NOT NULL,        -- JSON blob
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, namespace)
    );
    ```
  - `src/lib/tenant-settings/registry.ts` (lines 59-92) shows how values are upserted into `tenant_settings`:
    ```typescript
    await db
      .prepare(
        `INSERT INTO tenant_settings (id, tenant_id, namespace, value, schema_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(tenant_id, namespace) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
      )
      .bind(generateId(), tenantId, namespace, serialized, now, now)
      .run();
    ```

- **Storage Consumption in Missions Engine**:
  - `src/forest/missions/handlers/video-create.ts` (lines 15-20) retrieves the storage configuration using D1:
    ```typescript
    const rawDb = await getD1Raw();
    const db = createServerClient();
    const storageSettings = await getOrDefault<StorageSettings>(rawDb, userId, 'storage');
    ```
  - If `storageSettings.useTenantStorage` is enabled, the creation flow routes to the local `cheetahclaws` renderer engine via OpenClaw MCP (lines 23-57) instead of falling back to HeyGen.

- **Setup Guide & Connection API Keys**:
  - The setup guide / onboarding wizard component resides in `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` and steps inside `src/tree/components/setup-wizard/`. Note that `/setup-wizard` has been deprecated and now redirects to `/dashboard/onboarding`.
  - The user's connection API key is generated and displayed on `/dashboard/api-keys` (handled by `src/app/[locale]/dashboard/api-keys/page.tsx` and `api-keys-client.tsx` which renders `<ApiKeyList />` from `src/forest/components/raas/api-key-list.tsx`).
  - Active keys are fetched via `GET /api/v1/api-keys` (defined in `src/app/api/v1/api-keys/route.ts`).
  - API keys verification logic uses SHA-256 hash validation in `src/forest/api-keys/d1-store.ts` (`verifyApiKey`) and is persisted in the D1 table `raas_user_api_keys`.

- **Compilation & Test Environments**:
  - Running `npm run ci:typecheck` runs `tsc --noEmit` and completed with no errors.
  - Test command is `vitest` (or `npm run ci:test` for a single run).
  - Build command is `NODE_OPTIONS=--max-old-space-size=4096 next build` (defined in `package.json`).
  - **Failing Unit Test**: `npm run ci:test` outputted the following error:
    ```
    FAIL  src/forest/missions/handlers/video-create.test.ts > video:create handler > writes heygen_job_id after HeyGen accepts the render job
    Error: [vitest] No "getD1Raw" export is defined on the "@/seed/db/client" mock. Did you forget to return it from "vi.mock"?
    ```

---

## 2. Logic Chain

1. **Settings Form Placement**:
   - The user has two settings routes: personal settings (`/dashboard/settings` using `UserProfileFormValues` schema) and tenant settings (`/dashboard/settings/customize` using `SettingsNamespace` schemas).
   - Because `storage` is one of the `SettingsNamespace` schemas and its value is stored under the `storage` namespace in the `tenant_settings` table (rather than `user_profiles`), we must place the R2 BYOS form on the Tenant Customization Page (`/dashboard/settings/customize`).
   - Specifically, we need to add a new `'storage'` nav item to `NAV_ITEMS` in `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx`, and add a `<StoragePanel />` component in the same client file to render and manage the form inputs.

2. **Backend Persistance Integration**:
   - The existing dynamic API `/api/v1/settings/[namespace]/route.ts` automatically maps requests to `/api/v1/settings/storage` since `'storage'` is in `SETTINGS_NAMESPACES`.
   - On `PATCH` or `PUT`, the endpoint uses the `validatorFor('storage')` helper, which matches `StorageSchema` in `src/lib/tenant-settings/namespace-validators.ts`, validating all key/bucket/endpoint fields before saving.
   - The registry code persists this validated settings object as a JSON-serialized string in the `value` column of the `tenant_settings` table, unique per `tenant_id` and the `storage` `namespace`.

3. **Onboarding and API Key Access**:
   - For connecting the local OpenClaw agent, the user navigates to `/dashboard/api-keys` (accessible via cmd-k search or `/dashboard/agi`).
   - The generated API key is stored in D1 table `raas_user_api_keys`, hashed via SHA-256 for security, and can be retrieved or revoked directly from the UI.

4. **Unit Test Failure Cause**:
   - `src/forest/missions/handlers/video-create.test.ts` (lines 11-13) mocks `@/seed/db/client` with:
     ```typescript
     vi.mock('@/seed/db/client', () => ({
       createServerClient: vi.fn(),
     }));
     ```
   - However, the source file `src/forest/missions/handlers/video-create.ts` now calls `getD1Raw()` which is imported from `@/seed/db/client`.
   - Because `getD1Raw` is not mocked in the test file, Vitest throws the export missing error.

---

## 3. Caveats

- **Extended TTL Role**: The role checking for extended TTL in `/api/openclaw/exchange` references a `'service'` role that is mentioned as not yet in the DB schema; this doesn't affect our storage configuration but is good to keep in mind.
- **R2 Connectivity Validation**: The backend does not currently have a dedicated `/api/v1/settings/storage/test` endpoint to check credentials against Cloudflare R2 before saving, unlike HeyGen or Resend. It only performs Zod structural schema validation.

---

## 4. Conclusion

To implement the Storage Settings Form (R2 BYOS), edit:
1. **`src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx`**: Add the `'storage'` tab to `NAV_ITEMS` and build a `<StoragePanel />` that provides form controls for the R2 credentials and sends changes via `PATCH /api/v1/settings/storage`.
2. **`src/lib/tenant-settings/defaults.ts`**: Verify `DEFAULT_STORAGE` defines initial default values.
3. **`src/forest/missions/handlers/video-create.test.ts`**: Fix the mock of `@/seed/db/client` to export `getD1Raw` to fix the unit test suite failure:
   ```typescript
   vi.mock('@/seed/db/client', () => ({
     createServerClient: vi.fn(),
     getD1Raw: vi.fn(),
   }));
   ```

The backend routes (`/api/v1/settings/[namespace]/route.ts`), database schemas (`tenant_settings` table), and Zod validator (`StorageSchema` in `src/lib/tenant-settings/namespace-validators.ts`) are already configured and fully support this feature.

---

## 5. Verification Method

- Run TypeScript typecheck:
  ```bash
  npm run ci:typecheck
  ```
- Run the test suite:
  ```bash
  npm run ci:test
  ```
- Validate UI integration after edits by loading the `/dashboard/settings/customize` page and checking the "Storage" tab exists and updates successfully.
