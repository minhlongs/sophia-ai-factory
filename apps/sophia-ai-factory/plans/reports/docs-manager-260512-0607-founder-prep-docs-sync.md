# Documentation Sync Report — Founder Prep Wave (2026-05-12 06:07)

**Reporter:** docs-manager | **Timestamp:** 2026-05-12T06:07:00Z | **Scope:** Canonical `./docs/*.md` update evaluation

---

## Executive Summary

Wave adds **4 non-customer-facing tools** (Sentry setup, BYOK screenshot capture, Crisp widget loader, DNS/inbox checklist). Canonical docs **require minimal updates** because:

1. **Crisp widget** is client-side infra (support) → belongs in `system-architecture.md` § "Frontend Infrastructure" or standalone support-providers section. Low priority—support tooling is ops/handover material, not architectural core.
2. **Sentry founder script** is **operator runbook** → already documented in `docs/handover/sentry-alerts-setup-runbook-260512.md`. No canonical doc changes needed.
3. **BYOK screenshot script** is **self-documenting** (`npm run byok:screenshots` in `package.json`, `public/byok-guide/README.md` for spec). No canonical need.
4. **DNS checklist** is **already in handover** (`docs/handover/founder-dns-and-inbox-drill-checklist-260512.md`). Companion to email deliverability doc. No canonical need.

**Recommendation:** Zero changes to canonical docs. Crisp widget is operator-level infrastructure, and deployment guide already lists external services. If Crisp becomes customer-facing (e.g., critical support channel), update `system-architecture.md` § 9 in next wave.

---

## Canonical Docs Reviewed

| File | Lines | Status | Decision |
|------|-------|--------|----------|
| `docs/project-overview-pdr.md` | 95 | Current | ✅ No update needed |
| `docs/code-standards.md` | 100+ | Current | ✅ No update needed |
| `docs/deployment-guide.md` | 290 | Current | ⚠ Minor context update (see below) |
| `docs/system-architecture.md` | 450+ | Current | ⚠ Could mention Crisp widget (deferred) |
| `docs/project-roadmap.md` | 72 | Current | ✅ No update needed |
| `docs/codebase-summary.md` | 20K | Current | ✅ No update needed |

---

## Detailed Analysis

### 1. `project-overview-pdr.md`

**Scope:** Feature PDR + roadmap.

**Wave impact:** None. Sentry/Crisp/BYOK are **operational tooling**, not product features. PDR already lists tier configs (BASIC/PREMIUM/ENTERPRISE/MASTER), payment (NOWPayments), and phase 8 (Binh Pháp automation).

**Decision:** ✅ No update. Crisp widget is NOT a product feature—it's a founder operator tool for support inbox routing.

---

### 2. `code-standards.md`

**Scope:** Naming, directory structure, React conventions, error handling.

**Wave impact:** None. Added code is operator helpers (`scripts/founder-setup-sentry.sh`, `scripts/capture-byok-screenshots.ts`) and a widget loader (`src/forest/components/support/crisp-widget.tsx`). Both are:
- **Helpers:** Not part of core product code standards.
- **Widget:** Minimal (dynamic import, env check, no-op if empty). Does NOT introduce new patterns or standards.

**Decision:** ✅ No update. Widget is a 3-line loader—no new standard to document.

---

### 3. `deployment-guide.md`

**Current state (line 1-100):** Covers local setup, test, build, wizard, prerequisites.

**Wave adds:**
- `.env.example` entry: `NEXT_PUBLIC_CRISP_WEBSITE_ID=` (lines 58-62)
- CSP allowlist for Crisp domains (production env)
- Welcome email mentions bilingual support (no new infra requirement)

**Observation:** Deployment guide § 1.5 already lists 14+ Cloudflare secrets. Crisp setup does NOT require a new secret (it's a website ID, not a secret, and it's inlined at build-time). Email + CSP updates are **infra changes**, but:
- CSP config is already in code (`seed/security/content-security-policy-configuration.ts`) — guide doesn't enumerate CSP details (it points to infra-hardening.md).
- Email change is internal to `src/seed/auth/better-auth-server.ts` — guide doesn't list email templates.

**Decision:** ✅ No update. Deployment guide remains accurate. Crisp + CSP are handled by wrangler env / build-time injection. If a founder asks "where do I set Crisp?", answer is "wrangler.toml [vars] + redeploy" (already in § 2 / CLAUDE.md CF-direct doctrine).

---

### 4. `system-architecture.md`

**Current state (450+ lines):** 8 numbered sections covering frontend, config, data, automation, payments, distribution, video-gen, Telegram.

**Wave adds:**
- **Crisp widget** (`src/forest/components/support/crisp-widget.tsx`) — live-chat loader on frontend. Mounts in layout, hidden if env empty.
- **CSP allowlist** for Crisp domains in content-security-policy-configuration.ts.

