# 🏆 Sophia AGI Hardening + Production Certification — CC CLI /cook Task

## OBJECTIVE

Đạt AGI 100/100 — Final hardening, type-safety audit, production readiness.
Sophia phải zero `:any`, zero lint errors, all tests pass, fully documented.

## CURRENT STATE (Post-Injection)

- ✅ OpenClaw gateway injected (7 files)
- ✅ Auto-discovery engine (1 file + Inngest cron)
- ✅ Supabase Auth (real, no mock)
- ✅ 12 docs created
- ✅ 145/145 tests pass
- ✅ Build 0 errors
- ✅ 6 commits pushed

## PHASE 1: Type-Safety Audit (Zero `:any`)

### 1.1 Scan ALL TypeScript files for `:any`

```bash
cd apps/sophia-ai-factory && grep -rn ": any\|:any\| as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

### 1.2 Fix ALL `:any` occurrences

Replace every `:any` with proper types:

- Use existing type definitions from `@/types`
- Create new interfaces where needed
- Use `unknown` + type guards instead of `any`
- NEVER leave any `:any` in production code

### 1.3 Verify with strict TypeScript

```bash
cd apps/sophia-ai-factory && npx tsc --noEmit --strict
```

## PHASE 2: Lint + Code Quality

### 2.1 Run ESLint

```bash
cd apps/sophia-ai-factory && npx eslint src/ --fix
```

### 2.2 Check for unused imports/exports

```bash
cd apps/sophia-ai-factory && npx eslint src/ --rule 'no-unused-vars: error'
```

### 2.3 Verify all new gateway/discovery files have proper exports

- `src/lib/gateway/index.ts` — must export ALL gateway components
- `src/lib/discovery/` — must export scorer
- All adapters must implement ChannelAdapter interface

## PHASE 3: Test Coverage + New Tests

### 3.1 Run existing tests

```bash
cd apps/sophia-ai-factory && npx vitest run
```

### 3.2 Add tests for new modules

Create tests for:

- `src/lib/gateway/openclaw-gateway.test.ts` — gateway lifecycle tests
- `src/lib/gateway/smart-resume-engine.test.ts` — checkpoint/resume tests
- `src/lib/discovery/affiliate-ai-scorer.test.ts` — scoring algorithm tests

### 3.3 Verify ALL tests pass

```bash
cd apps/sophia-ai-factory && npx vitest run --reporter=verbose
```

## PHASE 4: Documentation Completeness

### 4.1 Update `docs/handover-documentation-index.md`

Add entries for:

- OpenClaw gateway module
- Smart Resume engine
- Auto-discovery engine
- Channel adapters

### 4.2 Update `CLAUDE.md` with new architecture

Add sections:

- Gateway module structure
- Smart Resume pattern
- Auto-discovery cron schedule
- Auth flow (Supabase Magic Link)

### 4.3 Create `docs/architecture-overview.md`

Complete system architecture doc:

- Component diagram
- Data flow
- Integration points (Supabase, Inngest, Telegram, OpenRouter, HeyGen, ElevenLabs)
- Deployment architecture

## PHASE 5: Build + Ship Final

1. `cd apps/sophia-ai-factory && npx next build` — MUST PASS
2. `npx vitest run` — MUST PASS (including new tests)
3. Git commit: `feat(hardening): AGI 100/100 certification — zero any, new tests, complete docs`
4. Git push to main
5. Print final AGI scorecard

## QUALITY GATE (AGI 100/100 Criteria)

| #   | Criterion               | Required |
| --- | ----------------------- | -------- |
| 1   | Zero `:any` types       | ✅       |
| 2   | Build passes            | ✅       |
| 3   | ALL tests pass          | ✅       |
| 4   | Gateway module complete | ✅       |
| 5   | Smart Resume engine     | ✅       |
| 6   | Auto-discovery cron     | ✅       |
| 7   | Real Supabase Auth      | ✅       |
| 8   | Non-tech docs (12+)     | ✅       |
| 9   | Architecture docs       | ✅       |
| 10  | CLAUDE.md updated       | ✅       |
| 11  | Telegram bot functional | ✅       |
| 12  | Channel adapters        | ✅       |
| 13  | i18n complete (en+vi)   | ✅       |
| 14  | Committed & pushed      | ✅       |

## RULES

- ZERO `:any` tolerance — fix ALL instances
- Use TypeScript strict mode
- All new code must have tests
- Docs must be song ngữ (Việt + English) where applicable
- DO NOT break existing functionality
