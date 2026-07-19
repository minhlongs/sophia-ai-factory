# Phase 1 — Dependency Fixes + Quick Wins

**Status:** pending | **Priority:** P0 | **Effort:** 0.5h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)

## Findings Addressed
- **H11**: undici < 7.28.0 TLS certificate bypass (CVSS 7.4)
- 31 OTEL packages — moderate CWE-770
- `dompurify` <= 3.4.10 allowed_attr pollution
- `js-yaml` 4.0.0-4.1.1 quadratic DoS

## Implementation

### Step 1: npm audit fix
```bash
npm update undici dompurify js-yaml
npm update @opentelemetry/core @opentelemetry/sdk-node  # may need major bump
```

### Step 2: Verify no breaking changes
```bash
npm run type-check
npm test
```

## Files Changed
- `package.json` + `package-lock.json` (version bumps only)

## Success Criteria
- [ ] `npm audit` shows 0 HIGH vulns (undici fixed)
- [ ] All 6694+ tests pass
- [ ] Build succeeds
- [ ] TypeScript 0 errors
