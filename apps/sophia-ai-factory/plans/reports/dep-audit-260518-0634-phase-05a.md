# Dependency Security Audit — Phase 05a
**Date:** 2026-05-18  
**Tool ref:** phase-05-pentest-part-a steps 1+2

---

## Summary Table

| Tool | Before HIGH/CRIT | After HIGH/CRIT | Status |
|------|-----------------|-----------------|--------|
| npm audit | 0 / 0 | 0 / 0 | CLEAN |
| Snyk | — | — | SKIPPED — auth missing |

---

## npm audit Details

Scanned **2,094 dependencies** (prod: 1244, dev: 632, optional: 273, peer: 43).

```json
{ "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 }
```

No HIGH or CRITICAL findings. `npm audit fix` not required.

---

## Snyk

`npx snyk whoami` returned **401 Unauthorized** (SNYK-0005).  
Snyk CLI installed (v1.1304.3) but no auth token configured.

**Skipped.** To enable: run `npx snyk auth` and re-run this audit.

---

## Actions Taken

- npm audit run against package-lock.json (2,094 deps).
- No fixes applied (no vulnerabilities found).
- `pnpm-lock.yaml` not modified.

---

## Accepted Risks

None — npm audit clean. Snyk gap noted below.

---

## Unresolved Questions

1. Snyk auth not configured — HIGH/CRIT findings from Snyk's DB (distinct from npm registry advisories) remain unverified. Recommend: `npx snyk auth` + re-run before pentest sign-off.
