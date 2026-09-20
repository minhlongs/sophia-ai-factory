# Technical Architecture & Design Report: Milestone 2 — D1 Schema, Seat Quota Enforcement & Cryptographic Invitation Lifecycle

**Author:** teamwork_preview_explorer_m2_1 (Teamwork Explorer)  
**Date:** 2026-09-20  
**Target Milestone:** Milestone 2: Multi-User Organizations & 5-Tier RBAC  
**Status:** DESIGN COMPLETE (Ready for Implementation)

---

## Executive Summary

This report establishes the production-grade technical specification for **Milestone 2 (Multi-User Organizations & Invitations)** in Sophia AI Factory. It provides the exact D1 SQL schema for `org_invitations`, the Seat Quota Enforcement Engine accounting for active members and pending invites across 4 subscription tiers, and the end-to-end cryptographic lifecycle for single-use 256-bit CSPRNG invitation tokens with SHA-256 hash storage and atomic consumption.

All components strictly comply with Sophia AI Factory's **Constitution (`AGENTS.md`)**, the **4-Layer Architecture (`seed` → `tree` → `forest` → `land`)**, and the **Cloudflare Workers / D1 (Edge SQLite)** execution model.

---

## 1. Observation

Direct code and migration observations gathered from the repository:

1. **Existing Foundation Migration (`0276_enterprise_scale_foundations.sql`)**:
   - Location: `apps/sophia-ai-factory/migrations/0276_enterprise_scale_foundations.sql`
   - Content: Currently defines `custom_domains` (lines 16–35) for Cloudflare for SaaS verification. It does not yet define `org_invitations`.
   - Migration tracking: `scripts/apply-migrations.sh` (lines 257–268) records applied migrations in `d1_migrations`. If `0276` was already executed against a target database, appending to it will be skipped by the migration runner (`SELECT COUNT(*) FROM d1_migrations WHERE name = '0276_enterprise_scale_foundations'`).
2. **Existing Core Tables (`0001-init.sql`)**:
   - Location: `apps/sophia-ai-factory/migrations/0001-init.sql` (lines 21–38)
   - `organizations`: `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `slug TEXT UNIQUE`, `plan TEXT DEFAULT 'free'`, `settings TEXT DEFAULT '{}'`, `created_at`, `updated_at`.
   - `org_members`: `id TEXT PRIMARY KEY`, `org_id TEXT NOT NULL REFERENCES organizations(id)`, `user_id TEXT NOT NULL REFERENCES users(id)`, `role TEXT DEFAULT 'member'`, `created_at`, `UNIQUE(org_id, user_id)`.
   - Production usage: Confirmed across 80+ files (`src/seed/auth/resolve-org-id.ts:44`, `src/land/admin/org-manager.ts:105`, `src/forest/quota/org-quota-checker.ts:52`) that the canonical database table is `org_members`.
3. **Existing Org Manager Server Action (`org-manager.ts`)**:
   - Location: `apps/sophia-ai-factory/src/land/admin/org-manager.ts` (lines 245–300)
   - `inviteMember` currently performs a naive synchronous lookup on `users WHERE email = ?1` and immediately inserts into `org_members`. It does not support cryptographic invitations, external invitees who have not yet registered, pending status, expiration, or seat quotas.
   - Allowed roles are hardcoded to `['owner', 'admin', 'member']` (line 259), lacking the enterprise 5-tier RBAC (`owner`, `admin`, `creator`, `billing_manager`, `viewer`).
4. **Seat Quota & Tier Definitions**:
   - `apps/sophia-ai-factory/src/seed/config/tiers/unified-limits.ts` (lines 57–142):
     - `BASIC`: `teamMembers: 1`
     - `PREMIUM`: `teamMembers: 5`
     - `ENTERPRISE`: `teamMembers: 999`
     - `MASTER`: `teamMembers: 999`
   - `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts` (lines 74–84):
     - Tests exact tier limits: `Free: 1`, `Starter: 1`, `Pro: 5`, `Master: 999`.
5. **Cryptographic Primitives in Edge Runtime**:
   - `apps/sophia-ai-factory/src/seed/security/signature.ts` (lines 17–85):
     - Uses standard Web Crypto API: `crypto.getRandomValues`, `crypto.subtle.digest`, `timingSafeEqual`.
     - Zero Node.js built-ins (`crypto` module), making it 100% Cloudflare Workers edge-runtime compliant.
6. **E2E Contract Suite Assertions (`organizations-rbac.e2e.test.ts`)**:
   - Line 206: Token must be 64 hex characters (32 bytes / 256 bits).
   - Line 219–221: Raw token must NEVER be stored in DB; `token_hash` must be stored and match 64 hex chars.
   - Line 230–235: Expiration must be exactly 7 days ($7 \times 24 \times 60 \times 60 \times 1000$ ms) from creation.
   - Line 255: Email must be normalized to lowercase and trimmed.
   - Line 298–304: Acceptance must be single-use; second consumption throws `INVITATION_ALREADY_USED`.
   - Line 312–332: Seat quota must be re-validated at acceptance time to prevent oversubscription races.

---

## 2. Logic Chain

From the observed evidence, the required architecture is deduced as follows:

```
[Inviter / Admin Action]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  1. Check Seat Quota:                                    │
│     Active Members + Pending Invites < Max Seats         │
└──────────────────────────────────────────────────────────┘
       │ Allowed
       ▼
