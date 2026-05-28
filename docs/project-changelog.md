# Project Changelog — Sophia AI Factory

> This file is an index. Full entries are split by quarter for faster loading.

**Last entry:** 2026-05-28 (Edge Runtime & OOM fixes, 4868/4868 tests, SHA e5239a5b)

---

## Quarter Index

| Quarter | Date Range | File |
|---------|-----------|------|
| 2026 Q2 | 2026-04-01 → present | [changelog/2026-Q2.md](changelog/2026-Q2.md) |
| 2026 Q1 | 2026-01-15 → 2026-03-31 | [changelog/2026-Q1.md](changelog/2026-Q1.md) |
| 2025 archive | pre-2026 | [changelog/2025-archive.md](changelog/2025-archive.md) — no entries (project started Jan 2026) |

---

## Recent Entries (Q2 2026 — latest 5)

- **2026-05-28** — Edge Runtime & OOM fixes: resolved module factory Edge runtime crashes by bypassing Sentry wrapping and commenting out destructive `strip_by_content` rules for `immer`/`sentry` in `strip-ssr-bloat.sh`. Optimized heap limits for compilation (type-check = 12GB, OpenNext build = 4GB) to prevent sandbox OOM. Verified HTTP 200 live on all primary routes. 4868 tests, SHA e5239a5b.
- **2026-05-17** — Next Sweep Phase 01-04: Inngest cleanup + lead:export live + 10-layer hardening + operator playbooks. 4431 tests, SHA 4bca4710.
- **2026-05-17** — 4-backlog sweep: Telegram copy + workflow + Apollo/Hunter + video benchmark. SHA 9f40a39b.
- **2026-05-17** — P13 multi-account YouTube live. 4409 tests, SHA e6821599.
- **2026-05-16** — RaaS zero-bug handover: promise matrix 17 PASS / 0 FAIL / 4 PARTIAL. SHA c7aab382.
- **2026-05-13** — Admin ops consistency batch: support/billing surface + NOWPayments normalization.

See [changelog/2026-Q2.md](changelog/2026-Q2.md) for full history.
