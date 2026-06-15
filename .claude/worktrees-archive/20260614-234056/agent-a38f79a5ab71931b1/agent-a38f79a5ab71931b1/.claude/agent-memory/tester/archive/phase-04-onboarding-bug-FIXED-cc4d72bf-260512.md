---
name: Phase 04 Onboarding Bug — telegram_paired_chats user_id vs paired_by
description: Critical bug in onboarding/page.tsx queries wrong column, breaks Telegram pairing step
type: project
---

## The Bug

**File:** `src/app/[locale]/dashboard/onboarding/page.tsx:42`

**Code:**
```typescript
SELECT COUNT(*) as cnt FROM telegram_paired_chats WHERE user_id = ?1
```

**Problem:** Column doesn't exist. Schema has `paired_by`, not `user_id`.

**Schema (0077-telegram-pairing.sql):**
```sql
CREATE TABLE IF NOT EXISTS telegram_paired_chats (
  chat_id TEXT PRIMARY KEY,
  first_name TEXT,
  paired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paired_by TEXT NOT NULL   ← ACTUAL COLUMN
);
```

## Impact

- Commit `5bcf1e09` (Phase 04, Wave 16)
- D1 will throw `"no such column: user_id"` at runtime
- Onboarding flow breaks for users with Telegram paired
- Step 2 (channels) completion never detected

## Proof

Phase 03 implementation (`get-user-channels.ts`) **correctly uses `paired_by`**:
```typescript
const pairedChats = await db
  .prepare(`SELECT * FROM telegram_paired_chats WHERE paired_by = ?1`)
  .bind(userId)
  .all();
```

## Fix Required

Change onboarding/page.tsx:42 from `user_id` to `paired_by`.

Need to apply BEFORE Wave 17 starts.

## Why It Wasn't Caught

- No unit/integration tests for onboarding server component
- D1 mocks in tests may have skipped real schema validation
- Manual testing didn't exercise Telegram pairing path

## Future Prevention

- Write integration tests for onboarding (especially Telegram step)
- Schema-aware linting for telegram_paired_chats queries
- Pre-deploy column name validation
