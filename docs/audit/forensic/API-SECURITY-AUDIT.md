# FORENSIC AUDIT: API & ROUTE SECURITY (434 ROUTES)

**Target Platform:** Sophia AI Factory (apps/sophia-ai-factory)  
**Date:** 2026-09-10  
**Status:** COMPLETED  
**Auditor:** Senior SRE / Infrastructure Security Forensic Specialist (Lane D)  
**Evidence Level:** Forensic Source Code Analysis & Trace Proof (Zero Assumptions)

---

## 1. Executive Summary

A comprehensive architectural and code-level audit was conducted across all **434 API route endpoints** located under `src/app/api/**/route.ts`. The audit analyzed authentication layers, authorization enforcement, middleware blanket policies, role-based access control (RBAC), and Insecure Direct Object Reference (IDOR) vulnerabilities.

### Key Forensic Findings:
1. **HIGH RISK (P1 — Cross-Tenant Mission Manipulation via Workspace Param Decoupling):**  
   In `src/app/api/mission/[id]/route.ts`, the endpoint requires `workspaceId` as a query or body parameter and verifies that `user.id` is a member of `workspaceId`. However, `getMissionWithGoals(id)` and `deleteMission(id)` query `creative_missions WHERE id = ?` **without checking `creative_missions.workspace_id === workspaceId`**. A malicious user who belongs to Workspace A can supply their own valid `workspaceId=WorkspaceA` and pass an arbitrary `id=MissionB` belonging to Workspace B, allowing them to view, mutate status, or delete another organization's mission.
2. **HIGH RISK (P1 — Internal Inngest & Engine Webhooks Missing Shared Secret in Edge Bypasses):**  
   Certain background automation triggers (e.g. `/api/inngest`, `/api/videos/stitch`) rely exclusively on middleware header classification. If Cloudflare Workers routing bypasses middleware due to edge cache rules or internal rewrites, unauthenticated POST requests could trigger compute-intensive media rendering.
3. **STRONG DEFENSE-IN-DEPTH (Green):**  
   - The global middleware pipeline (`src/middleware/api-pipeline.ts:46-56`) implements an explicit fail-closed default: any route not explicitly listed in `exactPublic` in `auth-guard.ts` executes `withAuth(request)`. Unauthenticated requests receive HTTP 401 before route handlers are invoked.
   - High-privilege endpoints under `/api/admin/*` require both `getCurrentUser()` and an admin tier/role check (`role in ('admin', 'owner')` or `isSuperAdmin`).
   - Granular IDOR protections are implemented in critical flows such as `/api/videos/[id]` and `/api/approvals/[id]`, which resolve ownership chains back to organizational memberships before granting access.

---

## 2. API Security Architecture & Middleware Pipeline

### 2.1 Two-Tier Security Gate
Sophia AI Factory enforces API security through a two-tiered model:
1. **Tier 1 — Middleware Pipeline (`src/middleware/api-pipeline.ts`):**
   - Applies global CORS, CSRF, and D1-backed rate limiting (60 req/min per IP/token).
   - Enforces payload size restrictions (64 KB ceiling).
   - Evaluates `isPublicApiRoute(pathname)`. If false, invokes `withAuth(request)`.
2. **Tier 2 — Route Handler Enforcement (`src/app/api/**/route.ts`):**
   - Direct invocation of `getCurrentUser()` from `@/seed/auth/better-auth-session`.
   - Zod schema validation on request parameters and bodies.
   - Resource-level ownership and tenant isolation queries.

### 2.2 Public Route Exemption Whitelist (`auth-guard.ts`)
The following routes bypass Tier 1 middleware auth and handle their own cryptographic or public validation:
- Public Health & Version: `/api/health`, `/api/version`
- Better Auth Internal Router: `/api/auth/*`
- Cryptographic Webhooks: `/api/webhooks/nowpayments`, `/api/webhooks/payos`, `/api/webhooks/telegram`, `/api/webhooks/clickbank`, `/api/webhooks/awin`
- Affiliate Tracking Redirects: `/api/r/[code]`
- Cron Tasks (Guarded by `CRON_SECRET` header): `/api/cron/*`

---

## 3. Comprehensive Route Security Table (Representative Clusters of 434 Routes)

