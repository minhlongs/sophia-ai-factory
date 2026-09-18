# API & ROUTE SECURITY FORENSIC AUDIT

**Target:** Sophia AI Factory API Surface (Next.js App Router API Routes)  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Route Archetype Security Classification

The application exposes 120+ API route handlers under `src/app/api/`. Every route falls into one of four strictly guarded archetypes:

| Archetype | Route Pattern | Authentication Boundary | Authorization & Role Boundary | CSRF & Replay Defense |
|---|---|---|---|---|
| **Admin Controls** | `/api/admin/*` | Session Cookie + Better Auth | `requireAdmin()` checks `role === 'admin'` or recent step-up auth | SameSite Cookie + Origin Header |
| **Protected User APIs** | `/api/user/*`, `/api/mission/*`, `/api/v1/*` | Session Cookie | `getCurrentUser()` + `verifyWorkspaceAccess()` | SameSite Cookie |
| **Webhooks (External)** | `/api/webhooks/*` | Cryptographic Signature Header | Provider-specific HMAC secret (`x-nowpayments-sig`, etc.) | D1 Atomic Event Lock (`ON CONFLICT DO NOTHING`) |
| **Internal Crons** | `/api/cron/*` | Cloudflare Scheduled Trigger or Bearer Header | `CRON_SECRET` validation | Cloudflare Worker Cron isolation |

---

## 2. Forensic Route Inspection Matrix

| Route | Method | Auth | Tenant Check | Input Validation | Secret Leakage Risk | IDOR Risk |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/admin/pricing/update` | POST | Yes | Platform | Zod schema | None | None (Admin only) |
| `/api/admin/synthetic-ipn` | POST | Yes | Platform | Zod schema | None | None (Admin only) |
| `/api/admin/deploy-status` | GET | Yes | Platform | None | Redacted | None (Admin only) |
| `/api/checkout` | POST | Yes | Session User | Zod (`checkoutSchema`) | None | None (Own user) |
| `/api/webhooks/nowpayments` | POST | HMAC | Dynamic / Order | Zod (`ipnPayloadSchema`) | None | Atomic Lock |
| `/api/mission/[id]` | GET/DEL | Yes | `verifyWorkspaceAccess()` | ID validation | None | Mitigated (Workspace match) |
| `/api/user/byok` | GET/POST| Yes | Session User | `key-format-validators` | Plaintext never returned | None (Own credentials) |
| `/api/setup-wizard/readiness`| GET | Yes | Session User | None | Masked summaries | None (Own readiness) |

---

## 3. Defense Against Frontend-Only Security Assumptions

**Principle:** Frontend hiding is NEVER authorization.
- Every Server Action in `src/land/**/actions.ts` executes `getCurrentUser()` at runtime on the server.
- The `$0 Enterprise Upgrade` Server Action was eliminated: `changeTierAction()` rejects upgrade requests unless paid checkout is verified.
- The `skipPreflight` bypass was removed from `StartMissionSchema`. No client payload can disable backend validation gates.

---

## 4. Automated Forensic Regression Suites (Evidence)

All adversarial and boundary security assertions are continuously enforced in [`src/security-tests/adversarial-forensic.test.ts`](file:///Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/security-tests/adversarial-forensic.test.ts):

| Suite | Focus Area | Defense Mechanism | Result |
|---|---|---|:---:|
| **1. Billing Anti-Drop** | Dynamic SDK Checkout Webhooks | Dynamic invoices with valid `order_id` route to subscription handler; orphans safely dropped | **PASS** |
| **2. Mission State Machine** | Terminal Transitions | Strictly enforces `failed` and `cancelled` terminal states; blocks invalid regressions | **PASS** |
| **3. Founder Bootstrap** | Fail-Closed Auth | Unverified or mismatched `FOUNDER_EMAIL` rejected immediately; no privilege escalation | **PASS** |
| **4. Mission Access Control** | IDOR Isolation | Access strictly constrained to workspace owner; non-owners blocked | **PASS** |
| **5. Server Action Guard** | Privilege Escalation | Free tier upgrade attempts via direct Server Action call rejected (`upgrade_requires_payment`) | **PASS** |
| **6. Workspace Isolation** | Cross-Tenant IDOR & RBAC | `verifyWorkspaceAccess` fails closed on empty/invalid inputs; `requireWorkspaceRole` throws on insufficient role | **PASS** |

