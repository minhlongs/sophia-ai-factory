---
description: 🔗 Bridge to Mekong CLI — invoke SDLC commands (spec/design/code/deploy) + metrics + eval
argument-hint: <subcommand> [args...]  e.g., spec new auth | metrics | eval-agent cto
---

# Mekong CLI Bridge — Sophia Factory Deep Integration

[VN] Cầu nối tới Mekong CLI v3.3.0+ tại `/Users/macbook/mekong-cli/`. Cho phép Sophia dùng SDLC scaffold + observability + signals của Mekong CLI.
[EN] Bridge to Mekong CLI v3.3.0+ at `/Users/macbook/mekong-cli/`. Lets Sophia use Mekong's SDLC scaffold + observability + signals.

## Request
<command>$ARGUMENTS</command>

## Subcommand routing

| Mekong subcommand | Purpose | Bash invocation |
|---|---|---|
| `spec new <feat>` | Create specification document | `cd ~/mekong-cli && mekong spec new <feat>` |
| `design <feat>` | Create design document | `cd ~/mekong-cli && mekong design <feat>` |
| `code <feat>` | Implement feature per design | `cd ~/mekong-cli && mekong code <feat>` |
| `deploy <feat>` | Deploy with CI/CD gates | `cd ~/mekong-cli && mekong deploy <feat>` |
| `metrics` | View local SQLite metrics | `cd ~/mekong-cli && mekong metrics` |
| `eval-agent <id>` | Evaluate agent performance | `cd ~/mekong-cli && mekong eval-agent <id>` |

## Workflow

1. Parse `$ARGUMENTS` to extract subcommand + args
2. Validate subcommand against routing table above
3. Run via Bash tool: `cd /Users/macbook/mekong-cli && mekong $ARGUMENTS`
4. Capture output, return to user
5. If creating spec/design/code/deploy artifact, COPY artifact path into Sophia's plans/ for cross-repo reference

## Cross-repo design

```
sophia-ai-factory/
├── .sophia-factory/
│   ├── agents/               # Sophia C-Level (CTO/CMO/CSO/COO)
│   ├── orchestrator.md       # Sophia supervisor
│   ├── CLAUDE.{spec,design,code,deploy}.md   # Sophia's own SDLC instructions
│   └── mekong-bridge/
│       └── phases/ → /Users/macbook/mekong-cli/.mekong/phases/  # SYMLINK
│
mekong-cli/
├── .mekong/
│   ├── phases/               # CANONICAL SDLC (Sophia symlinks here)
│   │   ├── CLAUDE.spec.md
│   │   ├── CLAUDE.design.md
│   │   ├── CLAUDE.code.md
│   │   ├── CLAUDE.deploy.md
│   │   ├── signals/          # SQLite offline evals
│   │   └── templates/
│   └── ...
├── src/cli/commands/         # Python CLI: eval_agent.py, metrics.py
└── observability/            # OTel + Grafana stack (Docker-blocked on M1 Max)
```

## When to use Sophia C-Level vs Mekong SDLC

- **Sophia C-Level (`/sophia <request>`)**: business-layer decisions (CTO/CMO/CSO/COO routing). Constrained to Sophia repo paths.
- **Mekong CLI Agent (`mekong-cli`)**: cross-repo SDLC, observability, symlinks, subagent orchestration between Sophia and Mekong CLI.
- **Mekong SDLC (`/mekong <subcommand>`)**: technical SDLC scaffold (spec→design→code→deploy). Cross-repo, includes Mekong's observability + signals.

Typical flow:
1. `/sophia "new feature: weekly tier-upgrade nudge email"` → CMO drafts copy + CTO drafts technical spec
2. Orchestrator routes SDLC task → `mekong-cli` agent (via Skill spawn)
3. `mekong-cli` runs: `mekong spec new tier-upgrade-nudge` → copies artifact to Sophia `plans/`
4. `mekong-cli` runs: `mekong design tier-upgrade-nudge` → architecture
5. `mekong-cli` runs: `mekong code tier-upgrade-nudge` → implementation (Mekong's CI/CD gates)
6. `mekong-cli` runs: `mekong deploy tier-upgrade-nudge` → deploy with canary + auto-rollback
7. `mekong-cli` runs: `mekong eval-agent cmo` → assess CMO output quality after rollout
8. `/mekong metrics` → view unified observability dashboard (Sophia Better Stack + Mekong Grafana)

## Agent Teams Routing

| Sophia Team | C-Level Agents Invoked | Primary Use Case |
|---|---|---|
| `ceo` | `cto`, `cso`, `cmo`, `coo` | Strategic synthesis, founder decisions |
| `marketing-team` | `cmo`, `cso` | Go-to-market campaigns, pricing, positioning |
| `tech-team` | `cto`, `coo` | Code quality, infra, incident response |

**Usage:**
```bash
/sophia "ceo: review Q3 roadmap with market data"
/sophia "marketing-team: launch affiliate program"
/sophia "tech-team: scale video pipeline to 100k users"
```

Orchestrator auto-detects `ENABLE_AGENT_TEAMS=true` and routes to team agent definitions in `.sophia-factory/agents/`.

## Observability bridge (when Docker activated on M1 Max)

Sophia's Better Stack logs + Mekong's Grafana metrics CAN merge:
- Sophia pushes Worker logs → Better Stack (managed)
- Mekong pushes Python agent metrics → Prometheus → Grafana (self-host on M1 Max)
- Cross-link via `commit_sha` field (Sophia P2 D1 column) and `agent.invocation_id` (Mekong OTel attribute)
- Future: unified dashboard at `grafana.m1max.cashclaw.cc` showing both

## Docs
- Sophia plan: `plans/260416-2328-sophia-factory-raas-solo-platform/plan.md`
- Mekong audit: `/Users/macbook/mekong-cli/plans/reports/audit-260417-0820-mekong-vs-claudekit-gap.md`
- Activation: `docs/sophia-activation-runbook.md`
- Architecture: `docs/sophia-mekong-integration.md` (this bridge documented in detail)

## Constraints
- Mekong CLI is INDEPENDENT repo at `/Users/macbook/mekong-cli/` — DO NOT mutate from Sophia directly
- `/mekong` slash from Sophia operates READ-ONLY against Mekong (or via official `mekong` CLI binary which has own permissions)
- ALL cross-repo writes MUST go through the `mekong-cli` agent — it is the sole authorized mutator of Mekong state from Sophia context
- Cross-repo writes go through PR workflow on respective repo
