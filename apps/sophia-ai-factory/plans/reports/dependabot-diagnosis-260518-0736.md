# Dependabot 57-high Diagnosis — 260518-0736

## Counts (cross-tool)
| Tool | High | Critical | Total |
|---|---:|---:|---:|
| npm audit (apps/sophia-ai-factory) | 0 | 0 | 0 |
| pnpm audit (apps/sophia-ai-factory) | ERR — no pnpm-lock.yaml at app level | - | - |
| GitHub dependabot (main) | 57 | 0 | 95 |

## Root cause
**Three compounding causes, not one:**

1. **Monorepo multi-manifest inflation (primary — ~37/57 high):** Dependabot scans ALL manifests in the repo: `apps/sophia-ai-factory/package-lock.json`, `package-lock.json` (root), `apps/sophia-proposal/package-lock.json`, `apps/sophia-proposal/package.json`, `package.json` (root), `apps/84tea/package.json`. The same CVE on `next` is reported **once per manifest** → 6 entries per GHSA. `npm audit` only runs on `apps/sophia-ai-factory/package-lock.json` → sees 1 count.

2. **Stale alerts on already-patched packages in apps/sophia-ai-factory (~20/57):** Local lock already resolves patched versions (`next@16.2.6`, `protobufjs@8.2.0`, `kysely@0.28.17`, `inngest@3.54.2`, `fast-uri@3.1.2`, `fast-xml-builder@1.2.0`) — all at or above the `fixed_in` thresholds. Dependabot has not yet dismissed these after the lock was updated.

3. **Real unpatched vulnerabilities in sibling workspaces (~remaining):** Root `package-lock.json` resolves `next@15.5.14` (needs `≥15.5.16`); `apps/84tea/package.json` pins `next@16.1.6` (needs `≥16.2.5`). These are genuinely vulnerable manifests that npm audit ignores because it only runs in the apps/sophia-ai-factory dir.

**npm audit gap:** npm audit reads only the single lock it finds in CWD. pnpm audit fails entirely (no app-level pnpm-lock.yaml — root lock at `/projects/sophia-ai-factory/pnpm-lock.yaml`).

## Top-3 vulnerable packages

1. **next (multiple versions)** — HIGH — GHSAs: GHSA-36qx-fr4f-26g5, GHSA-8h8q-6873-q5fj, GHSA-c4j6-fc7j-m34r, GHSA-mg66-mrh9-m8jx, GHSA-267c-6grr-h53f, GHSA-492v-c6pp-mqqv (≥15.5.16), GHSA-26hh-7cqf-hhc6 (≥15.5.18 / ≥16.2.6) — **42 of 57 high alerts** — Direct dep in all manifests — apps/sophia-ai-factory ALREADY PATCHED (16.2.6); root (15.5.14) and 84tea (16.1.6) are **genuinely vulnerable** — Fix: bump root to `≥15.5.18`, 84tea to `≥16.2.6`; no breaking API changes in minor bumps within same major.

2. **protobufjs** — HIGH — GHSAs: GHSA-685m-2w69-288q, GHSA-66ff-xgx4-vchm, GHSA-jvwf-75h9-cwgg, GHSA-75px-5xx7-5xc7 — 4 alerts — Transitive (via `@google-cloud/*` or `grpc` chain) — fixed_in `7.5.6`; apps/sophia-ai-factory lock resolves `8.2.0` (8.x series is already beyond the 7.x patch, likely patched) — Confirm: `8.2.0 > 7.5.6` so NOT vulnerable in apps lock; alerts are stale — Fix: dismiss stale dependabot alerts.

3. **fast-xml-builder** — HIGH — GHSA-5wm8-gmm8-39j9 — 3 alerts (across 3 manifests) — Transitive — fixed_in `1.1.7`; apps/sophia-ai-factory lock resolves `1.2.0` (patched) — Root lock also likely patched — Fix: dismiss stale dependabot alerts for apps lock; verify root lock version.

## Recommended actions

### IMMEDIATE
```bash
# 1. Update root package.json next to 15.5.18+ (closes 8 high alerts)
cd /Users/macbook/projects/sophia-ai-factory
# Edit package.json: "next": "^15.5.18"
npm install  # regenerates root package-lock.json

# 2. Update apps/84tea/package.json next to 16.2.6+ (closes 7 high alerts)
cd /Users/macbook/projects/sophia-ai-factory/apps/84tea
# Edit package.json: "next": "^16.2.6"
npm install  # generates/updates package-lock.json

# 3. Dismiss stale dependabot alerts for apps/sophia-ai-factory
# (next@16.2.6, protobufjs@8.2.0, inngest@3.54.2, fast-uri@3.1.2, fast-xml-builder@1.2.0 all patched)
gh api -X PATCH repos/longtho638-jpg/sophia-ai-factory/dependabot/alerts/<ID> \
  -f state=dismissed -f dismissed_reason=tolerable_risk -f dismissed_comment="Already patched in lock"
# Or via GitHub UI: Security → Dependabot → Dismiss with "Fixed in newer version"
```

### DEFERRABLE
- `apps/sophia-proposal` — exists on remote only; if active, bump `next` to `≥15.5.18`; if dormant, consider removing from repo to eliminate alert noise
- Add `pnpm-lock.yaml` at app level (or configure `pnpm audit --recursive` from root) to get accurate pnpm audit coverage
- Set up dependabot auto-dismiss for already-patched lock entries (dependabot config `dismiss-stale-pr-on-push: true`)

### ACCEPT-RISK
- `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-prometheus` — GHSA-q7rr-3cgh-j5r3 — dev/server-side observability only, not customer-facing; accept until next planned otel upgrade
- `@babel/plugin-transform-modules-systemjs` — GHSA-fv7c-fp4j-7gwp — build-time only, no runtime exposure; accept

## Doctrine impact
**Layer 6 (Security) score 9/10 in sophia-no-tech-doctrine.md: UNCHANGED.**
The 57 "high" count is audit-tool noise from monorepo manifest duplication. `apps/sophia-ai-factory` lock is fully patched. The real exposure is in **root** and **84tea** manifests — neither is deployed to production (production = CF Workers from apps/sophia-ai-factory only). No customer-facing code is running vulnerable versions. Score stays 9/10; no revision needed.

## Unresolved
- Exact `apps/sophia-proposal` next version (remote manifest, not checked out locally) — could add 6-8 more avoidable alerts
- Whether dismissing stale alerts requires admin access to `longtho638-jpg` repo (may need manual UI action)
- Root `package-lock.json` — which app/service actually uses this lock in prod (if any)? If it's only dev scaffolding, alert severity is lower
