---
description: 🏭 Sophia Factory — invoke C-Level agent (orchestrator routes by intent)
argument-hint: [request — natural language]
---

# Sophia Factory — C-Level Orchestrator Invocation

[VN] Bạn là chủ công ty Sophia AI Factory. Yêu cầu của bạn sẽ được orchestrator phân tích và route đến đúng C-Level agent.
[EN] You're the Sophia AI Factory founder. Your request will be analyzed by the orchestrator and routed to the right C-Level agent.

## Request
<request>$ARGUMENTS</request>

## Routing rules (orchestrator decides)

| Intent keywords | Route to | Agent file |
|---|---|---|
| audit, security, code review, infra, deploy, incident, performance, type error | **CTO** | `.sophia-factory/agents/cto.md` |
| copy, blog, SEO, social, brand, landing, marketing campaign, content | **CMO** | `.sophia-factory/agents/cmo.md` |
| outreach, lead, pricing, sale, churn, upsell, demo, conversion | **CSO** | `.sophia-factory/agents/cso.md` |
| process, automation, support, ticket, ops, dashboard, customer success | **COO** | `.sophia-factory/agents/coo.md` |
| cross-domain (touches 2+ above) | **Orchestrator coordinates** | spawn multiple in parallel |

## Workflow

1. Read user request from `$ARGUMENTS`
2. Read orchestrator definition: `.sophia-factory/orchestrator.md`
3. Classify intent against routing table above
4. Use `Task` tool to spawn the correct C-Level agent (subagent_type matching `sophia-cto`, `sophia-cmo`, `sophia-cso`, or `sophia-coo` from `.claude/agents/`)
5. Pass full context to spawned agent: request + relevant file paths from agent's `allowed-paths` glob
6. Append journal entry to `.sophia-factory/journal/{YYYY-MM-DD}-{agent}-{action-slug}.md` AFTER agent completes (PII-scrubbed)
7. Report agent's findings back to founder

## Sandbox enforcement (Red Team #14)

- C-Level agents have NO `Write` tool (only Read/Edit/Grep/Glob/Bash)
- Each agent constrained by `allowed-paths` glob in its frontmatter
- Only orchestrator (this skill) can spawn agents via Task
- Journal entries are PII-scrubbed before commit (use `scrubPII` from `apps/sophia-ai-factory/src/lib/telemetry/pii-scrubber.ts` pattern)

## Examples

```
/sophia "audit security headers in middleware.ts"
→ CTO agent reads middleware.ts, reports CSP/HSTS state

/sophia "viết blog post về Sophia BYOK architecture, bilingual VN+EN"
→ CMO agent writes apps/sophia-ai-factory/src/app/(marketing)/blog/byok-architecture/page.tsx

/sophia "tăng giá tier PREMIUM lên $499 và A/B test"
→ CSO agent updates pricing config + creates A/B experiment

/sophia "tổng hợp tickets tuần qua + suggest top 3 process fixes"
→ COO agent reads support tickets, drafts process improvements
```

## Plan & docs reference
- Plan: `plans/260416-2328-sophia-factory-raas-solo-platform/plan.md`
- Activation runbook: `docs/sophia-activation-runbook.md`
- Architecture: `docs/system-architecture.md`
