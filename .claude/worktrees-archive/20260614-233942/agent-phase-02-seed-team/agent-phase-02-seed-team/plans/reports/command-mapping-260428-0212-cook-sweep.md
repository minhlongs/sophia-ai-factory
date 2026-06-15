# Command Mapping — Cook Sweep

**Created:** 2026-04-28 02:12 PT
**Scope:** Map pending tasks to claudekit (`~/.claude/commands`) + mekong-cli (`~/mekong-cli/.claude/commands`) commands.

## Pending Tasks Inventory

| # | Task | Source |
|---|------|--------|
| T1 | Phase 3 — D1 `videos` table migration `0024` | plan.md L29 |
| T2 | Phase 3 — `GET /api/videos` (list) | plan.md L31 |
| T3 | Phase 3 — `GET /api/videos/[id]` (detail) | plan.md L31 |
| T4 | Phase 3 — `/dashboard/videos` gallery page | plan.md L32 |
| T5 | Phase 4 — Remotion render (DEFERRED, optional) | plan.md L34 |
| T6 | Deploy verify — re-enable Actions + secrets + migrations | Task #18 |
| T7 | Open Q1 — tier credit consumption metering | plan.md L48 |
| T8 | Open Q2 — script persistence model | plan.md L49 |
| T9 | Open Q3 — rate limiting `/api/scripts/generate` | plan.md L50 |

## Mapping Table

| Task | Primary Command | Secondary | Subagents | Notes |
|------|----------------|-----------|-----------|-------|
| T1 (D1 migration) | `/cook` (this skill) | mekong-cli `/backend-db-task` | `planner` → `tester` | Migration file + apply locally via wrangler. |
| T2 (API list) | `/cook` | mekong-cli `/backend-api-build` | `planner` → `tester` → `code-reviewer` | Better Auth + tier gate + zod params (limit/offset). |
| T3 (API detail) | `/cook` | mekong-cli `/backend-api-build` | `tester` → `code-reviewer` | Auth + ownership check (user_id match). |
| T4 (Gallery UI) | `/cook` | sophia `/sophia` + `ui-ux-designer` | `ui-ux-designer` → `tester` | 200-LOC rule, reuse `Card`/`Button` shadcn. |
| T5 (Remotion) | `/plan:hard` first | mekong-cli `/tech-architecture-review` | `researcher` → `planner` | Decision-pending — cost analysis required before code. |
| T6 (CI verify) | mekong-cli `/cloudflare` + `/ship` | claudekit `/vercel-debug` (n/a) | `debugger` (post-deploy) | Requires user-side: Actions toggle + 9 secrets. |
| T7 (credit metering) | `/plan:fast` | mekong-cli `/business-revenue-engine` | `researcher` | Architectural decision; ties to existing usage-metering. |
| T8 (script persist) | `/plan:fast` | mekong-cli `/backend-db-task` | `planner` | Trade-off: audit value vs storage cost. |
| T9 (rate limit) | `/cook` | mekong-cli `/sec-policy` | `code-reviewer` | Wrap with existing `withRateLimit` HOC if present. |

## Recommended Execution Order

1. **NOW (this sweep):** T1 → T2 → T3 → T4 (Phase 3 closure)
2. **NEXT:** T9 (rate limit) — small, security-critical
3. **DEFER (decision required):** T5, T7, T8
4. **OPERATIONAL (user-blocked):** T6

## Command Source Legend

- **claudekit global** = `~/.claude/commands/` (e.g., `/cook`, `/idea`, `/raas-flow`, `/techdebt`, `/save`, `/remember`)
- **mekong-cli project** = `~/mekong-cli/.claude/commands/` (100+ commands incl. `/backend-*`, `/cloudflare`, `/ship`, `/sec-*`, `/worker-*`, `/studio-*`)
- **sophia project** = `~/projects/sophia-ai-factory/.claude/commands/` (e.g., `/sophia`, `/ask`, `/plan`, `/review`, `/test`)

## Subagent Mapping (claudekit standard)

| Phase | Subagent | When |
|-------|----------|------|
| Plan | `planner` | Multi-file architectural change |
| Implement | `fullstack-developer` | Has clear plan + file boundaries |
| UI | `ui-ux-designer` | Frontend visual work |
| Test | `tester` | After every code change |
| Review | `code-reviewer` | Before commit |
| Finalize | `project-manager` + `docs-manager` + `git-manager` | Mandatory cook tail |

## Open Questions

- T5/T7/T8 require user decision before scoping subagents — out of scope for this auto sweep.
