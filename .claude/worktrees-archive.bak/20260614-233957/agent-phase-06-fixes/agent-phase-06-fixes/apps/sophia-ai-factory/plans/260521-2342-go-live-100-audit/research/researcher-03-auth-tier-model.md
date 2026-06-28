# R3 — Auth + Tier Model (Single Source)

**Researcher:** Phase 01 R3 (parallel agent)  
**Context:** `plans/260521-2342-go-live-100-audit/phase-01-codebase-intelligence.md`  
**Output path:** `research/researcher-03-auth-tier-model.md`  

## Auth Flow Diagram (Text)

```
Request → middleware.ts (Next.js edge)
  ├─ CSRF check + CSP nonce + cookies
  ├─ Better Auth session resolve via getAuth() + headers
  │   └─ `better-auth-server.ts` (seed): lazy D1 init, 7-day expiry
  └─ Dashboard paths: enforce session (else /login)
      └─ If /dashboard/admin/*: load D1 tier inline (tier lookup)
         └─ Compare against MASTER threshold → allow/deny

Response ← Server Component / Server Action
  └─ getCurrentUser() → User { id, email, full_name, avatar_url, role }
  └─ getUserTier(userId) → 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' ⬅️ Tier enum
      └─ Queries D1 subscriptions table: prefer `tier` col (uppercase), fallback to `plan` col
```

**Session storage:** Better Auth cookies (httpOnly, sameSite=lax, 7-day max).  
**Tenant resolution:** User → org_members table → org_id. Free tier (100-user pilot) has no org.

---

## Tenant Resolution Chain

| Step | Query | Result | Notes |
|---|---|---|---|
| 1 | User authenticates via email/password or OAuth | `session.user.id` | Better Auth session set on device |
| 2 | `getTenantContext(userId)` → `org_members` LEFT JOIN `subscriptions` | `{ orgId, tier }` | Returns org-scoped tier + org_id in one query; falls back to null if no org |
| 3 | `middleware.ts` reads tier from D1 for `/admin/*` paths | `tier: 'MASTER'` | Inline query avoids seed-layer D1 lookup which silently defaults to BASIC at edge |
| 4 | `@/dashboard/admin/[page]/page.tsx` calls `requireMasterTier()` | User redirected if not MASTER | Defense-in-depth: middleware + page-level gate |

**Free pilot:** org_id null; subscriptions row created after NOWPayments IPN fires; until then, tier defaults to BASIC.

---

## Tier Matrix (Pricing + Features)

| Tier | Price/mo | Channels | Templates | API Access | Admin UI | Monthly Calls | Status |
|---|---:|---:|---:|---|---|---:|---|
| BASIC | $0 | 3 | 5 | ❌ | ❌ | — | Free tier (Pilot phase) |
| PREMIUM | $299 | 5 | 10 | ✅ | ❌ | — | Recommended (Growth) |
| ENTERPRISE | $999 | 20 | 50 | ✅ | ✅ | ✅ | Advanced |
| MASTER | N/A | unlimited | unlimited | ✅ | ✅ | ✅ | Operator only (admin gates) |

**Source:** `src/seed/config/tiers/tier-configs.ts:19–80`.  
**Feature flags:** `enable_api_integrations` (PREMIUM+), `enable_admin_dashboard` (ENTERPRISE+).  
**Tier enum canonical values:** uppercase only (`BASIC | PREMIUM | ENTERPRISE | MASTER`).  
**NOWPayments invoice IDs:** static, pre-created in dashboard (no runtime client needed).

---

## Single-Source Tier Config (`@/seed/config/tiers`)

**Barrel structure:**
- `tier-configs.ts` → `TIER_CONFIGS`, `TIER_CONFIG`, `DB_TIER_MAPPING`, `TIER_DB_MAPPING`
- `unified-limits.ts` → `UNIFIED_TIERS`, `getMcuMonthlyLimit()`
- `video-quota-tiers.ts` → `VIDEO_TIER_CONFIG` (RaaS-specific quotas)