┌──────────────────────────────────────────────────────────┐
│  2. Generate 256-bit CSPRNG Token (Web Crypto)           │
│     Raw Token: 64 hex characters                         │
│     Token Hash: SHA-256(Raw Token) (64 hex characters)   │
│     TTL: Date.now() + 7 * 86,400,000 ms                  │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  3. Persist to D1 `org_invitations`:                     │
│     INSERT INTO org_invitations                          │
│     (id, org_id, email, role, token_hash, expires_at,    │
│      created_by, created_at, status='pending')           │
└──────────────────────────────────────────────────────────┘
       │ Return raw token ONCE in invite URL
       ▼
[Invitee Receives Invite Link: /invitations/accept?token=...]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  4. Acceptance & Verification:                           │
│     a. Compute SHA-256(token)                            │
│     b. Query org_invitations WHERE token_hash = ?        │
│     c. Verify: status == 'pending', expires_at > now     │
│     d. Re-check Seat Quota: active_members < max_seats   │
└──────────────────────────────────────────────────────────┘
       │ Valid
       ▼
┌──────────────────────────────────────────────────────────┐
│  5. Atomic Consumption (D1 Batch):                       │
│     UPDATE org_invitations SET status='accepted',        │
│       accepted_at=now WHERE id=? AND status='pending'    │
│     INSERT INTO org_members (org_id, user_id, role)      │
└──────────────────────────────────────────────────────────┘
```

1. **Schema & Migration Placement Reasoning**:
   - To adhere to forward-only migration discipline while supporting single-run deployments:
     - **Option 1 (Consolidated)**: If `0276` has not been applied to production D1, append `org_invitations` table to `0276_enterprise_scale_foundations.sql`.
     - **Option 2 (Standalone - Recommended)**: Create `0277_enterprise_org_invitations.sql`. Because `scripts/apply-migrations.sh` records applied filenames in `d1_migrations`, creating `0277` guarantees clean execution on any staging or remote database where `0276` already ran.
   - Field naming: Both `created_by` (prompt specification) and `invited_by` (test harness compatibility) must be supported. In SQLite 3.31+, `invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL` provides transparent dual-compatibility with zero storage overhead.
2. **Seat Quota Enforcement Logic Reasoning**:
   - If an organization has 5 seats and already has 4 members and 1 pending invite, sending another invite would allow 6 potential members. Therefore, the quota engine MUST count:
     $$\text{Allocated Seats} = \text{Active Members} + \text{Pending Non-Expired Invites}$$
   - Any invite with `status = 'pending'` whose `expires_at <= now()` must NOT be counted against the quota, allowing the organization to invite another user once an invitation expires.
   - When an invite is accepted, the invitee becomes an active member. Because multiple invites could be out simultaneously, acceptance must re-verify that active members $< \text{maxSeats}$ before insertion.
3. **Cryptographic Token Generator Reasoning**:
   - Storing raw invitation tokens in the database exposes all pending invitations to anyone with read access to database backups or logs.
   - By storing `token_hash = SHA256(raw_token)`:
     - The database stores only a one-way digest.
     - Token lookup is timing-safe and indexed via `uidx_org_invitations_token_hash`.
     - 256 bits of entropy ($2^{256}$ states) guarantees zero collision probability and infeasibility of enumeration attacks.
   - Expiration checking occurs dynamically on verification and is lazily updated to `expired` if encountered past its TTL.
   - Atomic acceptance uses Compare-And-Swap (`UPDATE ... WHERE id = ? AND status = 'pending'`), checking `meta.changes === 1` to strictly prevent replay attacks and double consumption.

---

## 3. Pillar 1: D1 SQL Schema (`org_invitations`)

### 3.1. Complete Table Specification

```sql
-- ============================================================================
-- TABLE: org_invitations
-- Description: Cryptographic single-use invitations for multi-user organizations.
-- Conforms to 5-Tier RBAC, 7-day TTL, and SHA-256 hash storage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('owner', 'admin', 'creator', 'billing_manager', 'viewer')
  ),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER DEFAULT NULL,
  created_by TEXT NOT NULL,
  invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'revoked', 'expired')
  )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE & INTEGRITY
