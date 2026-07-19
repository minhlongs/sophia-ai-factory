# IAM Controls Documentation — Sophia AI Factory

> **Last updated:** 2026-07-05
> **Audience:** SOC 2 auditors, security reviewers
> **Scope:** Identity and Access Management controls across the Sophia AI Factory platform

---

## 1. Authentication

### 1.1 Primary Authentication — Better Auth v1.6.14

| Property | Value |
|----------|-------|
| **Library** | Better Auth (better-auth) v1.6.14 |
| **Protocol** | Email + password with cookie-based sessions |
| **Password hashing** | bcrypt (12 rounds, via Better Auth default) |
| **Session storage** | Signed cookies, validated on every request |
| **Session expiry** | 7 days (configurable) |
| **Rate limiting** | Login endpoint rate-limited (5 attempts per minute per IP, implemented via middleware) |
| **MFA** | TOTP available via Better Auth but not yet enabled for all users |
| **OAuth providers** | Social OAuth integration available via Better Auth provider config |

### 1.2 Session Validation Flow

```
Request → Middleware (src/middleware.ts)
  → Extract session cookie
  → Validate signature + expiry
  → Attach user context (or redirect to login)
  → Route handler uses getCurrentUser() for user identity
```

**Source:** `src/middleware.ts` (auth guard middleware), `src/seed/auth/better-auth-session.ts` (session extraction)

### 1.3 SSO / Enterprise Authentication

- **Status:** UI scaffolded. SAML 2.0 / OIDC adapter not yet integrated.
- **Page:** `/dashboard/admin/sso` (MASTER-tier only)
- **Planned integration:** Better Auth supports social OAuth providers; SAML adapter requires additional library.
- **Current config:** OIDC provider metadata (URL, client ID, client secret) — UI only, no active auth integration.

---

## 2. Authorization — RBAC

### 2.1 Tier-Based Access (Platform-Level)

| Tier | Access Level | Description |
|------|-------------|-------------|
| BASIC | Standard user | Can create campaigns, generate videos, use AI commands |
| PREMIUM | Enhanced user | Higher quotas, priority support, early features |
| ENTERPRISE | Business user | Team management, custom integrations, API access |
| MASTER | Platform operator | Full admin access — billing, org management, audit log, all admin routes |

**Enforcement:** `getUserTier()` in `src/seed/db/get-user-tier.ts` + `requireMasterTier()` in `src/seed/auth/require-master-tier.ts`

### 2.2 Role-Based Access Control (Org-Level)

| Role | Permissions | Description |
|------|-------------|-------------|
| owner | All permissions | Full control: org settings, billing, branding, members, SOPs, API keys |
| admin | Most permissions | No billing/settings changes: branding, members, SOPs, analytics |
| member | SOP + analytics | Create and publish SOPs, view analytics, view members |
| viewer | Read-only | Install SOPs, view analytics, view members |

**Permission check chain:**

```typescript
import { hasPermission } from '@/seed/auth/rbac';
import { getMemberRole } from '@/seed/db/org-membership-ext';

// Usage:
const canManageBranding = hasPermission('admin', 'org:branding'); // true
const canManageBrandingForViewer = hasPermission('viewer', 'org:branding'); // false
```

**Source:** `src/seed/auth/rbac.ts` (permission matrix), `src/seed/db/org-membership-ext.ts` (org member role queries)

### 2.3 Org Permission Matrix (Detailed)

| Permission | owner | admin | member | viewer |
|-----------|-------|-------|--------|--------|
| org:manage (settings, billing) | Yes | No | No | No |
| org:invite (members) | Yes | Yes | No | No |
| org:branding (white-label) | Yes | Yes | No | No |
| sop:create | Yes | Yes | Yes | No |
| sop:publish | Yes | Yes | Yes | No |
| sop:install | Yes | Yes | Yes | Yes |
| api:manage | Yes | No | No | No |
| billing:view | Yes | Yes | No | No |
| analytics:view | Yes | Yes | Yes | Yes |
| members:view | Yes | Yes | Yes | Yes |

### 2.4 Server Action Authorization Pattern

All data-mutating Server Actions use a standard pattern:

