# ClaudeKit Orchestration Patterns for Sophia /dashboard

**Research Date:** 2026-05-18  
**Max Length:** 150 lines (concise findings)  
**Report Type:** Architectural patterns for Web UI ↔ .claude/ integration

---

## Section 1: Current State

### Sophia .claude/ Artifacts
- **Commands:** 1 custom (`pilot.md` — meta-router for task dispatch)
- **Rules:** 5 (sophia-deploy-verify, sophia-no-tech-doctrine, sophia-handover-rules, cross-layer-orchestration, sophia-layer-architecture)
- **Skills:** None in .claude/skills/ (agent-memory only)
- **Teams:** None configured

### Dashboard Routes (Customer-Facing)
- `/dashboard/agents` — AgentTeamPanel (polls `/api/agents/list`, renders agent cards)
- `/dashboard/missions` — MissionDashboard + MissionLauncher (real Sophia RaaS campaigns)
- `/dashboard/workflows` — WorkflowList (fetches `/api/raas/workflows`)
- `/dashboard/sops` — InstallationListTable (user's SOP installations from D1)

**Current Reality:** Dashboard surfaces CUSTOMER DATA (campaigns, agents, SOPs) — NOT ClaudeKit orchestration. No .claude/ artifact exposure anywhere.

---

## Section 2: Gap Analysis

| Layer | Exposed? | Notes |
|---|---|---|
| Skills (.claude/skills/) | ❌ No | Dashboard has no skill marketplace, cards, or trigger UI |
| Commands (.claude/commands/) | ❌ No | Pilot command exists (server-side); not customer-accessible |
| Team status (~/.claude/teams/) | ❌ No | No team config in Sophia repo; no team dashboard |
| Agent run history/logs | ⚠️ Partial | AgentTeamPanel shows STATUS (polling); no logs or execution trace |
| ClaudeKit integration | ❌ No | Dashboard is pure RaaS data layer; orchestration is server-side only |

**Doctrine Conflict:** Sophia no-tech doctrine forbids exposing OPERATOR infrastructure to CUSTOMER. Currently dashboard correctly isolates. But /dashboard/admin (operator-only) doesn't exist.

---

## Section 3: Architecture Recommendation

### Pattern A: Operator Routes (/dashboard/admin/*)
For operator-only visibility into ClaudeKit state:

```
/dashboard/admin/skills/          → skill marketplace (list .claude/skills/*/SKILL.md)
/dashboard/admin/commands/        → command palette (list .claude/commands/*.md)
/dashboard/admin/system-health/   → team status + agent logs + deployment pipeline
```

**Implementation:**
- Server component reads `.claude/skills/*/SKILL.md` + `.claude/commands/*.md` metadata
- Render as cards with name, description, triggers
- Team status from ~/.claude/teams/*/config.json (if teams existed)
- Agent logs from D1 `agent_runs` table (if schema existed)

### Pattern B: Customer Routes (unchanged)
- Keep /dashboard/agents, /missions, /workflows, /sops as pure customer data
- NO exposure of .claude/* artifacts
- No operator credentials required for customer to use platform

### Connection Layer (Server Actions)
- New endpoints: `/api/admin/skills/list`, `/api/admin/commands/list`
- Guard via tier check + admin flag in D1 `users` table
- Avoid exposing raw file paths to frontend

---

## Section 4: UI Patterns to Adopt

### Skill Card (for operator dashboard)
```
┌─ skill-name ─────────────────────┐
│ Description line.                │
│ Triggers: [tag1] [tag2]          │
│ Tools: [@read @write @bash]      │
│ Status: ✅ Active                │
└──────────────────────────────────┘
```

### Command Palette Entry
```
/command-name — Brief description
  Keywords: audit, scan, find
  Output: file path or stream
```

### Team Status Badge (future)
```
🟢 Active (3/5 agents)  📊 Tasks: 12 in-flight
```

---

## Section 5: Security/Doctrine Guardrails

1. **NEVER expose .claude/* paths to customer** — violates no-tech doctrine
2. **Operator routes MUST require auth** + admin tier check (e.g., `MASTER` or new `OPERATOR` flag)
3. **Skills are READ-ONLY** in dashboard UI (no trigger/execute from web; that's CC CLI only)
4. **Agent logs sanitize** customer API keys before display
5. **Commands are informational** — dashboard shows what exists, not a trigger interface

---

## Section 6: Unresolved Questions

1. **Should operator trigger skills from /dashboard/admin?** Or read-only display only? (Recommendation: read-only; CLI is operator tool.)
2. **Does Sophia need a team config?** Currently no `.claude/teams/` — is orchestration needed or just status polling?
3. **Agent execution logs storage?** Where do agent run traces live? D1 schema missing `agent_runs` table.
4. **i18n for .claude/ metadata?** Skills/commands are English-only today — operator dashboard can stay EN.
5. **How to wire skill metadata to component props?** Bash + glob reads .claude/skills/*/SKILL.md → parse YAML frontmatter → JSON API → React cards.

---

**Summary:** Sophia dashboard correctly isolates customer data from operator infrastructure. Recommended next step: create /dashboard/admin routes (operator-only, auth-gated) to expose read-only visibility into ClaudeKit state. No changes to customer-facing dashboard required.
