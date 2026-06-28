## 2026-05-30T06:57:37Z
You are teamwork_preview_worker.
Your working directory is: /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.agents/worker_implementation
Your mission is to implement the Storage Settings Form (R2 BYOS) and the Local Engine Setup Guide for Sophia AI Factory as defined in ORIGINAL_REQUEST.md.

Detailed Instructions:

1. Storage Settings Form (R2 BYOS):
- Edit `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` to add a new tab to `NAV_ITEMS`:
  `{ id: 'storage', label: 'Storage (R2 BYOS)' }`
- Create a `<StoragePanel />` component within `customize-page-client.tsx`.
- The `<StoragePanel />` should:
  - Load settings on mount from `GET /api/v1/settings/storage`.
  - Provide a form for user credentials inputs: `r2AccessKeyId`, `r2SecretAccessKey`, `r2BucketName`, `r2Endpoint`, `r2PublicBaseUrl`, and a toggle for `useTenantStorage` (boolean).
  - Use consistent Tailwind styling matching other panels (like ChannelsPanel).
  - Obfuscate/mask credential keys (inputs `r2AccessKeyId` and `r2SecretAccessKey` should be masked, e.g. using `type="password"` or displaying `••••••••••••••••` if they already exist in the database).
  - When saving (submitting via `PATCH /api/v1/settings/storage`), do NOT submit the mask value `••••••••••••••••` to prevent overwriting the saved values. Only send changed values in the PATCH payload. If the value is empty, send `null` (since the schema allows null).
  - Handle loading, saving, and error states gracefully in the UI.

2. Local Engine Setup Guide Component:
- Create a client component `src/app/[locale]/dashboard/components/local-setup-guide.tsx`.
- The setup guide should:
  - Display a clear, step-by-step "Zero-Config Setup Guide" for local rendering on the dashboard.
  - Show the shell command to download and run the installer:
    `curl -s https://platform.sophia.ai/install-m1.sh | bash`
  - Provide a copy-to-clipboard button next to the command.
  - If a connection API key is provided, display it (e.g. `sk_live_12345678...`) and provide a copy-to-clipboard button for it.
  - If no active connection API key is provided, display a helpful message instructing the user to generate an API key and a button/link directing them to `/${locale}/dashboard/api-keys`.
  - Style the component beautifully as a card using Tailwind CSS, aligning with other dashboard components.
  - Support both English and Vietnamese layouts/messages based on the locale.

3. Update Dashboard Page:
- Edit `src/app/[locale]/dashboard/page.tsx`.
- Query the D1 SQLite database for the user's active API keys from the `raas_user_api_keys` table:
  `SELECT key_id FROM raas_user_api_keys WHERE owner_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
- If an active key exists, extract its `key_id` and construct the display key string `sk_live_<key_id.slice(0, 8)>...`.
- Import and render `<LocalSetupGuide apiKey={activeApiKey || null} locale={isVi ? 'vi' : 'en'} />` right below `<OnboardingStatusWidget isVi={isVi} />` on the dashboard.

4. Verification:
- Run TypeScript typecheck: `npm run ci:typecheck`
- Run unit tests: `npm run ci:test`
- Write your handoff report in `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.agents/worker_implementation/handoff.md` and report back when complete.
