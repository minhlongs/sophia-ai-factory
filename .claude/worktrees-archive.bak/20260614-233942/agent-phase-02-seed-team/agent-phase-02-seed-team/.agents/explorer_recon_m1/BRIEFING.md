# BRIEFING — 2026-05-30T07:45:00Z

## Mission
Comprehensive codebase exploration of sophia-ai-factory repository structure, architectural flows, technical debt, and codebase-audit state.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Teamwork explorer, Read-only investigation
- Working directory: /Users/macbook/projects/sophia-ai-factory/.agents/explorer_recon_m1
- Original parent: dc0b838d-52b1-4938-8012-3c373bb264ca
- Milestone: codebase_recon

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify any source code (except agent files in our working directory)
- Must follow the 5-component handoff report structure (Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: dc0b838d-52b1-4938-8012-3c373bb264ca
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/`, `services/`, `scripts/`, `migrations/`, `docs/`, `supabase/`
  - `apps/sophia-ai-factory/src/seed/`
  - `apps/sophia-ai-factory/src/forest/`
  - `apps/sophia-ai-factory/src/land/`
  - `docs/codebase-audit/`
- **Key findings**:
  - Found unmapped cron triggers (`0 7 * * *`, `0 */4 * * *`, `10 * * * *`, `*/10 * * * *`) that cause `No handler for cron pattern` errors in production.
  - Found a critical credit balance mismatch where Better Auth signup hooks and coupon activation endpoints update `org_balances`, but the dashboard and execution engine query and debit `user_mcu_balance`.
  - Found 29 SQLite migrations in `src/seed/db/migrations/` and 4 PostgreSQL migrations in `src/db/migrations/` that are extra/deprecated and not processed by standard scripts.
  - Found 15 unregistered Inngest background functions (like `videoGenerate`, `repurposeAnalyze`, `sopExecute`) in the serve route.
  - Found MASTER tier pricing margin risk (unprofitable lifetime usage if BYOK is bypassed).
- **Unexplored areas**: None, all exploration tasks completed.

## Key Decisions Made
- Exploration complete; compiling findings into detailed handoff.md.

## Artifact Index
- /Users/macbook/projects/sophia-ai-factory/.agents/explorer_recon_m1/progress.md — Progress tracker and heartbeat
- /Users/macbook/projects/sophia-ai-factory/.agents/explorer_recon_m1/handoff.md — Final handoff report