```typescript
'use server';

export async function sensitiveAction() {
  // 1. Authentication check
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHORIZED', ... });

  // 2. Permission check (for org-level actions)
  const canAct = await checkOrgPermission(db, orgId, user.id, 'org:branding');
  if (!canAct.ok || !canAct.value) return failure({ code: 'FORBIDDEN', ... });

  // 3. Perform action (validated, logged)
  // ...
}
```

---

## 3. Access Control — Route Gating

### 3.1 Route Protection Matrix

| Route Pattern | Gate | Enforcement |
|--------------|------|-------------|
| `/dashboard/admin/*` | `requireMasterTier()` | Layout-level + page-level (defense in depth) |
| `/dashboard/settings` | User session required | Middleware auth guard |
| `/dashboard/*` | User session required | Middleware auth guard |
| `/api/cron/*` | `CRON_SECRET` header | Server-side header validation |
| `/api/webhook/*` | Provider signature | Signature verification per provider |
| `/api/version`, `/api/health` | Public | No auth required |

### 3.2 Master Tier Gate Implementation

**Component-level:** `src/seed/auth/require-master-tier.ts`
```typescript
export async function requireMasterTier(opts = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/vi/login');
  const tier = await resolveUserTier(user.id);
  if (tier !== 'MASTER') redirect('/dashboard?error=admin_required');
  return user;
}
```

**Admin layout gate:** `src/app/[locale]/dashboard/admin/layout.tsx`
- Runs `requireMasterTier()` before layout renders
- Prevents UI flash for non-MASTER users

---

## 4. Session Management

| Property | Implementation |
|----------|---------------|
| Cookie name | `better-auth.session` (configurable) |
| Cookie flags | HTTP-only, Secure, SameSite=Lax |
| Session data | User ID, creation timestamp, expiry timestamp |
| Validation | Every request via middleware — signature + expiry check |
| Logout | Session cookie cleared, client-side redirect |
| Concurrent sessions | Supported (multiple tabs/devices) |

**Source:** Better Auth configuration in `src/seed/auth/`

---

## 5. API Key Management

| Property | Implementation |
|----------|---------------|
| Key generation | 64-byte random (crypto.randomBytes) |
| Key storage | SHA-256 hash (raw keys never stored) |
| Key prefix | `sophia_` (identifiable in logs) |
| Database | D1 table `api_keys` (hash, user_id, expiry, status) |
| Rate limiting | Per-key rate limiter in middleware |
| Key expiry | Configurable (default 90 days) |
| Rotation support | `/dashboard/admin/byok-rotation` page |

**Source:** `src/tree/byok/` (BYOK key management), `src/seed/db/api-keys/` (key storage)

---

## 6. Data Segregation

| Concern | Implementation |
|---------|---------------|
| User data isolation | Row-level by `user_id` in all queries |
| Org data isolation | Row-level by `org_id` in all queries |
| Multi-tenant DB | Single D1 database with tenant-aware queries |
| Encryption at rest | Cloudflare D1 default AES-256 |
| Encryption in transit | TLS 1.3 via Cloudflare edge |

---

## 7. IAM Controls Gap Analysis

### Satisfied Controls

- [x] Authentication required for all user-facing routes
- [x] Role-based authorization (4 roles)
- [x] Tier-based access gating
- [x] Session-based auth with secure cookie flags
- [x] API key hashing and rotation support
- [x] Org-level permission model
- [x] Admin route protection with defense-in-depth

### Partially Satisfied Controls

- [~] MFA enrollment — TOTP available but not enforced
- [~] Audit logging — Admin actions logged, user data access not
- [~] Password policy — Relies on Better Auth defaults, no custom complexity rules

### Not Yet Implemented

- [ ] SSO / SAML 2.0 authentication (UI scaffolded)
- [ ] Concurrent session limiting
- [ ] Automated user access review workflow
- [ ] Inactive session timeout
- [ ] Geofencing / IP allowlisting

---

## 8. Remediation Roadmap

| Item | Priority | Effort | Target |
|------|----------|--------|--------|
| Enforce MFA for MASTER-tier accounts | High | M | Q3 2026 |
| Document password policy requirements | Medium | L | Q3 2026 |
| Implement SSO adapter (SAML/OIDC) | Medium | H | Q4 2026 |
| Add inactive session timeout | Low | M | Q4 2026 |
| Access review reporting tool | Low | M | Q1 2027 |

---

*End of document*
