# Agent Teams — Sophia AI Factory

**Feature Flag:** `ENABLE_AGENT_TEAMS=true`  
**Phase:** 07 — Enable Agent Teams  
**Status:** Production Ready

---

## Overview

Sophia supports multi-agent teams that combine expertise from multiple C-Level agents. This enables parallel processing of complex founder requests that span multiple domains (e.g., tech + market + operations).

## Teams

### CEO Team

**Agent:** `ceo`  
**Composition:** CTO + CSO + CMO + COO  
**Use Case:** Strategic decisions requiring cross-functional synthesis

```bash
/sophia "ceo: evaluate entering enterprise market with video API"
```

**Output Structure:**
```
## Team Inputs
### CTO
{technical feasibility summary}
### CSO
{security & compliance assessment}
### CMO
{go-to-market positioning}
### COO
{capacity & ops feasibility}

## CEO Recommendation
{final decision with rationale}
```

### Marketing Team

**Agent:** `marketing-team`  
**Composition:** CMO + CSO  
**Use Case:** Go-to-market campaigns, pricing, positioning

```bash
/sophia "marketing-team: launch affiliate program for video generation"
```

### Tech Team

**Agent:** `tech-team`  
**Composition:** CTO + COO  
**Use Case:** Code quality, infrastructure scaling, incident response

```bash
/sophia "tech-team: optimize video pipeline for 100k concurrent users"
```

## Configuration

1. Set environment variable:

```bash
# .env or .env.local
ENABLE_AGENT_TEAMS=true
```

2. Verify agent definitions exist in `.sophia-factory/agents/`:
   - `ceo.md`
   - `marketing-team.md`
   - `tech-team.md` (auto-generated from CTO+COO)

3. Orchestrator auto-detects flag and routes to team agents.

## Execution Flow

```
Founder request
    ↓
Orchestrator reads ENABLE_AGENT_TEAMS
    ↓
Spawn team agent (via Skill tool)
    ↓
Team agent spawns sub-agents in parallel
    ↓
Aggregate outputs → Synthesize recommendation
    ↓
Return to founder
```

## Debugging

- Check `ENABLE_AGENT_TEAMS` in `.env`
- Verify agent definitions: `.sophia-factory/agents/*.md`
- Inspect orchestrator logs for team routing decisions
- Run typecheck: `npm run typecheck`

## Rollback

Set `ENABLE_AGENT_TEAMS=false` to revert to single-agent routing.

## See Also

- `.sophia-factory/orchestrator.md` — Supervisor logic
- `.claude/commands/mekong.md` — Mekong CLI bridge
- `plans/260614-arch-debug-fixes/phase-07-agent-teams.md` — Implementation plan