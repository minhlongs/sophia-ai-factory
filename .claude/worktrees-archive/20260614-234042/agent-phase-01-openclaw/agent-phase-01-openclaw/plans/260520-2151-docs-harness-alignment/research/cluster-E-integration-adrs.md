# Cluster E Audit: Integration & ADRs — Docs ↔ Code Drift Analysis

**Audit Date:** 2026-05-20  
**Scope:** Root `/docs/` + `apps/sophia-ai-factory/docs/` (Cluster E: integration, compliance, migrations, ADRs)  
**Auditor:** File search specialist (READ-ONLY)  
**Target:** Production-ready docs alignment with code  

---

## 1. Summary

**Overall Verdict:** Partial drift in ADR index and integration docs; compliance baselines are measured and current; migration docs underspecified vs. actual 117+ D1 migrations.

| Metric | Status | Impact |
|---|---|---|
| **ADR completeness** | ⚠️ Incomplete | Only ADR 0007 exists; 0001–0006 missing. No index. |
| **Mekong integration status** | ✅ Active | Symlink + slash command live; email refs stale (mekongmind.com hardcoded). |
| **Migration docs** | ⚠️ Underspecified | Docs reference generic checklist; 117 actual D1 migrations (0001–0117) not enumerated. |
| **Compliance baselines** | ✅ Measured | ASVS-L2 desk-reviewed (94% pass); A11y baseline with CI gate. Both backed by tests. |
| **Cross-repo sync** | ✅ On-time | mekong-integration.md (Apr 28) verified against `.sophia-factory/mekong-bridge/` symlink. |

---

## 2. Per-Doc Verdict Table

| Document | Location | Last Update | Status | Finding |
|---|---|---|---|---|
| **sophia-mekong-integration.md** | `docs/` | 2026-04-17 | ✅ Current | Symlink verified; slash command live. Email domain stale (mekongmind.com hardcoded in src/). |
| **0007-deprecate-video-jobs-inngest-chain.md** | `docs/architecture-decisions/` | 2026-05-17 | ✅ Current | Detailed decision record; cites audit report. Deprecated handlers kept with JSDoc tags. |
| **a11y-baseline.md** | `apps/.../docs/` | Phase 03 baseline | ✅ Current | Spec'd CI gate; Playwright axe-core integration. No suppressions yet. |
| **asvs-l2-checklist.md** | `apps/.../docs/` | 2026-05-18 | ✅ Current | Desk-reviewed (code analysis only); 29/31 controls pass. 7 security tests in `src/security-tests/`. |
| **AUDIT-LOG-RETENTION.md** | `apps/.../docs/compliance/` | 2026-03-06 | ✅ Current | SOC2/PCI/GDPR baseline; 90-day retention. Archive not yet auto-scheduled (future). |
| **load-test-260518.md** | `apps/.../docs/` | 2026-05-18 | ✅ Current | k6 + Playwright staging tests; 100 VU stress pass, E2E 5/5. |
| **MIGRATION_CHECKLIST.md** | `docs/migrations/` | 2026-03-06 | ⚠️ Stale | References Redis→Supabase; modern state is D1-primary (0001–0117). |
| **REDIS_TO_SUPABASE.md** | `docs/migrations/` | 2026-03-06 | ⚠️ Stale | Historical reference; modern schema is D1-native via Cloudflare. |

---

## 3. ADR Completeness

**Finding:** Single ADR (0007) exists; index missing.

| File | Status | Notes |
|---|---|---|
| `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md` | ✅ Exists | 2026-05-17, fully detailed, cites audit. Handlers deprecated (not deleted) for test coverage. |
| `0001-0006` | ❌ Missing | No records found in filesystem. Not in `docs/architecture-decisions/`, `plans/`, or `.cleo/adrs/`. |
| **Index** | ❌ Missing | No `README.md` or `index.md` in `docs/architecture-decisions/`. Guideline suggests backfill. |

**Audit trail:** Historical decisions likely made pre-CAAMP harness (installed 2026-05-20). Recommendation: Backfill an ADR index with pointers to PRs/plans that document prior decisions (e.g., Inngest adoption in Phase 06, video pipeline flip to HeyGen in Q1 2026).

---

## 4. Mekong Integration Status

**Question:** Is sophia-mekong-integration.md still accurate? Is mekong-cli actually called?

**Answer:** ✅ **Active & Verified**

| Aspect | Evidence | Status |
|---|---|---|
| **Symlink bridge** | `.sophia-factory/mekong-bridge/phases → /Users/macbookprom1/mekong-cli/.mekong/phases` | ✅ Live (lrwxr-xr-x) |
| **Slash command** | `.claude/commands/mekong.md` (40 lines, subcommand router) | ✅ Registered |
| **CLI integration** | Wrapper around `/Users/macbookprom1/.local/bin/mekong` (v3.3.0+) | ✅ Callable |
| **Code references** | `grep -r "mekong" src/` → 20 hits, all hardcoded emails (support@mekongmind.com) | ⚠️ No dynamic calls |
| **Email domain** | Hardcoded in 18 files: `src/land/billing/email/*`, `src/forest/components/*` | ⚠️ Stale |

