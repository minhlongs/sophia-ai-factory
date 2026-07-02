---
phase: 3
title: "Compensating Controls"
status: pending
effort: "~2-3 hr"
priority: P1
---

# Phase 3: Compensating Controls

## Overview

Add defense-in-depth for CVEs without upstream fixes (particularly Next.js Middleware bypass group). Security headers, rate limiting, WAF-style hardening.

## Requirements

- Audit current security headers (CSP, HSTS, CORS)
- Harden CSP directives for Middleware bypass mitigations
- Review rate-limiting configuration
- Audit better-auth configuration for device auth bypass CVE
- Review middleware matcher for bypass prevention

## Related Code Files

- Read: `src/middleware.ts` (matcher + security headers)
- Read: `src/seed/security/` (existing security utilities)
- Modify: `next.config.ts` (security headers config)
- Modify: `src/middleware.ts` (rate limiting + security headers)

## Implementation Steps

1. Audit current CSP + security headers in middleware
2. Harden CSP: stricter script-src, form-action, frame-ancestors
3. Review middleware matcher: ensure all protected routes covered
4. Review better-auth config for device auth bypass
5. Add rate limiting for mitigate DoS CVEs (next CVE-2026-44579, ws DoS)
6. Document residual risk for CVEs without fix

## Success Criteria

- [ ] Security headers audit complete
- [ ] CSP hardened
- [ ] Rate limiting reviewed/enhanced
- [ ] Better-auth config reviewed
- [ ] Residual risk documented
- [ ] `npm test`: pass
- [ ] `npm run build`: 0 errors
