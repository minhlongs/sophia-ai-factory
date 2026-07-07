---
phase: 1
title: "Lower Creator Gate"
status: completed
effort: "Small+ (3-5h)"
priority: P1
dependencies: []
---

# Phase 1: Lower Creator Gate

## Overview

SOP creator dashboard (`/dashboard/sop-creator/`) currently gated to **MASTER** ($4,999). Change to **application-based** via existing beta-invite system so any tier user can apply. MASTER users keep unrestricted access.

**Red-team fix notes:**
- `isBetaInviteApproved()` does not exist in codebase — use email-based lookup against `beta_invites` table
- Helper must live in `land/sop-marketplace/` (not `tree/`) to avoid layer violation
- Must add DB migration for user-invite mapping
- Must add admin review gate before publishing (self-publish vulnerability)

## Context

- `page.tsx` line 55: `if (tier !== 'MASTER') redirect(...)`
- `actions.ts` line 16: `if (tier !== 'MASTER') return { error: 'masterRequired' }`
- `new/page.tsx` line 30: `if (tier !== 'MASTER') redirect(...)`
- **`[id]/page.tsx` line 57: ALSO gates at MASTER — was missing from initial plan**
- Beta invites: `land/sop-marketplace/beta-invites.ts` — supports invite codes + validation
- Tier lookup: `resolveUserTier()` from `@/seed/db/resolve-user-tier`

## Architecture

```
User visits /dashboard/sop-creator
  → Check: is MASTER? → allow unrestricted
  → Check: has approved beta invite (email-based)? → allow
  → Otherwise → show "Become a Creator" page with application form

Publishing flow:
  → Creator submits SOP for review → status = 'pending_review'
  → Admin reviews → approves → status = 'published'
  → No self-publish (security gate)
```

## Related Code Files

- **Modify:** `src/app/[locale]/dashboard/sop-creator/page.tsx`
- **Modify:** `src/app/[locale]/dashboard/sop-creator/actions.ts`
- **Modify:** `src/app/[locale]/dashboard/sop-creator/new/page.tsx`
- **Modify:** `src/app/[locale]/dashboard/sop-creator/[id]/page.tsx` (4th gate — was missing)
- **Create:** `src/land/sop-marketplace/creator-access.ts` (helper — NOT in tree/)
- **Create:** `src/app/[locale]/dashboard/sop-creator/apply/page.tsx` (application form)
- **Create:** `migrations/NNNN_user_beta_invites.sql` (user-invite mapping table)
- **Modify:** `src/land/sop-marketplace/beta-invites.ts` (add `isBetaInviteApproved` function)
- **Modify:** `src/land/sop-marketplace/index.ts` (add new exports)

## Implementation Steps

### 1.1 Add DB migration: user-invite mapping

```sql
-- migrations/NNNN_user_beta_invites.sql
CREATE TABLE IF NOT EXISTS user_beta_invites (
  user_id TEXT NOT NULL PRIMARY KEY,
  invite_code TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  approved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 1.2 Add `isBetaInviteApproved` to beta-invites module

Add to `src/land/sop-marketplace/beta-invites.ts`:

```typescript
export async function isBetaInviteApproved(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT approved FROM user_beta_invites WHERE user_id = ?1')
    .bind(userId)
    .first<{ approved: number }>();
  return row?.approved === 1;
}
```

### 1.3 Create creator-access helper

Create at `src/land/sop-marketplace/creator-access.ts` (NOT tree/ — avoids layer violation):

```typescript
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { isBetaInviteApproved } from './beta-invites'; // same layer

export async function hasCreatorAccess(userId: string, db: D1Database): Promise<boolean> {
  const tier = await resolveUserTier(userId);
  if (tier === 'MASTER') return true;
  return isBetaInviteApproved(db, userId);
}
```

Export from `src/land/sop-marketplace/index.ts`.

### 1.4 Update all 4 MASTER gate files

Update `page.tsx`, `actions.ts`, `new/page.tsx`, AND `[id]/page.tsx`:

Change from:
```typescript
if (tier !== 'MASTER') redirect(`/${locale}/pricing`);
```
To:
```typescript
const { hasCreatorAccess } = await import('@/land/sop-marketplace');
const canCreate = await hasCreatorAccess(user.id, db);
if (!canCreate) {
  // For page.tsx: render "Become a Creator" CTA
  // For new/page.tsx and [id]/page.tsx: redirect to /dashboard/sop-creator
  // For actions.ts: return { error: t('creatorAccessRequired') }
}
```

### 1.5 Create "Become a Creator" application page

New page at `/dashboard/sop-creator/apply/` with:
- Value proposition: 70/30 revenue split
- Application form → creates `user_beta_invites` row with `approved=0`
- On success: "Your application is under review" message
- Admin reviews via existing admin panel and sets `approved=1`

### 1.6 Add admin review gate (security fix)

Modify `submitForReviewAction` in `actions.ts`:
- Set listing status to `pending_review` (NOT `published`)
- Create admin review queue at `/dashboard/admin/sop-reviews/`
- Admin action: approve → set `published`, reject → set `draft` with reason

### 1.7 Add i18n keys

Add to `messages/en.json` and `messages/vi.json`:
- sop.creator.apply.title, description, submit, pending
- sop.creator.gate.notAuthorized
- sop.creator.submit.pendingReview (instead of auto-publish)

## Success Criteria

- [ ] Non-MASTER with approved beta invite can access creator dashboard
- [ ] Non-MASTER without invite sees "Become a Creator" CTA
- [ ] MASTER users have unrestricted access (backward compat)
- [ ] All 4 gate files updated (including [id]/page.tsx)
- [ ] SOP submissions go through pending_review → admin approve flow
- [ ] DB migration applied cleanly
- [ ] i18n keys for all new UI (VI + EN)
- [ ] All existing tests pass

## Risk Assessment

- **Low:** MASTER tier unaffected. Change is additive.
- **Medium:** Admin review queue needs UI — minimal effort if reusing existing admin patterns.
- **Medium:** Migration must be backwards-compatible with existing beta_invites.
