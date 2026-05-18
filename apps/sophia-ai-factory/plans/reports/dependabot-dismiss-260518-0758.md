# Dependabot Dismiss Report — 260518-0758

## gh Auth Scope
Account: `longtho638-jpg`. Scopes: `gist, read:org, repo, workflow`.
`repo` scope includes `security_events` — PATCH on dependabot alerts succeeded.

## Total Alerts Found (apps/sophia-ai-factory/package-lock.json)
**32 open** — all dismissed.

## Alerts Dismissed (32)

| Pkg | Count | Locked | fixed_in |
|-----|------:|--------|---------|
| next | 12 | 16.2.6 | ≤16.2.6 |
| protobufjs | 7 | 7.5.7 | 7.5.6 |
| @protobufjs/utf8 | 1 | 1.1.1 | 1.1.1 |
| fast-xml-builder | 1 | 1.2.0 | 1.1.7 |
| fast-uri | 2 | 3.1.2 | ≤3.1.2 |
| kysely | 1 | 0.28.17 | 0.28.17 |
| inngest | 1 | 3.54.2 | 3.54.0 |
| @opentelemetry/sdk-node | 1 | 0.217.0 | 0.217.0 |
| @opentelemetry/auto-instrumentations-node | 1 | 0.75.0 | 0.75.0 |
| @opentelemetry/exporter-prometheus | 1 | 0.217.0 | 0.217.0 |
| @babel/plugin-transform-modules-systemjs | 1 | 7.29.4 | 7.29.4 |
| next-intl | 1 | 4.11.2 | 4.9.2 |
| icu-minify | 1 | 4.11.2 | 4.9.2 |
| **TOTAL** | **32** | | |

Dismissal reason: `fix_started`. All locked versions equal or exceed `first_patched_version`.

## Alerts Kept-as-Real (0)
None — all 32 on `apps/sophia-ai-factory/package-lock.json` were stale.

## Remaining Open Alerts on Sophia Manifest
**0** — clean.

## Remaining Open Across Repo (63 total — explicitly excluded per task)
| Manifest | Open |
|---|---:|
| apps/84tea/package.json | 13 |
| apps/sophia-proposal/package-lock.json | 13 |
| apps/sophia-proposal/package.json | 12 |
| package-lock.json (root) | 13 |
| package.json (root) | 12 |

Root `package.json` (next@15.5.14) and `apps/84tea/package.json` (next@16.1.6) excluded per user instruction — these are genuinely vulnerable.

## Unresolved Questions
- `apps/sophia-proposal` — 25 alerts remain; workspace appears dormant; consider deleting to eliminate noise
- Root `package-lock.json` — 13 alerts for `next@15.5.14`; if root lock is never used in prod, accept-risk; otherwise bump to `≥15.5.18`
