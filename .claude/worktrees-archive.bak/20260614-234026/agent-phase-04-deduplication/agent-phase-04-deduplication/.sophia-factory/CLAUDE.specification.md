---
phase: 1
title: "Specification — Requirements Gathering"
description: |
  [VN] Giai đoạn 1: Thu thập và làm rõ yêu cầu từ founder. Output là file requirement.md đã điền đầy đủ.
  [EN] Phase 1: Gather and clarify requirements from founder. Output is a filled requirement.md.
input: "Founder's raw request (1 sentence to 1 paragraph)"
output: ".sophia-factory/templates/requirement.md (filled)"
next-phase: ".sophia-factory/CLAUDE.design.md"
---

# Phase 1 — Specification

## Purpose
Transform a raw founder request into a structured, unambiguous requirement document that any agent (CTO/CMO/CSO/COO) can act on without further clarification.

## Agent Instructions

You are acting as a **Requirements Analyst**. Your job is to ask the right clarifying questions, then produce a filled `requirement.md`.

### Step 1 — Parse the Request

Extract from the founder's message:
- **What**: the feature, change, or initiative requested
- **Why**: business reason (if stated or implied)
- **Who**: which users or systems are affected
- **When**: urgency / deadline (if stated)
- **Constraints**: budget, tech stack limits, non-negotiables

### Step 2 — Identify Gaps

Before drafting, check these:
- [ ] Is the scope clear? (what's IN vs OUT)
- [ ] Is the success metric defined? (how will we know it's done?)
- [ ] Are there protected flows to avoid breaking? (Setup Wizard, Telegram bot, NOWPayments)
- [ ] Does this touch multiple domains? (needs orchestrator routing)
- [ ] Is there a security implication? (auth, BYOK, PII)

If any gap is critical → ask founder ONE consolidated clarifying question (not multiple rounds).

### Step 3 — Fill Requirement Template

Open `.sophia-factory/templates/requirement.md` and fill all sections.
Save as: `plans/{YYYYMMDD}-{slug}/requirement.md`

### Step 4 — Validate

Before handing off to Phase 2:
- [ ] All mandatory fields filled (no `TBD` in critical sections)
- [ ] Success criteria are measurable
- [ ] Out-of-scope explicitly stated
- [ ] Security considerations noted

### Step 5 — Journal

Write `.sophia-factory/journal/YYYYMMDD-specification-{slug}.md`:
```
## Action: Requirements gathering for "{request title}"
## Decision: {key scope decisions made}
## Outcome: requirement.md saved to plans/{slug}/
## Lessons: {any ambiguity pattern to watch for next time}
```

## Handoff to Phase 2

Pass to `CLAUDE.design.md`:
- Link to filled `requirement.md`
- One-line summary: "Build X for Y because Z"
- Any constraints the designer must respect

## Anti-Patterns to Avoid
- Do NOT design or code during specification — that's Phase 2/3.
- Do NOT ask for more info than needed — one round of Q&A max.
- Do NOT duplicate content from `.claude/rules/` — reference it.
- Do NOT include pricing or customer PII in requirement docs.
