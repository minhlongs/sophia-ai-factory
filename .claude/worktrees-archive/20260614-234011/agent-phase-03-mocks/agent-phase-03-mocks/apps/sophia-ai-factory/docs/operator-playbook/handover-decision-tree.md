# Handover Decision Tree — Which Command, When

> **Goal:** Ship Sophia to end users "green go-live, zero bug" (honest = 87.5/100 ceiling per doctrine v1.28.1, not literal zero).
> **Audience:** Operator + future maintainers who confuse between ClaudeKit, Mekong CLI, and project-specific commands.

---

## Honest framing first

**"Zero bug" doesn't exist.** Honest criterion = doctrine 87.5/100 ceiling:

| Layer | Score | Locked by |
|-------|-------|-----------|
| Code passes all gates | ✅ | tests + lint + typecheck + secrets + audit |
| Production HTTP 200 | ✅ | /api/version SHA match |
| Doctrine compliance | ✅ | BYOK no-tech, operator never holds customer creds |
| Ops track record | ⏸ | requires months of DR drills (NOT achievable via code) |

The remaining 12.5 points = **time + operational evidence**, not code work.

**Stop chasing literal zero-bug.** Ship at 87.5 with smoke test passed + first 10 customers acquired.

---

## State Machine: Handover Phases

```
┌─────────────────────────────────────────────────────────────┐
│  A. Code stabilize     → DONE (commit 991b8bce, 87.5/100)   │
│  B. Smoke test        → IN PROGRESS (operator-led, $30-100) │
│  C. Phase 06 prep     → NEXT (pricing+voice+content done)   │
│  D. Launch day        → 2-4 weeks out                       │
│  E. Post-launch iter  → 6-12 weeks of customer feedback     │
└─────────────────────────────────────────────────────────────┘
```

You are at **A → B transition**. Most commands you need are NOT slash commands — they're operator-manual work.

---

## Command Map: Intent → Command

### Decision rule first

```
Intent type?
├─ Code work (add/modify/fix files) ─────────────→ /cook
├─ Plan complex change ──────────────────────────→ /plan:hard (deep) | /plan:fast (quick)
├─ Debug specific error ─────────────────────────→ /debug
├─ Validate code quality ────────────────────────→ /review
├─ Find code by pattern ─────────────────────────→ /scout
├─ Run tests ────────────────────────────────────→ /test
├─ Commit + push ────────────────────────────────→ /check-and-commit (or manual git)
├─ Deploy ───────────────────────────────────────→ npm run deploy:full (NO slash command)
├─ Operator decision ────────────────────────────→ /brainstorm (interactive scoring)
├─ Generate docs ────────────────────────────────→ /docs
├─ Project status ───────────────────────────────→ /raas (mekong) | TaskList
└─ Don't know? ──────────────────────────────────→ /ask or just describe in plain text
```

### Full command catalog (global + mekong + Sophia)

**Global (~/.claude/commands/) — works in any project:**

| Command | Use when |
|---------|----------|
| `/ask` | Quick Q&A, no code change |
| `/brainstorm` | Multi-option decision needs structured exploration |
| `/cook <task>` | Implement / build / fix anything |
| `/plan:hard <task>` | Complex feature needs deep planning before code |
| `/plan:fast <task>` | Quick task needs lightweight plan |
| `/debug <error>` | Diagnose specific bug |
| `/review` | Code review (security/perf/correctness) |
| `/scout <pattern>` | Find code by intent |
| `/test` | Run test suite |
| `/docs` | Generate / update documentation |
| `/fix <issue>` | Apply known fix |
| `/git` | Git operations |
| `/preview` | Visualize change (diagram/diff) |
| `/remember <fact>` | Persist memory |
| `/save` | Save state |

**Mekong CLI (mekong-cli/.claude/commands/) — works ONLY when CWD is mekong-cli project:**

| Command | Use when |
|---------|----------|
| `/ship` | Deploy to production (mekong workflow) |
| `/scaffold` | Scaffold new component |
| `/binh-phap` | Strategic analysis (孫子兵法 framework) |
| `/commander` | Top-level orchestration |
| `/daily` | Daily ops checklist |
| `/quantum` | Quantum operations |
| `/revenue` | Revenue ops |
| `/ui-check` | UI validation |
| `/recover` | Recovery from broken state |

**Sophia project (apps/sophia-ai-factory/.claude/commands/, if exists):**

Project-specific commands live in `.claude/commands/`. Check via `ls .claude/commands/` from project root.

---

## Sophia Handover — Step-by-Step Command Usage

### Phase A: Code Stabilize (DONE — for reference)

What was actually used to reach 87.5/100:

```
/scout codebase tech debt        → identify TODOs/FIXMEs
/plan:hard <feature>             → architect each major change
/cook <plan-path> --auto         → execute plans (8 done this session)
/review                          → audit security/perf
/test                            → 4431/4431 must pass
npm run deploy:full              → deploy via wrangler
curl /api/version                → verify SHA match
```

This phase is **DONE**. Do not re-run unless smoke test reveals real bug.

### Phase B: Smoke Test (CURRENT — operator-led)

**Code commands needed: ~0.** Smoke is operator work.

| Need | Command / Action |
|------|------------------|
| Procure BYOK keys | NO command — manual signup (`procurement` guide) |
| Setup Wizard run | NO command — manual UI walkthrough |
| Trigger test campaign | NO command — Telegram `/campaign` (bot, not Claude) |
| Report blocker to Claude | "describe error" in chat — NOT a slash command |
| Diagnose error | `/debug <error message>` IF you know the file path |

