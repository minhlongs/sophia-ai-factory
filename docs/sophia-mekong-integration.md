# Sophia ↔ Mekong CLI Integration Architecture

**Audience:** Sophia founder + Mekong CLI maintainer
**Purpose:** Document the deep architectural bridge between Sophia AI Factory (RaaS product) and Mekong CLI (developer framework).
**Updated:** 2026-04-17

---

## Why integrate?

Sophia and Mekong CLI shipped the SAME 4 layers (CI/CD + Observability + Signals + SDLC) per a16z Solo Company doctrine. Instead of duplicating effort, they share canonical sources where possible.

| Capability | Sophia's choice | Mekong CLI's choice | Bridge strategy |
|---|---|---|---|
| **CI/CD gates** | GH Actions (TS/Next.js) | GH Actions (Python) | Independent (different stacks) |
| **Observability** | Better Stack (managed, $0) | OTel + Prometheus + Grafana (self-host) | Cross-link via `commit_sha` + `agent.invocation_id` |
| **Signals/A/B** | PostHog Cloud (managed, $0) | SQLite local + future PostHog | Sophia's PostHog can ingest Mekong events when shipped |
| **SDLC scaffold** | `.sophia-factory/CLAUDE.{spec,design,code,deploy}.md` | `.mekong/phases/CLAUDE.{spec,design,code,deploy}.md` | Sophia symlinks Mekong's phases (canonical) |
| **C-Level agents** | 4 agents in `.sophia-factory/agents/` (Sophia-only) | None (Mekong has SDLC agents only) | Sophia is canonical; Mekong consumes via bridge |

---

## Topology

```mermaid
graph TB
  subgraph Sophia["Sophia AI Factory (RaaS product)"]
    SA[.sophia-factory/agents/CTO/CMO/CSO/COO]
    SO[.sophia-factory/orchestrator.md]
    SS[/sophia slash command]
    SBS[Better Stack logs]
    SPH[PostHog signals]
    SCI[GH Actions: 5 gates]
  end

  subgraph Mekong["Mekong CLI (developer framework)"]
    MS[.mekong/phases/CLAUDE.{spec,design,code,deploy}.md]
    MOG[OTel + Grafana stack]
    MSQ[SQLite signals at data/signals.sqlite]
    MCI[GH Actions: 5 gates Python]
    MM[mekong CLI binary]
  end

  subgraph Bridge["Bridge (Sophia repo)"]
    SBP[.sophia-factory/mekong-bridge/phases → SYMLINK]
    SCMD[/mekong slash command]
    DOCS[docs/sophia-mekong-integration.md]
  end

  SS --> SO
  SO --> SA
  SCMD --> MM
  SBP -.symlink.-> MS
  MM --> MS
  SPH -.future ingest.-> MSQ
  SBS -.cross-link.-> MOG
  SCI --> SBS
  MCI --> MOG
```

---

## Bridge components

### 1. SDLC phase symlink
**Location:** `.sophia-factory/mekong-bridge/phases` → `/Users/macbookprom1/mekong-cli/.mekong/phases`

Sophia's C-Level agents (CTO/CMO/CSO/COO) reference Mekong's SDLC phase instructions when drafting specs/designs/code/deploys. This avoids duplicating the 4 CLAUDE.{spec,design,code,deploy}.md files in both repos.

**Maintenance:** Mekong CLI is canonical. Update phases in `~/mekong-cli/.mekong/phases/`, Sophia auto-picks up via symlink.

### 2. `/mekong` slash command bridge
**Location:** `.claude/commands/mekong.md`

Wraps Mekong CLI binary (`mekong` at `/Users/macbookprom1/.local/bin/mekong`) so Sophia founder can invoke Mekong's SDLC commands without leaving Sophia's repo context.

