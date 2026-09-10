# Project Changelog — Sophia AI Factory

> This file is an index. Full entries are split by quarter for faster loading.

**Last entry:** 2026-09-10 (Customer Handover Productization Sprint & Production Live Deployment)
**Current Production SHA:** c3b2e7e6 (deployed 2026-09-10; verified live on Cloudflare Workers)

---

## Quarter Index

| Quarter | Date Range | File |
|---------|-----------|------|
| 2026 Q3 | 2026-07-01 → present | [changelog/2026-Q3.md](changelog/2026-Q3.md) |
| 2026 Q2 | 2026-04-01 → 2026-06-30 | [changelog/2026-Q2.md](changelog/2026-Q2.md) |
| 2026 Q1 | 2026-01-15 → 2026-03-31 | [changelog/2026-Q1.md](changelog/2026-Q1.md) |
| 2025 archive | pre-2026 | [changelog/2025-archive.md](changelog/2025-archive.md) — no entries (project started Jan 2026) |

---

## Recent Entries (Q3 2026 — latest 5)

- **2026-09-10** — **Customer Handover Productization Sprint & Production Deployment (SHA c3b2e7e6).** Transitioned Sophia AI Factory from technical readiness to customer-operable, customer-owned, CEO-friendly production SaaS (100/100 independence score). Shipped canonical 6-step onboarding (`/vi/setup`), real HTTP upstream BYOK validation, customer-facing System Health Center and CEO-safe Incident UX (`/settings/system-health`), first-run wizard with cost estimator (`/dashboard/missions/new`), tenant-scoped usage metering & ownership delegation (`/settings/usage`, `/settings/ownership`), sanitized diagnostic bundle generation (`/operations`), automated customer journey tests (41/41 passing), and complete 10-part customer runbook suite (`docs/customer/*`). Deployed via CF-direct doctrine; commit SHA `c3b2e7e6` verified live at `https://sophia.agencyos.network/api/version`. 9,092 tests passing across 884 files.
- **2026-09-10** — **Founder Bootstrap Authorization Remediation & Production Deployment (SHA c35840f4).** Zero-touch founder promotion hook (`src/seed/auth/founder-bootstrap.ts`) wired to Better Auth `user.create.after`, schema migration 0272 for `user_profiles.role`, unified `requireMaster()` gate in `src/land/admin/org-manager.ts`, immutable audit logging. Deployed live via CF-direct doctrine (`shortSha: "c35840f4"`). 8,944 tests passing.
- **2026-09-10** — **Handover Hardening Sprint & Production Deployment (SHA 12b8a022).** Resolved all customer-handover code blockers from Supreme Certification. fal.ai BYOK integration in Setup Wizard UI (`/vi/setup`) with regex format validation (`validateFalAI`), state handling bifurcated between BYOK (`/api/user/byok`) and platform credentials, bilingual copy (VI/EN). Shipped complete operational runbook suite: `OPERATOR-BOOTSTRAP.md` (RUN-BOOT-001), `DISASTER-RECOVERY.md` (RUN-DR-001), `CANARY-VERIFICATION.md` (RUN-CANARY-001), and comprehensive security report (`SECURITY-HARDENING-REPORT.md`). Deployed via CF-direct doctrine; commit SHA `12b8a022` verified live. 8,928 tests passing.
- **2026-09-08** — **SUPREME COMMAND #7 — fal.ai Image Adapter (Experimental).** New `FalImageProvider` class implementing `ImageGenerationProvider` interface with circuit breaker wrapping, BYOK for `FAL_KEY`, tier gating. Wired into action + API route + status route. EXPERIMENTAL certification via `registerCertification`. 36 new tests. Build clean, 8829 tests pass.
- **2026-08-29** — **Sophia 2027 KILLER TEST — final gate GREEN.** Full acceptance flight verified end-to-end: `npm test` 8597 passed | 0 failed; `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors. D4 Creative Memory write-back verified. Protected flows zero-diff. Ready for SHIP.
- **2026-08-26** — Sophia 2027 Phase 1 domain primitives: CreativeIdentity injection, CreativeMemory flywheel, approval-event loop closure, MarketSignal dedupe, 34 content-graph tests. SHA 1df573d8.
- **2026-06-29** — Deploy Speedup + Health Worker Fix: Added `SKIP_SYMBOL_UPLOAD=1` to deploy script, skipping 3519-file R2 source map upload (saves ~30 min per deploy). Fixed health worker secret put non-fatal (already-set error). Production SHA b868840b verified live.
- **2026-06-22** — OpenTelemetry Staging Verified: Full OTel instrumentation deployed to staging with Honeycomb integration verified. Production rollout prepared with 1% samplerate. SOC 2 controls walkthrough documented, auditor engagement complete. Deploy guard multi-operator approvals now live. BYOK rotation framework prepared with versioning infrastructure.
- **2026-06-21** — Production Deploy: CF-direct deployment with latest fixes and verification. SHA 7c8dc4c5.
- **2026-06-15** — Parallel Execution Framework: Ultracode parallel agent orchestration implemented with 5-model distribution (opus-4-8, opus-4-7, sonnet-4-6, haiku-4-5, sonnet-4.5-lite). Automatic task routing based on complexity.
- **2026-06-14** — Stitch MCP Integration: Campaign Dashboard UI with Pencil design system integration. i18n support for VN+EN. Design overrides for missing pages.
- **2026-06-08** — Deploy Guard Finalization: Multi-operator approval workflows, admin UI, CI gate integration, comprehensive test coverage, and documentation complete.

See [changelog/2026-Q2.md](changelog/2026-Q2.md) for full history.
