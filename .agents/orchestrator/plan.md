# Codebase Review Plan — 2026-05-31

## Objectives
1. Perform a parallel codebase review of the Sophia AI Factory project focusing on four domains:
   - Payments (NOWPayments & PayOS webhook signatures, idempotency, underpayments).
   - Authentication (Better Auth session state synchronization, D1 database failure handling).
   - Video & Credits (HeyGen webhook verification, optimistic locking in decrementCredits, Cloudflare timeouts).
   - Metering (Non-atomic Redis updates, CPU/memory performance of D1 usage rollup queries).
2. Identify at least 10 critical edge cases across these domains.
3. Verify status of each edge case: Handled (✅), Unhandled (❌), or Partially Handled (⚠️).
4. Cite exact files and line numbers for each edge case.
5. Provide specific, actionable remediation recommendations.
6. Compile findings into a structured Markdown report.

## Execution Strategy
- **Phase 1: Planning & Setup**
  - Verify project context, check repository layout, and initialize progress tracking.
  - Set up heartbeat cron.
- **Phase 2: Parallel Exploration & Code Inspection**
  - Spawn specialized `teamwork_preview_explorer` subagent(s) to scan the codebase for the targeted files and logic related to payments, auth, video/credits, and metering.
  - Review Explorer findings.
- **Phase 3: Verification & Assessment**
  - Deep-dive into specific files and lines to verify how the edge cases are handled.
  - Determine the exact handling status and document the findings.
- **Phase 4: Synthesis & Reporting**
  - Compile the final structured report.
  - Report completion to the Sentinel.