**Gap:** Architecture doc does NOT have a section dedicated to "Customer Support Infrastructure" or "Frontend Observability Tools". It lists:
- PostHog (implied in roadmap / usage-pressure conversation, but NOT in arch diagram)
- Sentry (mentioned in deployment checklist, but NO canonical reference in system-architecture.md § 8 CI/CD section)
- Crisp (NEW, NOT mentioned anywhere in canonical docs)

**Observation:** Founder wave introduced **3 support/ops tools** (Sentry, Crisp, DNS/email checks) all clustered in `docs/handover/` (rightful home for operator runbooks). System architecture is silent on all three.

**Rationale for deferral:**
- Crisp widget is **not a customer-facing feature**—it's a sidebar loader. If Crisp inbox becomes the primary support channel (and marketing promise), then it's product and deserves arch doc mention.
- Sentry is **observability**, not architecture. It's config (env var + SDK init) for error tracking, same category as logger.
- CSP allowlist is a **security hardening detail**, already covered in infra-hardening.md § "Content Security Policy".

**Decision:** ⚠ **Defer.** Add Crisp to system-architecture.md § 9 (New Section: "Support & Observability Infrastructure") ONLY if:
1. Crisp inbox becomes a **marketed support channel** (in pricing / landing page), OR
2. Crisp becomes **core to product** (e.g., required for tier tiers / customer success).

For now, Crisp is operator infra → belongs in handover runbooks, not canonical arch.

---

### 5. `project-roadmap.md`

**Scope:** Sprint priorities and phased delivery.

**Wave impact:** None. Founder prep is Phase 10+ (post-roadmap). Roadmap focuses on Sprints 1-3 (conversion, growth, moonshots). Sentry/Crisp/DNS are **enablers**, not product features.

**Decision:** ✅ No update. Roadmap remains product-focused.

---

### 6. `codebase-summary.md`

**Scope:** 20K summary of layer structure, services, database, and migration map.

**Wave impact:** Minimal. Added:
- 2 operator scripts (Sentry + BYOK)
- 1 component (Crisp widget) — adds to `forest/components/support/` (new subdirectory)
- CSP config updates (additive, no removal)
- Email template mention (internal)

**Observation:** Codebase summary is auto-generated from repomix (per CLAUDE.md). It WILL capture the new files on next regeneration. No manual update needed.

**Decision:** ✅ No update. Next repomix run will auto-sync.

---

## Files Already Current (Handover Docs)

These are **already in place** and do NOT need updates:

| File | Purpose | Status |
|------|---------|--------|
| `docs/handover/sentry-alerts-setup-runbook-260512.md` | Operator guide for Sentry alerts + webhook config | ✅ Current |
| `docs/handover/founder-dns-and-inbox-drill-checklist-260512.md` | DNS MX / SPF / DKIM verification checklist | ✅ Current |
| `docs/handover/free100-email-deliverability-260512.md` | Email sender reputation + warm-up strategy | ✅ Current |
| `docs/handover/support-provider-comparison-260512.md` | Crisp.im vs Zendesk vs Intercom analysis + setup | ✅ Current |

These handover docs are the **right home** for operator tooling. No duplication needed in canonical docs.

---

## Summary: Why Zero Changes

| Change Type | Reason | Canonical Doc Impact |
|--|--|--|
| **Crisp widget** (new frontend component) | Operator infra, not product feature | None (hidden if env empty) |
| **Sentry founder script** (new script) | Already documented in handover runbook | None (self-contained) |
| **BYOK screenshot script** (new npm command) | Self-documenting (script file + README) | None (tooling, not product) |
| **DNS checklist** (new checklist) | Already in handover folder | None (operator material) |
| **CSP allowlist** (production env) | Infra hardening, not architectural change | None (already in infra-hardening.md) |
| **Bilingual welcome email** (internal) | Email template, not API / product | None (not documented by design) |
| **Env example update** (NEXT_PUBLIC_CRISP_WEBSITE_ID) | Build-time var, already explained in .env.example | None (self-documented) |

---

## Recommendations for Future Waves

**If Crisp becomes critical to product:**
- Add § 9 to system-architecture.md: "Customer Support Infrastructure"
- Include: Crisp.im widget loader, webhook to internal alert pipeline (if any), CSP allowlist
- Update deployment-guide.md § 1.5 with Crisp setup steps (if customer-facing)

**If Sentry alerts need operational escalation:**
- Link deployment-guide.md § 6 (Verification Suite) to handover/sentry-alerts-setup-runbook-260512.md
- Add note: "For production alerting, configure Sentry via handover runbook"

**CI/CD note:**
- Deployment guide still references "GitHub Actions" (§ 8, line 192) but project uses CF-direct (wrangler). This is **historical debt**—already acknowledged in project CLAUDE.md. Defer unless updating full deployment flow.

---

## Conclusion

**Zero canonical doc updates required.**

Founder-prep wave is **operator/tooling focused**, not product/architectural. Handover docs are correctly placed. Crisp widget is a no-op if not configured—safe to ship without doc noise. When Crisp becomes a marketed feature, update arch doc in the relevant wave's documentation phase.

---

**Docs Sync Status:** ✅ VERIFIED — NO CHANGES NEEDED
