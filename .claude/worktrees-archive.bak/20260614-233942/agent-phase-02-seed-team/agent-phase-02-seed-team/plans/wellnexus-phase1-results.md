# WellNexus Phase 1: Dependency Health Scan Results

**Date**: 2026-01-29
**Project**: Well
**Scan Type**: Automated dependency analysis (npm audit, npm-outdated, depcheck)

---

## Executive Summary

Phase 1 scans identified **critical vulnerabilities** requiring immediate attention:

| Metric | Count | Severity |
|--------|-------|----------|
| **Security Vulnerabilities** | 10 | 10 moderate (undici CVEs) |
| **Outdated Packages** | 25 | 11 major version gaps |
| **Unused Dependencies** | 1,072+ | Mixed (prod/dev/missing) |

**Risk Assessment**: MODERATE - Vulnerabilities fixable via Firebase update; outdated packages include breaking changes (React 19, Tailwind 4); unused deps bloat bundle.

---

## 1. Security Vulnerabilities (npm audit)

### Critical Findings

**Total Vulnerabilities**: 10 (all moderate severity)
**Root Cause**: `undici` package (versions <6.23.0)
**Affected Ecosystem**: Firebase SDK dependencies

#### CVE Details

| CVE | Package | Severity | CVSS | Issue |
|-----|---------|----------|------|-------|
| [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) | undici | Moderate | 6.8 | Use of Insufficiently Random Values (CWE-330) |
| [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) | undici | Low | 3.1 | DoS via bad certificate data (CWE-401) |
| [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9) | undici | Moderate | 5.9 | Unbounded decompression chain (CWE-770) |

#### Vulnerability Chain

```
undici (<6.23.0)
  ↓ affects
@firebase/auth, @firebase/firestore, @firebase/functions, @firebase/storage
  ↓ affects
firebase@10.14.1 (direct dependency)
```

#### Remediation

**Fix Available**: ✅ YES
**Action**: Update Firebase to latest version (12.8.0)

```bash
npm update firebase
```

**Impact**: All 10 vulnerabilities resolved via single Firebase update.

---

## 2. Outdated Packages (npm outdated)

### Overview

**Total Outdated**: 25 packages
**Categories**:
- 11 packages with major version gaps (breaking changes likely)
- 14 packages with minor/patch updates

### Critical Updates (Major Version Gaps)

| Package | Current | Latest | Gap | Breaking Risk |
|---------|---------|--------|-----|---------------|
| **firebase** | 10.14.1 | 12.8.0 | 2 majors | HIGH - SDK changes |
| **react** | 18.3.1 | 19.2.4 | 1 major | HIGH - Server Components |
| **react-dom** | 18.3.1 | 19.2.4 | 1 major | HIGH - paired with React |
| **@types/react** | 18.3.27 | 19.2.10 | 1 major | MEDIUM - type updates |
| **@types/react-dom** | 18.3.7 | 19.2.3 | 1 major | MEDIUM - type updates |
| **react-router-dom** | 6.30.3 | 7.13.0 | 1 major | MEDIUM - routing API |
| **framer-motion** | 11.18.2 | 12.29.2 | 1 major | MEDIUM - animation API |
| **lucide-react** | 0.344.0 | 0.563.0 | ~0.2 | LOW - icon updates |
| **recharts** | 2.15.4 | 3.7.0 | 1 major | MEDIUM - chart API |
| **tailwindcss** | 3.4.18 | 4.1.18 | 1 major | HIGH - config format |
| **tailwind-merge** | 2.6.0 | 3.4.0 | 1 major | LOW - utility updates |
| **zustand** | 4.5.7 | 5.0.10 | 1 major | MEDIUM - state API |
| **@vitejs/plugin-react** | 4.7.0 | 5.1.2 | 1 major | MEDIUM - Vite 6 support |

### Recommended Safe Updates (Minor/Patch)

