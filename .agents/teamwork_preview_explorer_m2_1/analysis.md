# Milestone 2 Technical Analysis: D1 Schema, Seat Quotas & Cryptographic Token Lifecycle

**Author:** teamwork_preview_explorer_m2_1  
**Target:** Milestone 2: Multi-User Organizations & Invitations  
**Date:** 2026-09-20  

---

## 1. D1 Schema Analysis (`org_invitations`)

### 1.1 Context & Background
The Sophia AI Factory database operates on Cloudflare D1 (SQLite engine at the edge). Prior to Milestone 2, the organization membership table was `org_members` (created in `0001-init.sql`), and member invitations were performed via a synchronous server action in `src/land/admin/org-manager.ts` that required invitees to already exist in `users`.

Milestone 2 introduces asynchronous, cryptographic single-use invitations. This requires a dedicated table `org_invitations`.

### 1.2 Schema Definition
```sql
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

CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_token_hash ON org_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status ON org_invitations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON org_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON org_invitations(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_org_invitations_active_email ON org_invitations(org_id, email) WHERE status = 'pending';
```

### 1.3 Key Architectural Choices
1. **Hash Storage**: `token_hash` stores the SHA-256 hex digest of the raw token. The raw token is never persisted in D1.
2. **Virtual Column `invited_by`**: SQLite 3.31+ supports virtual generated columns. Mapping `invited_by GENERATED ALWAYS AS (created_by) VIRTUAL` guarantees 100% backwards compatibility with tests and callers expecting `invited_by` while honoring the prompt's `created_by` specification.
3. **Partial Unique Index**: `uidx_org_invitations_active_email` prevents creating multiple active pending invitations for the same email within the same organization.
4. **Millisecond Epoch**: Timestamps (`expires_at`, `created_at`, `accepted_at`) use millisecond precision, matching JavaScript `Date.now()` and Vitest E2E assertions.

---

## 2. Seat Quota Enforcement Engine Analysis

### 2.1 Subscription Tier Limits
The subscription tiers and their corresponding maximum seat capacities are:
- `free`: 1 seat
- `starter` / `basic` / `BASIC`: 1 seat
- `pro` / `premium` / `PREMIUM`: 5 seats
- `master` / `enterprise` / `MASTER`: 999 seats (unlimited agency seats)

### 2.2 Quota Accounting Equation
$$\text{Allocated Seats} = \text{Active Members} + \text{Pending Unexpired Invitations}$$

$$\text{Active Members} = |\text{org\_members WHERE org\_id = ?}|$$

$$\text{Pending Invitations} = |\text{org\_invitations WHERE org\_id = ? AND status = 'pending' AND expires\_at > now()}|$$

$$\text{isAllowed} = \text{Allocated Seats} < \text{Max Seats}$$

### 2.3 Race Condition Mitigation
When multiple invitations are accepted concurrently, checking the seat limit only at invitation time is insufficient. The acceptance handler must perform a secondary atomic seat check before committing member insertion.

---

## 3. Cryptographic Token Generator Analysis

### 3.1 CSPRNG Entropy
- Source: Web Crypto `crypto.getRandomValues(new Uint8Array(32))`.
- Size: 32 bytes = 256 bits of entropy.
- Representation: 64 lowercase hexadecimal characters.
- Infeasible to brute-force ($2^{256} \approx 1.15 \times 10^{77}$ combinations).

### 3.2 7-Day TTL Lifecycle
- TTL window: 7 days ($604,800,000$ ms).
- Token status progression:
  - Initial: `'pending'`
  - On acceptance: `'accepted'`
  - On manual revocation: `'revoked'`
  - Past TTL: `'expired'` (checked dynamically on access and persisted on failed validation).

### 3.3 Atomic Consumption (Compare-And-Swap)
- Query:
  ```sql
  UPDATE org_invitations 
  SET status = 'accepted', accepted_at = ?1 
  WHERE token_hash = ?2 AND status = 'pending';
  ```
- If `meta.changes === 0`, token is either invalid, already used, or revoked. The operation fails with `INVITATION_ALREADY_USED`.
- Paired with `INSERT INTO org_members` within a single D1 batch transaction.