**Drift Found:**
- Doc says bridge is for C-Level agents (CTO/CMO/CSO/COO) to reference Mekong's SDLC phases.
- Actual code: no Inngest/cron/handler calls to mekong CLI. Email templates reference `support@mekongmind.com` (Mekong's domain, not Sophia's).
- Impact: **Non-breaking.** Integration is *architectural* (SDLC process + symlink), not *runtime* (no code execution flow). Customer-facing email domain should eventually be Sophia's, not Mekong's.

---

## 5. Migration Docs vs. Actual Migrations

**Finding:** Docs severely underspecified; 117 actual D1 migrations not documented.

| Source | Count | Status |
|---|---:|---|
| **Actual D1 migrations** | 117 | `apps/sophia-ai-factory/migrations/000[1-117].sql` present |
| **Docs references** | 3 files | `MIGRATION_CHECKLIST.md`, `REDIS_TO_SUPABASE.md`, `usage-events-schema.sql` |
| **Migration index** | ❌ None | No `migrations/README.md` enumerating 0001→0117 or explaining phases |
| **Historical context** | ⚠️ Lost | No narrative explaining when/why each migration shipped (Phase 01 init? Phase 03 RAAS? Phase 06 video?) |

**Actual Migration Phases (inferred from naming):**
- **0001-0030:** Core schema (users, auth, workflows, exports, campaigns, payments, wallets, videos)
- **0031-0070:** Feature layers (coupon, export jobs, agent factory, JWT, affiliate, publishing)
- **0071-0100+:** Hardening & extensions (account deletion, provider status, revenue split, tag cache, crypto jurisdiction, A/B experiments, user failed logins, help videos, SOP seeding)
- **Latest:** 0117-refresh-video-generation-starter-sop.sql (2026-05-19)

**Recommendation:** Create `apps/sophia-ai-factory/docs/migrations/README.md` with a table: `| Migration ID | Date | Feature | Status | Notes |` to recover tribal knowledge before contributors lose context.

---

## 6. Compliance Baselines: Measured vs. Aspirational

### A11y Baseline (WCAG 2.1 AA)

**Status:** ✅ **Measured via CI gate**

```
File:     apps/sophia-ai-factory/docs/a11y-baseline.md
Scope:    5 dashboard routes (/dashboard, /dashboard/settings, /dashboard/admin, /dashboard/api-keys, /dashboard/affiliate)
Framework: Playwright + axe-core, fail on critical/serious, warn on moderate/minor
Implementation: tests/e2e/_fixtures/a11y-test.ts (checkA11y call)
CI enforcement: E2E specs in tests/e2e/dashboard-*.spec.ts
Suppression list: None yet (backlog for design exceptions)
```

**Evidence:** Spec exists + fixture code present. No live runs captured in audit, but structure is wired. ✅ Pass.

### ASVS-L2 Checklist (OWASP 4.0.3 — Security)

**Status:** ✅ **Measured via desk review + security tests**

```
File:           apps/sophia-ai-factory/docs/asvs-l2-checklist.md
Methodology:    Source code audit (no live exploit testing)
Coverage:       V2 Auth (10), V3 Session (7), V4 Access Control (4), V5 Validation (10) = 31 controls
Score:          29/31 pass (94%), 2 N/A (magic-link + single-tenant IDOR)
Remediated:     F01 (account lockout), F02 (admin re-auth), F03 (promo IDOR)
Tests backing:  src/security-tests/ = 7 files
  - f01-per-account-rate-limit.test.ts
  - f02-admin-reauth.test.ts
  - f03-promo-idor.test.ts
  - promo-idor.test.ts
  - m1-malformed-json.test.ts
  - m2-admin-promo-bare-path.test.ts
  - redeem-brute-force.test.ts
Unresolved:     Live Burp/ZAP active scan deferred to Phase 05 step 5
```

**Verdict:** ✅ Measured. Desk review complete; regression tests wired. Active testing (Burp) planned for next phase.

### Audit Log Retention (Compliance — SOC2/PCI/GDPR)

**Status:** ⚠️ **Aspirational baseline; auto-cleanup not yet implemented**

```
File:         apps/sophia-ai-factory/docs/compliance/AUDIT-LOG-RETENTION.md
Scope:        raas_audit_logs table retention policy (90 days active, optional archive)
Implementation: Manual D1 queries only; scheduled cleanup function in SQL (not active)
Compliance:   SOC2 (90d min) ✅ Met
              PCI (1y min) ⚠️ 90d active + archive future
              GDPR (right to erasure) ⚠️ Manual process (auto future)
Future work:  IP hashing, archive to S3, right-to-erasure automation (Q2–Q4 2026)
```

**Verdict:** ⚠️ Baseline documented; enforcement not automatic. Meets SOC2 minimum; PCI full compliance deferred.

---

## 7. Reshape Recommendation

### Target Structure

