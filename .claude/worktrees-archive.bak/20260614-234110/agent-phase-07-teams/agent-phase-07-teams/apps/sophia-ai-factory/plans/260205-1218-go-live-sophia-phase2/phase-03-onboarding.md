# Phase 3: Customer Onboarding & Security

**Goal**: Users securely connect their own affiliate networks.

## 1. Settings UI (`src/app/(admin)/admin/settings/page.tsx`)
- Refactor existing mock page.
- Add "Affiliate Integrations" section.
- Forms for:
  - ClickBank (Nickname, API Key)
  - ShareASale (Merchant ID, Token)
- Save to `user_integrations` table via Server Action.

## 2. Server Action (`src/app/actions/settings.ts`)
- Authenticate user.
- Validate inputs.
- UPSERT into `user_integrations`.
- **Security**: Ideally encrypt before saving if not using pgcrypto. For MVP, RLS + TLS is acceptable, but "Best Practice" suggests app-level encryption using `process.env.ENCRYPTION_KEY`.

## 3. Adapter Update
- Update `src/lib/ingestion/adapters/*` to fetch credentials from `user_integrations` if running in "User Mode" (vs System Mode).
- Currently adapters might be hardcoded to env vars.
- **Refactor**: Adapters should accept a `config` object.

```typescript
// src/lib/ingestion/adapters/clickbank-adapter.ts
export class ClickBankAdapter extends BaseAdapter {
  constructor(private config?: { apiKey: string }) { ... }
}
```

## 4. Setup Wizard Update
- Allow users to skip "System Keys" if they are end-users (SaaS mode).
- Focus Wizard on "My Integrations".
