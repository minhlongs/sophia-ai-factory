# Sophia AI Video Factory — Zero Manual Content Production SaaS

> **第五篇 兵勢 (Bing Shi)** — Force multipliers: momentum through automation
>
> This file governs CC CLI behavior ONLY when working inside `apps/sophia-ai-factory/`.
> Inherits from root `CLAUDE.md` (Constitution) and `~/.claude/CLAUDE.md` (Global).

### Tech Stack
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres + Auth + Storage + RLS) |
| Payments | Polar.sh (subscriptions, webhooks) |
| Background Jobs | Inngest |
| AI Router | OpenRouter |
| Video Gen | HeyGen |
| Voice Gen | ElevenLabs |
| Bot | Telegram (Telegraf, webhook mode) |
| i18n | next-intl |

### Architecture
- App Router + Server Actions + Supabase RLS + Inngest orchestration
- Tier system: BASIC / PREMIUM / ENTERPRISE (strict uppercase enum)
- The Turnkey Standard: Setup Wizard → Build Full → Unlock via Flags

### API Routes
- `/api/health` — Health check
- `/api/webhooks/polar` — Polar payment webhooks
- `/api/webhooks/telegram` — Telegram bot webhook
- `/api/inngest` — Inngest function runner

### Gateway Module (OpenClaw)
- `src/lib/gateway/` — Multi-channel content distribution with self-healing
- `OpenClawGateway` class: register channels, distribute, healthCheck, selfHeal
- Channel adapters: YouTube, TikTok, Telegram (in `gateway/adapters/`)
- Retry: exponential backoff with jitter (configurable RetryPolicy)

### Smart Resume Engine
- `src/lib/gateway/smart-resume-engine.ts` — Checkpoint-based pipeline recovery
- Pipeline steps: notify-start → generate-script → generate-voiceover → start-video-generation → poll-video-status → distribute-channels → finalize-campaign
- Currently in-memory Map storage (TODO: migrate to Supabase `campaign_checkpoints` table)
- Used by `generate-campaign` Inngest function for resume-from-failure

### Auto-Discovery (Inngest Cron)
- `src/lib/inngest/functions/auto-discover-affiliates.ts` — Daily 8AM UTC cron
- Scores affiliate programs via `src/lib/discovery/affiliate-ai-scorer.ts` (deterministic, no AI calls)
- SPS scoring in `src/lib/intelligence/scoring.ts` (commission + popularity + reliability weights)
- Stores high-scoring results in Supabase `affiliate_products` table
- Sends summary to admin via Telegram

### Ingestion Adapters
- `src/lib/ingestion/` — Affiliate product ingestion from external networks
- Adapters: `clickbank-adapter.ts`, `shareasale-adapter.ts` (Amazon planned)
- Base adapter pattern: `IngestionAdapter` interface with `fetchProducts()`
- Raw products normalized into `RawProduct` type before scoring

### Auth Flow
- Supabase Magic Link (no password) via `src/lib/auth.ts`
- Login page: `/[locale]/login` → sends magic link email
- Auth callback: `/auth/callback` → exchanges code for session
- Admin invite: `POST /api/admin/invite` (Basic Auth gated, requires `ADMIN_USER`/`ADMIN_PASS`)
- Tier stored in `user_metadata.tier` (BASIC default)
- Middleware: i18n + setup wizard redirect + admin basic auth + dashboard auth guard

### Known Gotchas
- HeyGen polling takes 1-3min per video
- Supabase type assertions needed for RLS queries
- `API_ENCRYPTION_KEY` env var required for key encryption
- Tier enum must be UPPERCASE: BASIC, PREMIUM, ENTERPRISE
- Smart Resume engine uses in-memory storage (resets on deploy)

### Quality Standard
- 100/100 Diamond Standard
- All tests must pass before commit
- Zero `:any` TypeScript types

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**

```json
{
  "questions": [
    {
      "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
      "header": "File Access",
      "options": [
        {
          "label": "Yes, approve access",
          "description": "Allow reading .env this time"
        },
        {
          "label": "No, skip this file",
          "description": "Continue without accessing this file"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:

- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization

- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** _MUST READ_ and _MUST COMPLY_ all _INSTRUCTIONS_ in project `./CLAUDE.md`, especially _WORKFLOWS_ section is _CRITICALLY IMPORTANT_, this rule is _MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!_

## /insights Command (Added 2026-02-05)

Use `/insights` to summarize and review all work done in this session for workflow improvement.

## Binh-Pháp Strategic Flexibility

**始計 (Strategic Assessment)** - Assess each task individually, don't auto-bypass. Let strategic questions surface appropriate choices based on situation.


---

## 🚀 AGENT TEAMS + BMAD (Feb 2026)

**Enabled:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**Workflow:** `/plan:hard` → `"Gọi team thực hiện plan này"`

**BMAD:** 169 workflows + 9 agents in `_bmad/`

---

## Binh Pháp Agent Rules (Feb 2026)

| Chapter | Rule |
|---------|------|
| 始計 | Strategic assessment đầu tiên |
| 謀攻 | PHẢI dùng /command để giao việc |
| 兵勢 | Agent Teams parallel execution |
| 九變 | BMAD 169 workflows |
| 火攻 | Verify trước khi báo cáo |

**Combo:** BMAD planning → Agent Teams → Verify
