---
description: Sophia-aware meta-orchestrator. Detects task type, routes to right primitive. Single entry point for all Sophia work.
---

# /pilot — Sophia Navigator

Single entry point for Sophia-AI-Factory work. Phân tích task description và dispatch đến primitive đúng. Auto-load Sophia context.

## Usage

```
/pilot <task description>
```

## Routing decision tree

| Task keywords | Dispatch | Reason |
|---|---|---|
| "audit", "scan", "find", "list", "check" | `/scout` | Read-only investigation |
| "plan", "design", "architecture", "spec" | `/plan` | Pre-implementation planning |
| "implement", "build", "add", "fix", "refactor", "create", "update" | `/cook` | Full implementation pipeline |
| "debug", "error", "broken", "failing", "why" | `/debug` | Root cause analysis |
| "review", "before merge", "code quality" | `/review` | Quality gate |
| "test", "verify", "coverage", "run tests" | `/test` | Test execution |
| "deploy", "ship", "release" | `npm run deploy:full` + SHA verify | CF-direct doctrine, no GitHub Actions |
| 3+ distinct concerns | `/cook --parallel` | Multi-agent orchestration |

**Tie-breaker:** plan → cook → review.

## Decision flow

```
/pilot "<task>"
  │
  ├─ "deploy"/"ship"? → npm run deploy:full → verify SHA
  ├─ "debug"/"error"/"broken"? → /debug
  ├─ "review"/"before merge"? → /review
  ├─ "test"/"verify" (test-only)? → /test
  ├─ "audit"/"scan"/"find" (read-only)? → /scout
  ├─ "plan"/"design"/"spec"? → /plan
  ├─ 3+ concerns? → /cook --parallel
  └─ default (implement/build/fix)? → /cook
```

## Sophia context (auto-loaded)

Mọi dispatch carry context này:

1. **Tiers:** `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase, single source `@/config/tiers`)
2. **BYOK:** Per-user API keys (OpenRouter, Anthropic, ElevenLabs, D-ID) encrypted via `BYOK_MASTER_KEY` D1 store
3. **Payments:** NOWPayments (USDT crypto) primary; PayOS Vietnam backup. **Polar.sh PERMANENTLY REJECTED.**
4. **Promo FREE100:** Lifetime MASTER. 50 max, 1/user. Table `promo_codes`.
5. **Telegram bot:** `@Sophia_Bbot`. Pairing via `telegram_paired_chats`. Protected flow (`/campaign`, `/status`, `/results`).
6. **Deploy:** CF-direct via `npm run deploy:full` (wrangler). GitHub Actions disabled since 2026-05-03.
7. **Auth:** `getCurrentUser()` from `@/lib/better-auth-session` (NEVER `@/lib/auth`).
8. **DB:** `createServerClient()` from `@/lib/db/client` — synchronous, NO `await`.
9. **i18n:** Bilingual VI+EN required. Files `messages/{vi,en}.json`.
10. **Layer:** seed/tree/forest/land 4-layer. See `cross-layer-orchestration.md` for forest→land exception.

## Examples

```
/pilot "Setup wizard step 5 broken — D1 foreign key error"
→ /debug  (matched "broken" + "error")

/pilot "Add referral leaderboard for MASTER tier"
→ /plan first → /cook with output

/pilot "Audit how FREE100 redeem creates handover"
→ /scout  (read-only)

/pilot "Implement promo email retry + tests + changelog"
→ /cook --parallel  (3 concerns)

/pilot "Deploy current main"
→ npm run deploy:full + SHA verify via /api/version

/pilot "Review NOWPayments IPN before merge"
→ /review
```

## Guard rails (MANDATORY)

1. NEVER use Polar.sh — NOWPayments / PayOS only
2. ALWAYS verify deploy SHA: `/api/version` shortSha = `git rev-parse HEAD | cut -c1-8`
3. ALWAYS validate tier against enum BASIC|PREMIUM|ENTERPRISE|MASTER
4. NEVER hardcode API keys — use BYOK D1 + env
5. ALWAYS bilingual VI+EN cho user-facing strings
6. Zero `:any` TypeScript types
7. `npm run build` exit 0 trước deploy

## Khi không dùng /pilot

- Đã biết primitive cần thiết → call trực tiếp `/scout` etc.
- Quick lookup → grep/glob
- Conversation/Q&A → just talk

## References

- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` — deploy doctrine
- `apps/sophia-ai-factory/.claude/rules/sophia-handover-rules.md` — protected flows
- `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` — 4-layer
- `apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md` — forest→land rule
- `apps/sophia-ai-factory/.claude/rules/binh-phap-{core,quality,cicd,workflow,memory-practices}.md` — strategy suite