Examples from Sophia repo:
```
/mekong spec new tier-upgrade-nudge       # creates spec doc in Mekong repo
/mekong design tier-upgrade-nudge          # creates design doc
/mekong code tier-upgrade-nudge            # implements (in Mekong's CI/CD)
/mekong deploy tier-upgrade-nudge          # deploys via Mekong's pipeline
/mekong metrics                            # view Mekong local signals
/mekong eval-agent cto                     # evaluate Sophia's CTO agent quality
```

### 3. Cross-repo observability link

**When Docker activated on M1 Max:**
- Sophia logs → Better Stack (Logtail HTTPS)
- Mekong metrics → Prometheus → Grafana at `grafana.m1max.cashclaw.cc`
- Both events tagged with `commit_sha` (Sophia P2 D1 column = Mekong OTel attribute)
- Cross-correlation: when error rate spikes in Sophia, Mekong's Grafana shows agent-level breakdown (which agent caused the spike, what model used, what tokens spent)

**Until Docker activated:** Sophia uses Better Stack standalone. Mekong observability is dormant.

### 4. Signals merge (deferred)

When Mekong reaches >50 customers (per audit `next phase`), Mekong will ship PostHog SaaS integration. At that point:
- Sophia + Mekong push to SAME PostHog project
- Tier funnels merge: Sophia user adopting Mekong CLI = single funnel "RaaS adoption"
- Weekly digest cron consolidates both products' signals into one founder report

Until then: Sophia's PostHog and Mekong's SQLite stay isolated.

---

## When to use which

### Use Sophia C-Level (`/sophia`) when
- Business decision (CMO copy, CSO pricing, COO support)
- Cross-domain task that touches Sophia codebase only
- Quick founder query without formal SDLC overhead

### Use Mekong SDLC (`/mekong spec/design/code/deploy`) when
- Building NEW feature with formal specification → design → code → deploy lifecycle
- Need Mekong's CI/CD gates + observability for the change
- Cross-repo work (touches Mekong repo)

### Use both in sequence
1. `/sophia "tăng PREMIUM lên $499 và A/B test"` → CSO + CTO draft proposal
2. `/mekong spec new pricing-499-ab` → formal spec
3. `/mekong design pricing-499-ab` → architecture
4. `/mekong code pricing-499-ab` → implementation
5. `/mekong deploy pricing-499-ab` → canary deploy
6. `/sophia "monitor pricing-499-ab launch + report week 1"` → COO ops report

---

## Bridge versioning

| Component | Version | Notes |
|---|---|---|
| Mekong CLI binary | v3.3.0+ | Verify: `mekong --version` |
| Mekong CLI repo | PR #67+#68 merged 2026-04-17 | All 5 gates passing |
| Sophia bridge | This doc + symlink + `/mekong` slash | Created 2026-04-17 |
| Mekong `.mekong/phases/` | Stable schema | Backward-compatible changes only |

---

## Future deepening (deferred)

1. **MCP server** — Mekong exposes its CLI as MCP server, Sophia connects via `.mcp.json`. Replaces CLI shell-out with structured tool calls.
2. **Shared agent journal** — Sophia's `.sophia-factory/journal/` and Mekong's `data/signals.sqlite` merge into a single audit DB.
3. **Vertical templates** — Mekong ships `mekong vertical sophia` command that scaffolds a Sophia-style RaaS in any new repo.
4. **C-Level Mekong agents** — Mekong adopts Sophia's C-Level pattern (currently Sophia-only).

---

## Maintenance

- Sophia bridge files = `.claude/commands/mekong.md` + `.sophia-factory/mekong-bridge/phases` (symlink) + this doc
- Mekong canonical files = `~/mekong-cli/.mekong/phases/` + `~/mekong-cli/src/cli/commands/`
- If Mekong CLI moves to new path, update `.sophia-factory/mekong-bridge/phases` symlink
- Document major bridge changes in BOTH repos' changelogs

---

**Last verified:** 2026-04-17 08:35 ICT
**Sophia commit:** `b8e6dd9` (ClaudeKit agents wired)
**Mekong commit:** `1dc02eb06` (PR #68 — gates green)
**Author:** /cook claudekit deep + mekong-cli session
