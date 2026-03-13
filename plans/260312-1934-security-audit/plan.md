# SOPHIA Security Audit Plan

**Date:** 2026-03-12 | **Priority:** P0 | **Status:** Planning

## Overview

Security audit for SOPHIA AI Video Factory - Next.js 15 static export application.

**Key Constraint:** `output: 'export'` means NO runtime API routes except build-time handlers.

## Architecture Context

| Aspect | Status |
|--------|--------|
| Next.js 15 App Router | Static export |
| Runtime API Routes | NONE (build-time only) |
| Polar Webhook | HMAC-SHA256 secured |
| License Service | In-memory Map (no persistence) |
| Client-side Admin | Direct service import |

## Security Findings Summary

### CRITICAL (Must Fix)

1. **No Runtime Authentication** - Static export = no server-side auth layer
2. **License Service Exposed** - Client imports service directly, all data visible
3. **No Persistence** - In-memory Map loses data on restart
4. **No Rate Limiting** - No protection from abuse

### HIGH (Should Fix)

5. **No Security Headers** - Missing CSP, HSTS, X-Frame-Options
6. **No Input Validation** - License CRUD accepts any input
7. **No CSRF Protection** - No tokens for state-changing ops
8. **No Audit Logging** - No security event tracking

### MEDIUM (Nice to Fix)

9. **Console.log in prod** - removeConsole configured but verify
10. **No CORS Configuration** - Missing CORS headers

## Implementation Phases

### Phase 1: Security Headers (Can run independently)
**Files:** `next.config.ts`, create `app/lib/security-headers.ts`
**Priority:** P0

### Phase 2: Client-Side Auth Guard (Can run independently)
**Files:** Create `app/components/auth/AuthGuard.tsx`, `app/lib/auth-context.ts`
**Priority:** P0

### Phase 3: Input Validation (Can run independently)
**Files:** Add zod to `package.json`, update `license-service.ts`
**Priority:** P1

### Phase 4: Audit Logger [COMPLETED]
**Files:** `app/lib/audit-logger.ts` (created)
**Priority:** P2 | **Status:** Done

**Implementation:**
- `AuditLogEntry` interface with timestamp, action, entity, entityId, details
- `AuditLoggerClass` singleton with `log()` method and specialized methods
- License CRUD logging: `logLicenseCreate`, `logLicenseRead`, `logLicenseUpdate`, `logLicenseDelete`, `logLicenseRevoke`
- Subscription logging: `logSubscriptionUpdate`
- Usage logging: `logUsageAccess`
- Console persistence (designed for future DB/file persistence)

### Phase 5: Remove Console.log (Sequential - after audit logger)
**Files:** Scan all `.ts/.tsx` files, remove console.log
**Priority:** P1

### Phase 6: Tests + Git Push (Sequential - depends on all above)
**Files:** Run vitest, git push, verify CI/CD
**Priority:** P0

## Dependency Graph

```
Phase 1 (Headers) ─┐
Phase 2 (Auth)   ──┼──→ Phase 5 (Console.log) ──→ Phase 6 (Tests+Push)
Phase 3 (Validate)─┤
Phase 4 (Audit)  ──┘
```

**Parallel Execution:** Phases 1-4 can run simultaneously
**Sequential:** Phase 5-6 must run after 1-4

## File Ownership Matrix

| Phase | Files Modified/Created | Owner |
|-------|----------------------|-------|
| 1 | `next.config.ts`, `security-headers.ts` | Security Agent |
| 2 | `AuthGuard.tsx`, `auth-context.ts` | Frontend Agent |
| 3 | `license-service.ts`, `package.json` | Backend Agent |
| 4 | `audit-logger.ts` | Security Agent |
| 5 | All `.ts/.tsx` with console.log | Cleanup Agent |
| 6 | Test files, git commit | Release Agent |

## Success Criteria

- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] Client-side auth guard implemented
- [ ] Input validation with zod
- [ ] Audit logger created
- [ ] 0 console.log statements in production code
- [ ] All tests passing
- [ ] CI/CD GREEN
- [ ] Production verified HTTP 200

## Unresolved Questions

1. How to handle server-side auth with static export?
2. Should we add Supabase for license persistence?
3. Polar webhook runs at build-time only - how to handle runtime webhooks?