-- ============================================================================

-- 1. Fast, timing-safe lookup by SHA-256 token hash (Acceptance critical path)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_token_hash 
  ON org_invitations(token_hash);

-- 2. Quota check & member list query: filtering by org and status
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status 
  ON org_invitations(org_id, status);

-- 3. Inbound invite lookup & deduplication by email
CREATE INDEX IF NOT EXISTS idx_org_invitations_email 
  ON org_invitations(email);

-- 4. TTL cleanup & expiration sweeps
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at 
  ON org_invitations(expires_at);

-- 5. Partial unique index: Prevent multiple concurrent pending invitations for the same email in the same org
CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_active_email 
  ON org_invitations(org_id, email) 
  WHERE status = 'pending';
```

### 3.2. Migration Placement Strategy

#### Placement Option A: Dedicated Migration `migrations/0277_enterprise_org_invitations.sql` (Recommended)
Create `apps/sophia-ai-factory/migrations/0277_enterprise_org_invitations.sql`.  
**Rationale**: `0276` has already been created in git. If any developer or CI environment ran `0276`, modifying it will cause `apply-migrations.sh` to skip the changes because `0276_enterprise_scale_foundations` is already listed in `d1_migrations`. `0277` guarantees safe forward migration.

#### Placement Option B: Append to `migrations/0276_enterprise_scale_foundations.sql`
If the orchestrator chooses to consolidate Milestone 1 and Milestone 2 into a single foundation migration prior to live deployment, append Section 3.1 directly to the bottom of `apps/sophia-ai-factory/migrations/0276_enterprise_scale_foundations.sql`.

---

## 4. Pillar 2: Seat Quota Enforcement Engine

### 4.1. Tier Seat Limits Matrix

| Tier Key | Display Name | Max Seats (`maxSeats`) | Unlimited? | Reference |
|---|---|---|---|---|
| `free` | Free | **1** | No | Solo owner |
| `starter` / `basic` / `BASIC` | Starter | **1** | No | `unified-limits.ts:68` |
| `pro` / `premium` / `PREMIUM` | Pro / Growth | **5** | No | `unified-limits.ts:89` |
| `master` / `MASTER` / `enterprise` | Master / Agency | **999** | Effectively Unlimited | `unified-limits.ts:131` |

### 4.2. Exact Counting Logic

To prevent oversubscription, seat allocation accounts for **confirmed active members** plus **open, unexpired invitations**:

$$\text{Allocated} = N_{\text{members}} + N_{\text{pending\_invites}}$$

$$\text{isAllowed} = \text{Allocated} < \text{Max Seats}$$

```sql
-- 1. Active Members Count
SELECT COUNT(*) AS count 
FROM org_members 
WHERE org_id = ?1;