**DB tier mapping:**  
- DB storage: lowercase aliases (`'master'`, `'pro'`) OR uppercase enum (`'MASTER'`, `'PREMIUM'`)
- Normalization: `normalizePlanToTier()` handles both, always returns uppercase enum
- Fallback: unknown tier → `'BASIC' as Tier`

**Canonical import:**
```ts
import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'
// Or for limits:
import { getUserTier } from '@/seed/db/get-user-tier'
```

---

## BYOK Encryption Story (At Rest)

**Location:** `src/tree/byok/` (tree layer — domain reusable primitives).

**Flow:**  
1. **Setup Wizard** collects plaintext API key (OpenRouter, ElevenLabs, D-ID)
2. **`setUserApiKey(userId, provider, plainKey)`** encrypts via AES-GCM-256 + random IV
3. **D1 `user_api_keys` table** stores: `[IV (12 bytes)][ciphertext + auth tag]`
4. **Read path:** `getUserApiKey()` decrypts on demand; returns plaintext to caller (which immediately uses it)
5. **Tamper detection:** AES-GCM auth tag fails if any byte flipped → throws

**Master key:** `BYOK_MASTER_KEY` env (base64-encoded 32 bytes). Generated once, stored in CF Workers secrets.  
**Attack surface:** Key leakage = all encrypted keys compromised. Mitigation: CF secret rotation policy.  
**Scope:** Operators do NOT manage third-party credentials (per no-tech doctrine). Customers supply their own via UI.

---

## Permission Enforcement Pattern

**Operator routes** (`/dashboard/admin/*`):
- Middleware checks: `tier === 'MASTER'` (file:line `middleware.ts:145–173`)
- Page-level check: `requireMasterTier()` redirects to `/dashboard?error=admin_required` (file:line `require-master-tier.ts:37–54`)

**Customer routes** (`/dashboard`, `/api/campaigns`, etc.):
- Session required (middleware enforces)
- Tier-gated features checked at component render time via `tierHasFeature(tier, flag)`
- No RBAC roles beyond tier enum; permission = tier threshold

**Tenant isolation** (RaaS gateway):
- `validateTenantIsolation()` extracts `agency_id` from request (query, header, or body)
- `validateResourceAccess(agencyId, resourceType, resourceId)` queries D1 for ownership
- Cross-tenant access blocked → 403 Forbidden + audit log (file:line `tenant-isolation.ts:38–104`)

---

## Known Auth Gaps + Open Questions

| Gap | Impact | Status |
|---|---|---|
| **D1 tier lookup at edge middleware fails silently** | MASTER users locked out of admin pages at CF edge; page-level `requireMasterTier()` rescues them (defense-in-depth) | Mitigated; async D1 unavailable at edge runtime |
| **MFA re-challenge loop** | User in `/auth/mfa-challenge` can loop if session cleared mid-flow | Session state tracked in `session_mfa_pending` table; only allow mfa-challenge paths until verified |
| **OAuth callback state storage** | Session fixation risk if state token not validated | `oauth-state-store.ts` (KV) validates state per OAuth provider; tied to user.id |
| **JWT nonce replay (Telegram bot)** | Bot requests must include nonce from user auth header; repeated nonce rejected | `jwt-nonce-tracker.ts` + `jwt-nonce-storage.ts` (KV) prevent replay |

**No known cross-tenant data leakage.** Tenant isolation middleware blocks at API boundary; D1 queries filtered by `org_id` / `user_id` in all land-layer endpoints (spot-checked payouts, affiliates, campaigns).

**Unresolved:** Is `enriched-jwt.ts` (customer-facing JWT for RaaS callers) still in use, or replaced by NOWPayments IPN? (Phase 2+ to reconcile.)

---

**Status:** ✅ DONE  
**Findings:** Tier model is unified + consistent. Auth flow is edge-safe (middleware defers D1 tier check). BYOK at rest is encrypted; in-flight keys handled by customer via Setup Wizard (no operator-side credential required per doctrine).