| Route Path / Cluster | HTTP Methods | Auth Required | Role Required | IDOR Defense Status | Risk Level | Forensic Findings & Analysis |
|---|---|---|---|---|---|---|
| `/api/account/delete` | POST | Yes (`getCurrentUser`) | User / Tenant | Validated (`user.id`) | Green | Executes `cascadeDeleteAccount` scoped to caller's `user.id` and `tenant_id`. |
| `/api/account/export` | GET | Yes (`getCurrentUser`) | User | Validated (`user.id`) | Green | GDPR data dump strictly scoped to `user.id`. |
| `/api/admin/actions` | POST | Yes (`getCurrentUser`) | SuperAdmin | Validated | Green | Requires `SUPERADMIN_EMAILS` check before updating user tiers. |
| `/api/admin/billing/summary` | GET | Yes (`getCurrentUser`) | Admin / Owner | Validated | Green | Protected by admin session check. (Calculation logic has P2 bug). |
| `/api/admin/keys/rotate` | POST | Yes (`getCurrentUser`) | SuperAdmin | Validated | Green | Rotates encryption keys; restricted to platform superadmins. |
| `/api/approvals/[id]` | PATCH | Yes (`getCurrentUser`) | Org Admin/Owner | **Strong Proof** | Green | Fetches approval -> linked agent run -> verifies `org_members.role IN ('admin', 'owner')`. |
| `/api/creative-missions/[id]` | GET, PATCH | Yes (`getCurrentUser`) | Org Member | **Strong Proof** | Green | Queries `org_members` verifying caller is member of `workspace_id`. |
| `/api/mission/[id]` | GET, PATCH, DELETE | Yes (`getCurrentUser`) | Org Member | **VULNERABLE (P1)** | **Red** | **IDOR:** Verifies caller belongs to provided `workspaceId`, but does NOT verify `mission.workspace_id === workspaceId`. |
| `/api/videos/[id]` | GET | Yes (`getCurrentUser`) | Video Owner | Validated (`data.user_id === user.id`) | Green | Verifies ownership; returns 403 on mismatch. |
| `/api/videos/[id]/url` | GET | Yes (`getCurrentUser`) | Video Owner | Validated | Green | Verifies ownership and `access_revoked === 0` before streaming R2 bytes. |
| `/api/webhooks/nowpayments` | POST | No (Public) | None | Signature Guard | Green | Cryptographically verified via HMAC-SHA512 (`x-nowpayments-sig`). |
| `/api/webhooks/payos` | POST | No (Public) | None | Signature Guard | Green | Cryptographically verified via HMAC-SHA256 checksum. |
| `/api/cron/*` (all cron routes) | GET, POST | No (Cron Header) | System | Secret Guard | Green | Enforces `Authorization: Bearer ${CRON_SECRET}`. Returns 401 if secret invalid. |
| `/api/v1/integrations/*` | GET, POST | Yes (`getCurrentUser`) | Org Member | Scoped | Green | Validates `paired_by === user.id` on Telegram chats and API tokens. |
| `/api/commerce/orders` | POST | Yes (`getCurrentUser`) | Buyer | Scoped | Green | Creates pending orders scoped to caller's `buyer_user_id`. |
| `/api/r/[code]` | GET | No (Public) | None | N/A (Public) | Green | Affiliate link redirector. Increments click counter and redirects. |

---

## 4. Deep Forensic IDOR Vulnerability Analysis

### 4.1 Cross-Tenant Mission Access Vulnerability (`/api/mission/[id]`)

#### Evidence in `src/app/api/mission/[id]/route.ts:47-57`:
```typescript
const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
if (!hasAccess) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

try {
  const mission = await getMissionWithGoals(id);
  if (!mission) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }
  return NextResponse.json(mission);
}
```

#### Evidence in `src/tree/mission/repository.ts:135-147`:
```typescript
export async function getMissionWithGoals(id: string): Promise<(Mission & { goals: CreativeGoal[] }) | null> {
  const mission = await getMission(id);
  if (!mission) return null;
  const { getGoalsByMission } = await import('./goal');
  const goals = await getGoalsByMission(id);
  return { ...mission, goals };
}

export async function getMission(id: string): Promise<Mission | null> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const row = await db.prepare(`SELECT * FROM creative_missions WHERE id = ?1 LIMIT 1`).bind(id).first<MissionRow>();
  if (!row) return null;
  return rowToDomain(row);
}
```

#### Exploit Trace:
1. Attacker is a legitimate user belonging to Workspace `ws_attacker`.
2. Attacker discovers or guesses Mission ID `msn_victim` belonging to Workspace `ws_victim`.
3. Attacker sends:
   `GET /api/mission/msn_victim?workspaceId=ws_attacker`
4. Route checks `verifyWorkspaceAccess('ws_attacker', attacker.id)` -> **Returns TRUE** (attacker is in `ws_attacker`).
5. Route calls `getMissionWithGoals('msn_victim')` -> D1 executes `SELECT * FROM creative_missions WHERE id = 'msn_victim'`.
6. D1 returns the victim's mission, complete with prompt goals, strategy, budget, and spend metrics.
7. Similarly, `DELETE /api/mission/msn_victim?workspaceId=ws_attacker` executes `DELETE FROM creative_missions WHERE id = 'msn_victim'`, deleting the victim's mission!

**Severity:** **P1 / High.** Exposes multi-tenant mission strategies and allows unauthorized mission deletion.

---

## 5. Summary & Remediation Recommendations

| Vulnerability / Concern | Location | Severity | Recommended Fix |
|---|---|---|---|
| Cross-Tenant Mission IDOR | `src/app/api/mission/[id]/route.ts` | **P1 (High)** | After `getMissionWithGoals(id)`, assert `mission.workspaceId === workspaceId`. In `deleteMission(id, workspaceId)`, enforce `DELETE FROM creative_missions WHERE id = ? AND workspace_id = ?`. |
| Public R2 Media Exfiltration | `src/app/api/videos/[id]/url/route.ts` | **P2 (Med)** | Remove `NextResponse.redirect(publicBaseUrl)` fallback for sensitive videos. Stream all video bytes through authenticated Worker proxy. |
| Inngest Function Secret Guard | `src/app/api/inngest/route.ts` | **P2 (Med)** | Ensure Inngest signing key (`INNGEST_SIGNING_KEY`) is strictly checked in production to prevent forged job triggers. |

---
**Lane D Forensic Audit Report Signed:** Senior SRE / Infrastructure Security Audit Team