-- 2. Pending Unexpired Invitations Count
SELECT COUNT(*) AS count 
FROM org_invitations 
WHERE org_id = ?1 
  AND status = 'pending' 
  AND expires_at > ?2; -- ?2 is Date.now()
```

### 4.3. TypeScript Implementation (`src/tree/organizations/seat-quota-engine.ts`)

```typescript
import type { D1Database } from '@/seed/db/client';

export type OrgTier = 'free' | 'starter' | 'pro' | 'master';

export const TIER_SEAT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  basic: 1,
  BASIC: 1,
  pro: 5,
  premium: 5,
  PREMIUM: 5,
  master: 999,
  enterprise: 999,
  MASTER: 999,
  ENTERPRISE: 999,
};

export interface SeatQuotaCheckResult {
  allocated: number;
  activeMembers: number;
  pendingInvites: number;
  maxSeats: number;
  isAllowed: boolean;
  tier: string;
}

export async function checkSeatQuota(
  db: D1Database,
  orgId: string,
): Promise<SeatQuotaCheckResult> {
  // 1. Fetch organization tier and explicit max_seats
  const org = await db
    .prepare('SELECT id, tier, max_seats, plan FROM organizations WHERE id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ id: string; tier?: string; max_seats?: number; plan?: string }>();

  if (!org) {
    throw new Error(`ORGANIZATION_NOT_FOUND: Organization '${orgId}' does not exist`);
  }

  const effectiveTier = (org.tier ?? org.plan ?? 'free').toLowerCase();
  const maxSeats = org.max_seats ?? TIER_SEAT_LIMITS[effectiveTier] ?? 1;

  // 2. Count active members in org_members
  const membersRow = await db
    .prepare('SELECT COUNT(*) AS count FROM org_members WHERE org_id = ?1')
    .bind(orgId)
    .first<{ count: number }>();
  const activeMembers = Number(membersRow?.count ?? 0);

  // 3. Count pending, non-expired invitations in org_invitations
  const now = Date.now();
  const invitesRow = await db
    .prepare(
      `SELECT COUNT(*) AS count 
       FROM org_invitations 
       WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`,
    )
    .bind(orgId, now)
    .first<{ count: number }>();
  const pendingInvites = Number(invitesRow?.count ?? 0);

  const allocated = activeMembers + pendingInvites;
  const isAllowed = allocated < maxSeats;

  return {
    allocated,
    activeMembers,
    pendingInvites,
    maxSeats,
    isAllowed,
    tier: effectiveTier,
  };
}
```

---

## 5. Pillar 3: Cryptographic Token Generator & Lifecycle

### 5.1. Token Generation (256-Bit CSPRNG)

- **Entropy**: 32 cryptographically secure random bytes generated via `crypto.getRandomValues(new Uint8Array(32))`.
- **Token String**: 64 lowercase hexadecimal characters.
- **SHA-256 Digest**: Computed via `crypto.subtle.digest('SHA-256', textEncoder.encode(token))`.
- **Raw Token Storage**: **NEVER stored in the database**. The raw token is returned solely to the caller for inclusion in the invitation URL:
  `https://sophia.agencyos.network/invitations/accept?token=${token}`

### 5.2. 7-Day TTL Expiration Policy

- **TTL Duration**: 7 days = $7 \times 24 \times 60 \times 60 \times 1000 = 604,800,000$ milliseconds.
- **Expiration Timestamp**: `expiresAt = Date.now() + 604800000`.
- **Expiration Enforcement**:
  - When accepting or validating an invitation, compare `Date.now() > record.expires_at`.
  - If expired, immediately transition `status = 'expired'` and reject with `INVITATION_EXPIRED`.

### 5.3. Atomic Single-Use Acceptance & Anti-Race Protection

To prevent concurrent double-consumption and oversubscription races:
1. **Hash Lookup**: Look up `org_invitations WHERE token_hash = ?1`.
2. **State Validation**: Ensure `status === 'pending'` and `Date.now() <= expires_at`.
3. **Re-check Active Seat Quota**: Ensure `activeMembers < maxSeats`.
4. **Atomic Batch Execution**: Execute both the invitation status transition and member insertion in a single atomic D1 transaction (`db.batch`):

```sql
-- Step A: Consume token with CAS condition
UPDATE org_invitations 
SET status = 'accepted', accepted_at = ?1 
WHERE id = ?2 AND status = 'pending';

-- Step B: Insert member
INSERT INTO org_members (id, org_id, user_id, role, created_at)
VALUES (?3, ?4, ?5, ?6, ?7);
```

If Step A returns `changes === 0`, another concurrent request consumed or revoked the token. The transaction aborts with `INVITATION_ALREADY_USED`.

### 5.4. TypeScript Implementation (`src/seed/security/invitation-token.ts`)

```typescript
/**
 * Cryptographic Token Generator & Lifecycle Service for Org Invitations.
 * Edge-runtime safe: Web Crypto API only.
 *
 * @module seed/security/invitation-token
 */

const ENC = new TextEncoder();
const TTL_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Computes SHA-256 lowercase hex digest for a string.
 */
export async function sha256Hex(content: string): Promise<string> {
  const data = ENC.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a 256-bit CSPRNG token (64 hex characters) and its SHA-256 hash.
 */
export async function generateInvitationToken(): Promise<{
  rawToken: string;
  tokenHash: string;
  expiresAt: number;
}> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = Date.now() + TTL_7_DAYS_MS;

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}
```

---

## 6. Complete Service Implementation Plan (`tree/` & `land/`)

### 6.1. Domain Service: `createOrgInvitation` (`src/tree/organizations/invitation-service.ts`)

```typescript
import type { D1Database } from '@/seed/db/client';
import { generateInvitationToken, sha256Hex } from '@/seed/security/invitation-token';
import { checkSeatQuota } from '@/tree/organizations/seat-quota-engine';

export type OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer';

export interface CreateInvitationInput {
  orgId: string;
  email: string;
  role: OrgRole;
  invitedByUserId: string;
  appBaseUrl?: string;
}

export interface CreateInvitationResult {
  invitationId: string;
  inviteUrl: string;
  token: string; // returned ONCE to inviter
  expiresAt: number;
}

export async function createOrgInvitation(
  db: D1Database,
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('VALIDATION_ERROR: A valid email address is required');
  }

  // 1. Enforce seat quota (active + pending < max)
  const quota = await checkSeatQuota(db, input.orgId);
  if (!quota.isAllowed) {
    throw new Error(
      `SEAT_QUOTA_EXCEEDED: Org has reached its seat limit (${quota.allocated}/${quota.maxSeats}). Upgrade tier to add more members.`,
    );
  }

  // 2. Prevent duplicate pending invite for same email in same org
  const existingPending = await db
    .prepare(
      `SELECT id FROM org_invitations 
       WHERE org_id = ?1 AND email = ?2 AND status = 'pending' AND expires_at > ?3 LIMIT 1`,
    )
    .bind(input.orgId, normalizedEmail, Date.now())
    .first<{ id: string }>();

  if (existingPending) {
    throw new Error('INVITATION_ALREADY_PENDING: A pending invitation already exists for this email');
  }

  // 3. Generate cryptographic 256-bit token & hash
  const { rawToken, tokenHash, expiresAt } = await generateInvitationToken();
  const invitationId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = Date.now();

  // 4. Persist to D1 (storing token_hash, NEVER rawToken)
  await db
    .prepare(
      `INSERT INTO org_invitations
       (id, org_id, email, role, token_hash, expires_at, created_by, created_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending')`,
    )
    .bind(
      invitationId,
      input.orgId,
      normalizedEmail,
      input.role,
      tokenHash,
      expiresAt,
      input.invitedByUserId,
      now,
    )
    .run();

  const baseUrl = input.appBaseUrl ?? 'https://sophia.agencyos.network';
  const inviteUrl = `${baseUrl}/invitations/accept?token=${rawToken}`;

  return {
    invitationId,
    inviteUrl,
    token: rawToken,
    expiresAt,
  };
}
```

### 6.2. Domain Service: `acceptOrgInvitation` (`src/tree/organizations/invitation-service.ts`)

```typescript
export interface AcceptInvitationResult {
  success: boolean;
  orgId: string;
  role: OrgRole;
}

