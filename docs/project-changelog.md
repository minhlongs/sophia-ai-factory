# Project Changelog — Sophia AI Factory

> This file is an index. Full entries are split by quarter for faster loading.

**Last entry:** 2026-08-21 (Phase 4 Creative Learning Loop test coverage complete)
**Current Production SHA:** b821abd9 (deployed 2026-08-18)

---

## Quarter Index

| Quarter | Date Range | File |
|---------|-----------|------|
| 2026 Q3 | 2026-07-01 → present | [changelog/2026-Q3.md](changelog/2026-Q3.md) |
| 2026 Q2 | 2026-04-01 → 2026-06-30 | [changelog/2026-Q2.md](changelog/2026-Q2.md) |
| 2026 Q1 | 2026-01-15 → 2026-03-31 | [changelog/2026-Q1.md](changelog/2026-Q1.md) |
| 2025 archive | pre-2026 | [changelog/2025-archive.md](changelog/2025-archive.md) — no entries (project started Jan 2026) |

---

## Recent Entries (Q2 2026 — latest 5)

- **2026-06-29** — Deploy Speedup + Health Worker Fix: Added `SKIP_SYMBOL_UPLOAD=1` to deploy script, skipping 3519-file R2 source map upload (saves ~30 min per deploy). Fixed health worker secret put non-fatal (already-set error). Production SHA b868840b verified live.
- **2026-06-22** — OpenTelemetry Staging Verified: Full OTel instrumentation deployed to staging with Honeycomb integration verified. Production rollout prepared with 1% samplerate. SOC 2 controls walkthrough documented, auditor engagement complete. Deploy guard multi-operator approvals now live. BYOK rotation framework prepared with versioning infrastructure.
- **2026-06-21** — Production Deploy: CF-direct deployment with latest fixes and verification. SHA 7c8dc4c5.
- **2026-06-15** — Parallel Execution Framework: Ultracode parallel agent orchestration implemented with 5-model distribution (opus-4-8, opus-4-7, sonnet-4-6, haiku-4-5, sonnet-4.5-lite). Automatic task routing based on complexity.
- **2026-06-14** — Stitch MCP Integration: Campaign Dashboard UI with Pencil design system integration. i18n support for VN+EN. Design overrides for missing pages.
- **2026-06-08** — Deploy Guard Finalization: Multi-operator approval workflows, admin UI, CI gate integration, comprehensive test coverage, and documentation complete.

See [changelog/2026-Q2.md](changelog/2026-Q2.md) for full history.