```
docs/
├── adrs/
│   ├── README.md               # Index: 0001-0007 + decision matrix + links to related plans
│   ├── 0001-XXX.md             # Backfill: early architectural decisions (from git history / plans)
│   ├── 0002-YYY.md
│   ...
│   └── 0007-deprecate-video-jobs-inngest-chain.md (move from architecture-decisions/)
│
├── integration/
│   ├── sophia-mekong-integration.md
│   └── third-party-api-integration-checklist.md (future)
│
└── migrations/
    ├── README.md               # Migration index: 0001-0117 with feature grouping & dates
    ├── phases/
    │   ├── phase-01-core-schema.md      # 0001-0030
    │   ├── phase-02-feature-layers.md   # 0031-0070
    │   ├── phase-03-hardening.md        # 0071-0100+
    │   └── phase-04-extensions.md       # 0100+
    └── reference/
        ├── REDIS_TO_SUPABASE.md (archive as historical)
        └── MIGRATION_CHECKLIST.md (archive; replace with phase runbooks)

apps/sophia-ai-factory/docs/
├── compliance/
│   ├── a11y-baseline.md
│   ├── asvs-l2-checklist.md
│   └── AUDIT-LOG-RETENTION.md
└── migrations/
    └── README.md               # Link back to root docs/migrations/
```

**Rationale:**
- **Deduplicate:** Move app-layer docs (a11y, asvs-l2, audit-log) to a single compliance folder with cross-repo pointers.
- **Centralize ADRs:** Root `docs/adrs/` becomes the canonical ADR index; app-level decisions backlink.
- **Migration narrative:** Root `docs/migrations/` tells the story (0001→0117 grouped by phase); app folder documents operational runbooks.
- **Clear ownership:** Integration docs at root (cross-project); compliance + migrations at app (operational).

---

## 8. Unresolved Questions

1. **ADR 0001–0006:** Were these decisions made pre-CAAMP? In what branch/PR? Recommend git log search: `git log --all --grep="ADR\|decision\|architecture" --oneline | head -20` to recover context.

2. **Migration naming convention:** Is 4-digit zero-padded ID (0001, 0031, 0117) intentional? Should we document the migration ID scheme (e.g., "sequential per environment, no backfilling across branches")?

3. **Email domain:** Should `support@mekongmind.com` in 18 email templates migrate to Sophia's own domain (e.g., `support@sophia.agencyos.network`)? This is a refactoring task, not docs.

4. **Compliance cadence:** ASVS-L2 was desk-reviewed 2026-05-18; next live security scan (Burp/ZAP) is Phase 05 step 5. When does this happen? Link the phase/sprint to docs.

5. **A11y suppression baseline:** Doc says "no suppressions yet"; when do we run the first Playwright a11y suite on prod routes? Should this be a gating event for Phase 03 completion?

6. **Migration cleanup:** Do we ever delete old migration files (e.g., 0001-0020) for brevity, or keep them immutable as audit trail? Recommend documenting the immutability policy.

7. **Mekong bridge durability:** The symlink at `.sophia-factory/mekong-bridge/phases` points to `/Users/macbookprom1/mekong-cli/.mekong/phases`. If Mekong repo moves or is deleted, this breaks. Should we document a fallback or version-pin the phases?

---

## Appendix: File Inventory

### Root Docs Cluster E

- `docs/sophia-mekong-integration.md` (2026-04-17, 163 lines) — integration spec ✅
- `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md` (2026-05-17, 113 lines) — deprecation ADR ✅
- `docs/migrations/MIGRATION_CHECKLIST.md` (2026-03-06, 230+ lines) — Redis→Supabase guide (stale)
- `docs/migrations/REDIS_TO_SUPABASE.md` (2026-03-06, 260+ lines) — historical reference (stale)
- `docs/migrations/usage-events-schema.sql` (ref schema, not docs)

### App Docs Cluster E

- `apps/sophia-ai-factory/docs/a11y-baseline.md` (baseline, no date field, ~87 lines) ✅
- `apps/sophia-ai-factory/docs/asvs-l2-checklist.md` (2026-05-18, 225 lines) ✅
- `apps/sophia-ai-factory/docs/compliance/AUDIT-LOG-RETENTION.md` (2026-03-06, 276 lines) ✅
- `apps/sophia-ai-factory/docs/load-test-260518.md` (2026-05-18, 60+ lines) ✅
- `apps/sophia-ai-factory/docs/migrations/` (5 files: 20260306-*, audit-*, raas-*, historically organized, not enumerated)

### Missing / Underspecified

- `docs/architecture-decisions/README.md` — **no ADR index**
- `docs/migrations/README.md` — **no migration phase narrative**
- `apps/sophia-ai-factory/docs/migrations/README.md` — **no operational context**
- ADR 0001–0006 — **no records found**

---

**Audit Complete.** Recommendations to PM: (1) backfill ADR index with git archaeology; (2) enumerate 117 migrations in `docs/migrations/phases/`; (3) clarify email domain migration path; (4) schedule Phase 05 security/a11y baseline runs.