**Key insight:** During Phase B you mostly talk to Claude in PLAIN TEXT. Slash commands are for code action, not status updates.

### Phase C: Phase 06 Prep (NEXT)

| Need | Command |
|------|---------|
| Implement split test infra (#153) | `/cook split test routing` |
| Fill brand voice / content docs | NO command — operator content work |
| Final QA pass | `/review` parallel |
| Pre-launch checklist | Read `phase-06-prep-checklist.md` |

### Phase D: Launch Day (2-4 weeks out)

| Need | Command / Action |
|------|------------------|
| Final deploy | `npm run deploy:full` (NOT a slash) |
| Verify production | `curl https://sophia.agencyos.network/api/version` |
| Mekong ship if applicable | `/ship` (only if you cd into mekong-cli project) |
| Monitor errors | `npx wrangler tail` (NOT a slash) |
| Hot-fix | `/cook fix <issue>` |
| Rollback | `npx wrangler rollback` (NOT a slash) |

### Phase E: Post-launch Iterate (6-12 weeks)

| Customer reports... | Command |
|--------------------|---------|
| Bug | `/debug <error>` → `/cook fix` |
| Feature request | `/plan:hard <feature>` → `/cook` |
| Performance issue | `/scout` to find hotspot → `/cook optimize` |
| UX confusion | NO command — operator UX research first |

---

## "I don't know which command" → 4-step recovery

When stuck:

1. **State your intent in PLAIN TEXT** ("I need to fix X" or "How do I Y")
   - Claude infers the right command from intent
2. **Try `/ask <question>`** — non-committal Q&A
3. **Check `ls ~/.claude/commands/`** — list available globally
4. **Check `ls .claude/commands/`** — list project-specific

You don't need to memorize every command. Slash commands are conveniences, not requirements. Plain English with file paths works fine.

---

## Anti-Pattern: Don't /cook For Everything

Trap: "next /cook" momentum addiction. Code-side ceiling (87.5/100) is **reached**. Forcing more `/cook` after ceiling = diminishing returns + risk of regression.

**Stop signal:**
- Tests 4431/4431 pass for 3+ runs
- Doctrine ceiling reached
- No customer-reported bugs
- Operator phase started (smoke test)

**At stop signal: switch from `/cook` to plain-text operator dialog.** This session has 11 commits already — anything more is likely premature unless smoke test data demands it.

---

## Sophia-Specific Decision Tree

For Sophia AI Factory specifically right now:

```
Are you the operator?
├─ YES
│  ├─ Smoke test stuck? ─────────→ Paste error in chat (no command)
│  ├─ Need pricing decision? ────→ /brainstorm pricing
│  ├─ Need content draft? ───────→ Plain-text: "draft blog #X outline"
│  ├─ Want to commit operator doc?→ Plain-text: "commit doc"
│  ├─ Ready for Phase 06 launch? ─→ Read `phase-06-prep-checklist.md`
│  └─ Status check? ──────────────→ TaskList or plain-text "status"
│
└─ NO (CC CLI / maintainer)
   ├─ New feature needed? ────────→ /plan:hard → /cook
   ├─ Bug from customer? ─────────→ /debug → /cook fix
   ├─ Audit codebase? ────────────→ /scout → /review
   ├─ Deploy hotfix? ─────────────→ npm run deploy:full (after /cook)
   └─ Don't know? ────────────────→ /ask
```

---

## Glossary

| Term | Definition |
|------|------------|
| **ClaudeKit** | Anthropic's official skill/command framework (~/.claude/commands/) |
| **Mekong CLI** | Custom agentic-OS layer (~/projects/mekong-cli/.claude/) |
| **Slash command** | `/<name>` prefix invoking a skill |
| **Doctrine ceiling** | 87.5/100 per `sophia-no-tech-doctrine.md` |
| **Green go-live** | Doctrine ceiling reached + smoke test passed + production SHA match |
| **Zero-bug** | **Aspirational, not literal.** Honest version = "no known bugs at ship time + monitoring in place" |
| **BYOK** | Bring Your Own Keys — customer self-inputs all API keys |

---

## Reference Files

- `~/.claude/CLAUDE.md` — Global instructions + command map (lines ~430-490)
- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` — Deploy doctrine
- `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` — Score ceiling rationale
- `docs/operator-playbook/smoke-test-walkthrough.md` — Phase B canonical
- `docs/operator-playbook/phase-06-prep-checklist.md` — Phase D gates
- `docs/operator-playbook/pricing-trial-decision-matrix.md` — Operator decision pattern

---

## Unresolved

1. **No automated "green go-live gate" CLI** — current verification is multi-step manual (lint + test + typecheck + audit + SHA match + smoke). Consider scripting as `npm run verify:green` if friction observed in maintenance.
2. **Mekong `/ship` not used by Sophia** — Sophia uses `npm run deploy:full` directly (CF-direct doctrine). Document why if mekong adoption considered later.
3. **Project-level `.claude/commands/`** for Sophia is empty — no custom Sophia commands yet. Operator may want to scaffold project-specific shortcuts (e.g., `/sophia:smoke`, `/sophia:status`).
4. **"What command did I just run?"** — no audit log. If operator wants traceability, consider `~/.claude/.history.log` or similar.