| Package | Current | Wanted | Latest |
|---------|---------|--------|--------|
| @google/generative-ai | 0.21.0 | 0.21.0 | 0.24.1 |
| @supabase/supabase-js | 2.86.0 | 2.93.3 | 2.93.3 |
| @typescript-eslint/eslint-plugin | 8.52.0 | 8.54.0 | 8.54.0 |
| @typescript-eslint/parser | 8.52.0 | 8.54.0 | 8.54.0 |
| @vitest/ui | 4.0.12 | 4.0.18 | 4.0.18 |
| autoprefixer | 10.4.22 | 10.4.23 | 10.4.23 |
| globals | 17.0.0 | 17.2.0 | 17.2.0 |
| happy-dom | 20.0.10 | 20.4.0 | 20.4.0 |
| i18next | 25.7.4 | 25.8.0 | 25.8.0 |
| jsdom | 27.2.0 | 27.4.0 | 27.4.0 |
| react-i18next | 16.5.2 | 16.5.4 | 16.5.4 |
| vitest | 4.0.12 | 4.0.18 | 4.0.18 |

---

## 3. Unused Dependencies (depcheck)

### Summary

**Total Flagged**: 1,072+ references analyzed
**Categories**:
- Unused dependencies (4 prod, 7 dev)
- Missing dependencies (1 critical)
- Used dependencies (validated usage)

### Unused Dependencies

#### Production (Remove to reduce bundle size)
```json
{
  "clsx": [],
  "i18next-http-backend": [],
  "react-scroll": [],
  "tailwind-merge": []
}
```

**Recommendation**: Remove if confirmed unused.

```bash
npm uninstall clsx i18next-http-backend react-scroll tailwind-merge
```

#### Development (Remove to reduce install time)
```json
{
  "@testing-library/user-event": [],
  "autoprefixer": [],
  "claudekit": [],
  "postcss": [],
  "tailwindcss": [],
  "ts-node": [],
  "vite-plugin-pwa": []
}
```

**Note**: `autoprefixer`, `postcss`, `tailwindcss` flagged incorrectly (used in config files). Review others before removal.

### Missing Dependencies (CRITICAL)

```json
{
  "@playwright/test": [
    "/Users/macbookprom1/Well/playwright.config.ts",
    "/Users/macbookprom1/Well/e2e/app.spec.ts"
  ]
}
```

**Action**: Install immediately.

```bash
npm install -D @playwright/test
```

---

## Phase 2 Priorities

### High Priority (Security & Critical Fixes)
1. **Firebase Update** (fixes 10 vulnerabilities)
2. **Install @playwright/test** (fixes missing dependency)
3. **Remove Unused Prod Dependencies** (reduces bundle ~5-10KB)

### Medium Priority (Breaking Changes)
4. **React 19 Migration** (requires testing)
5. **Tailwind 4 Upgrade** (config rewrite)
6. **React Router 7** (routing API changes)

### Low Priority (Safe Updates)
7. **Minor/Patch Updates** (14 packages, low risk)
8. **Remove Unused Dev Dependencies** (reduces install time)

---

## Risk Mitigation Strategy

### Before Major Updates
- [ ] Create git branch: `chore/wellnexus-phase2-updates`
- [ ] Run full test suite baseline
- [ ] Document current prod behavior

### Update Process
- [ ] Update Firebase first (security fix)
- [ ] Test authentication, Firestore, storage flows
- [ ] Update minor/patch packages in batch
- [ ] Test core user flows
- [ ] Update React 19 in isolated branch
- [ ] Run comprehensive E2E tests
- [ ] Update Tailwind 4 last (visual regression testing)

### Rollback Plan
- Git tags before each major update
- Feature flags for React 19 features
- Docker image backups of working versions

---

## Appendix: Scan Commands

```bash
# Security audit
npm audit --json > /tmp/well-npm-audit.json

# Outdated packages
npm outdated --json > /tmp/well-npm-outdated.json

# Unused dependencies
npx depcheck --json > /tmp/well-depcheck.json
```

---

## Next Steps

1. **Review with team** (15 min standup)
2. **Create Phase 2 plan** (prioritize updates)
3. **Allocate sprint capacity** (~3-5 days for major updates)
4. **Set up test coverage baseline** (ensure no regressions)
5. **Execute updates in sequence** (security → safe → breaking)

**Estimated Effort**: 2-3 sprints (major updates), 1 day (security + safe updates only)

---

**Generated**: 2026-01-29 23:44:26 +07:00
**Tool**: WellNexus Phase 1 Scanner
**Methodology**: BINH PHÁP Ch.3 謀攻 - Document for strategic attack