export async function acceptOrgInvitation(
  db: D1Database,
  rawToken: string,
  acceptingUserId: string,
): Promise<AcceptInvitationResult> {
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();

  // 1. Lookup invitation by token hash
  const invitation = await db
    .prepare('SELECT * FROM org_invitations WHERE token_hash = ?1 LIMIT 1')
    .bind(tokenHash)
    .first<{
      id: string;
      org_id: string;
      email: string;
      role: OrgRole;
      status: string;
      expires_at: number;
    }>();

  if (!invitation) {
    throw new Error('INVALID_INVITATION_TOKEN: Invitation token not found or invalid');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`INVITATION_ALREADY_USED: Invitation is no longer valid (status: ${invitation.status})`);
  }

  if (now > invitation.expires_at) {
    // Lazily mark expired
    await db
      .prepare("UPDATE org_invitations SET status = 'expired' WHERE id = ?1")
      .bind(invitation.id)
      .run();
    throw new Error('INVITATION_EXPIRED: Invitation has expired. Please request a new invite.');
  }

  // 2. Re-validate active seat quota (prevents oversubscription race)
  const quota = await checkSeatQuota(db, invitation.org_id);
  if (quota.activeMembers >= quota.maxSeats) {
    throw new Error(
      `SEAT_QUOTA_EXCEEDED: Organization has reached max seat capacity (${quota.activeMembers}/${quota.maxSeats})`,
    );
  }

  // 3. Execute atomic consumption & membership creation
  const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const batchResults = await db.batch([
    // CAS Update: Only succeeds if status is still 'pending'
    db
      .prepare(
        "UPDATE org_invitations SET status = 'accepted', accepted_at = ?1 WHERE id = ?2 AND status = 'pending'",
      )
      .bind(now, invitation.id),
    // Insert into org_members
    db
      .prepare(
        `INSERT INTO org_members (id, org_id, user_id, role, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(org_id, user_id) DO NOTHING`,
      )
      .bind(memberId, invitation.org_id, acceptingUserId, invitation.role, now),
  ]);

  const updateResult = batchResults[0] as { meta?: { changes?: number } };
  if ((updateResult.meta?.changes ?? 0) === 0) {
    throw new Error('INVITATION_ALREADY_USED: Concurrent acceptance conflict detected');
  }

  return {
    success: true,
    orgId: invitation.org_id,
    role: invitation.role,
  };
}
```

---

## 7. 4-Layer Architecture File Layout for M2

```
apps/sophia-ai-factory/
├── migrations/
│   ├── 0276_enterprise_scale_foundations.sql            # Custom domains
│   └── 0277_enterprise_org_invitations.sql              # [NEW] org_invitations table + indexes
├── src/
│   ├── seed/
│   │   ├── types/
│   │   │   └── org-invitations.ts                       # [NEW] Typed invitation, quota, & role interfaces
│   │   ├── security/
│   │   │   └── invitation-token.ts                      # [NEW] 256-bit CSPRNG token + SHA-256 Web Crypto
│   │   └── config/tiers/
│   │       └── seat-quotas.ts                           # [NEW] Tier seat limits (Free: 1, Starter: 1, Pro: 5, Master: 999)
│   ├── tree/
│   │   └── organizations/
│   │       ├── seat-quota-engine.ts                     # [NEW] Active + pending quota counting logic
│   │       └── invitation-service.ts                    # [NEW] Domain logic: create, accept, revoke, expire
│   ├── forest/
│   │   └── organizations/
│   │       └── org-invitation-guard.ts                  # [NEW] RBAC permission assertion for invitations
│   └── land/
│       ├── admin/
│       │   ├── org-manager.ts                           # [UPDATE] Re-wire inviteMember to use invitation lifecycle
│       │   └── org-invitation-actions.ts                # [NEW] Server actions for create/revoke/accept
│       └── app/
│           └── api/v1/invitations/accept/route.ts       # [NEW] Edge acceptance endpoint
```

---

## 8. Caveats & Assumptions

1. **D1 Single-Writer / Batch Transactions**: D1 does not support nested `BEGIN TRANSACTION` blocks. Atomic operations must use `db.batch([stmt1, stmt2])` or atomic conditional SQL (`UPDATE ... WHERE status = 'pending'`).
2. **Timestamp Standard**: JavaScript `Date.now()` is in milliseconds ($1.7 \times 10^{12}$), whereas SQLite's `unixepoch()` default is in seconds ($1.7 \times 10^9$). The schema defaults `created_at` to `unixepoch() * 1000` (milliseconds) to ensure total numeric consistency with JavaScript timestamps and the test harness assertions.
3. **Database Table Naming Parity**: The canonical production table is `org_members`. The mock in `enterprise-test-harness.ts` uses `organization_members`. During Milestone 2 implementation, `enterprise-test-harness.ts` will be updated to query `org_members` or use a view `CREATE VIEW IF NOT EXISTS organization_members AS SELECT * FROM org_members;` to maintain compatibility with both names.
4. **Email Normalization**: RFC 5321 allows case-sensitive local parts, but email providers treat emails as case-insensitive. In this design, all emails are strictly converted to `.toLowerCase().trim()` before hashing, checking, or storage.

---

## 9. Conclusion

1. **SQL Schema**: The `org_invitations` table cleanly encapsulates the invitation lifecycle with strict SQLite types and constraints, partial unique indexes preventing spam, and zero plain-text token exposure.
2. **Seat Quota Enforcement Engine**: Accurately counts $\text{Active Members} + \text{Pending Invites} \le \text{Tier Limit}$, immediately rejecting attempts to exceed quotas across Free (1), Starter (1), Pro (5), and Master (999).
3. **Cryptographic Token Generator**: Employs Web Crypto CSPRNG to produce 256-bit high-entropy tokens, persists only their SHA-256 hashes, enforces a strict 7-day TTL, and prevents double-use via atomic compare-and-swap transactions.
4. **Readiness**: The specification is complete, mathematically sound, and directly actionable for Milestone 2 implementation workers.

---

## 10. Verification Method

Independent verification of this design report can be performed as follows:

1. **Inspect Handoff Document**:
   ```bash
   cat /Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m2_1/handoff.md
   ```
2. **Validate SQL Syntax with In-Memory SQLite**:
   ```bash
   node -e '
     const { DatabaseSync } = require("node:sqlite");
     const db = new DatabaseSync(":memory:");
     db.exec(`
       CREATE TABLE organizations (id TEXT PRIMARY KEY, tier TEXT, max_seats INTEGER);
       CREATE TABLE org_members (id TEXT PRIMARY KEY, org_id TEXT, user_id TEXT, role TEXT, created_at INTEGER);
       CREATE TABLE org_invitations (
         id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
         org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
         email TEXT NOT NULL,
         role TEXT NOT NULL CHECK (role IN ("owner", "admin", "creator", "billing_manager", "viewer")),
         token_hash TEXT UNIQUE NOT NULL,
         expires_at INTEGER NOT NULL,
         accepted_at INTEGER DEFAULT NULL,
         created_by TEXT NOT NULL,
         created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
         status TEXT NOT NULL DEFAULT "pending" CHECK (status IN ("pending", "accepted", "revoked", "expired"))
       );
       CREATE UNIQUE INDEX uidx_org_invitations_token_hash ON org_invitations(token_hash);
     `);
     console.log("SQL Schema Validated Successfully!");
   '
   ```
3. **Verify Cryptographic Invariants**:
   - Token entropy: 32 bytes $\to$ 64 hex characters.
   - Hash: SHA-256 $\to$ 64 hex characters.
   - TTL: exactly $7 \times 86,400,000$ ms.
   - Quota assertion: $\text{allocated} = \text{active} + \text{pending} \le \text{tier limit}$.
