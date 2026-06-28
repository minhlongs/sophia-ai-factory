# Phase 02 — SOP Execution Engine + Scheduler Cron

## Context Links

- Plan: [./plan.md](./plan.md)
- Depends: Phase 01 (sop-repo, schema)
- Existing engine: `apps/sophia-ai-factory/src/lib/missions/dispatcher.ts`, `command-registry.ts`
- Existing cron pattern: `apps/sophia-ai-factory/src/lib/cron/*` + `scripts/inject-scheduled-handler.mjs`
- Wrangler config: `apps/sophia-ai-factory/wrangler.jsonc` (`triggers.crons[]`)

## Overview

- Priority: P1
- Status: pending
- Effort: 16h
- Description: Engine that parses agents.yaml + playbook.md, dispatches each step as mission via existing engine, validates output against JSON schema, persists run history. Scheduler cron polls due installations every 5 min. Webhook trigger endpoint for reactive SOPs.

## Key Insights

- DO NOT rebuild dispatch — wrap existing mission dispatcher. Auth, credits, circuit-breaker stay intact.
- Playbook MD = ordered steps. Convention: `## Step N: command:name` headers + YAML code-fence with input args.
- Async pattern: dispatch mission → poll mission status (mission engine already supports SSE/poll) → collect result.
- Cron `*/5 * * * *` claims at most N=20 due installs per tick to avoid pile-ups.
- Idempotent run creation — `(installation_id, trigger_type, scheduled_minute)` UNIQUE prevents double-fire on cron retry.
- Webhook trigger uses HMAC-signed URL per installation (rotation supported in Phase 3).

## Requirements

### Functional
- F1: `runSop(installationId, triggerContext)` orchestrates full lifecycle.
- F2: Parse agents.yaml (3-tier HDR Tier 1) → typed agent map.
- F3: Parse playbook.md → ordered step list `[{order, command, args, dependsOn?}]`.
- F4: Dispatch each step as mission, await completion, collect outputs.
- F5: Validate aggregate result against `output_schema` (JSON Schema draft-07 — use `ajv` already in repo if present, else `zod-to-json-schema` reverse).
- F6: Cron handler claims due installations, kicks runs in parallel (Promise.allSettled).
- F7: Webhook endpoint `POST /api/v1/sop/[installationId]/trigger` validates HMAC, queues run.
- F8: Run lifecycle: queued → running → succeeded | failed | partial.

### Non-Functional
- File size ≤200 LOC each — split executor into parser + runner + validator modules.
- Zero `:any`.
- Cron tick must complete in ≤30s (CF Workers cron limit). If queue >20, defer rest to next tick.
- No console.log — use existing structured logger in `src/lib/logger` (or whatever pattern exists).

## Architecture

```
[Cron */5 * * * *]                         [Webhook /api/v1/sop/[id]/trigger]
        │                                              │
        ▼                                              ▼
   claimDueInstallations(now, 20)              verifyHmac → loadInstallation
        │                                              │
        └──────────────┬──────────────┬────────────────┘
                       ▼              ▼
                   runSop(installationId, triggerCtx)
                       │
                       ├─ load template + customizations  (sop-repo)
                       ├─ parseAgentsYaml(agents_yaml)
                       ├─ parsePlaybook(playbook_md) → steps[]
                       ├─ createRun(...) status='running'
                       ├─ for each step:
                       │     dispatchMission(userId, command, args, runContext)
                       │     await missionResult                ← existing engine
                       │     appendMissionId(runId, missionId)
                       ├─ validateOutput(aggregateResult, schema)
                       ├─ updateRunStatus(succeeded|failed|partial)
                       └─ advanceSchedule(installationId, last, next)
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/sop/executor/agents-yaml-parser.ts` — parse YAML → typed
- `apps/sophia-ai-factory/src/lib/sop/executor/playbook-parser.ts` — parse Markdown → steps
- `apps/sophia-ai-factory/src/lib/sop/executor/output-validator.ts` — JSON Schema validate
- `apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts` — main `runSop()`
- `apps/sophia-ai-factory/src/lib/sop/executor/index.ts` — barrel
- `apps/sophia-ai-factory/src/lib/sop/executor/types.ts` — ParsedAgents, ParsedStep, RunContext
- `apps/sophia-ai-factory/src/lib/cron/sop-scheduler.ts` — cron handler
- `apps/sophia-ai-factory/src/lib/sop/webhook-hmac.ts` — sign + verify helpers
- `apps/sophia-ai-factory/src/app/api/v1/sop/[installationId]/trigger/route.ts` — POST endpoint
- `apps/sophia-ai-factory/src/app/api/cron/sop-scheduler/route.ts` — internal cron route (idempotent token-gated)
- Tests: one `*.test.ts` per parser/runner/validator (4 files), one integration `sop-runner-integration.test.ts`.

### Modify
- `apps/sophia-ai-factory/wrangler.jsonc` — add cron trigger `*/5 * * * *` mapped to scheduled handler.
- `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` — register `/api/cron/sop-scheduler` route.
- (Optional) `apps/sophia-ai-factory/src/lib/missions/dispatcher.ts` — expose internal `dispatchMissionInternal(userId, command, args, opts)` if not already callable from non-HTTP context. Read first; only modify if necessary.

## Implementation Steps

1. **Parser modules** — implement before runner.
   - `agents-yaml-parser.ts`:
     ```ts
     import yaml from 'js-yaml';
     export interface ParsedAgent { role: string; goal: string; tools: string[]; backstory?: string; }
     export function parseAgentsYaml(src: string): Record<string, ParsedAgent> {
       const obj = yaml.load(src);
       // type-guard, throw on invalid
     }
     ```
   - `playbook-parser.ts`: split MD on `## Step N:` headers, extract YAML code-fences as args. Convention documented in seed playbooks.
2. **Output validator** — wrap `ajv` (or install if absent). Compile schema once per template, cache in module-level Map keyed by templateId.
3. **sop-runner.ts** core:
   ```ts
   export async function runSop(deps: { db, missionDispatcher, logger }, input: { installationId: string, trigger: 'cron'|'webhook'|'manual', triggerPayload?: unknown }): Promise<RunResult> {
     const inst = await getInstallation(...);
     const tpl = await getTemplateById(...);
     const agents = parseAgentsYaml(inst.customizations?.agents_yaml_override ?? tpl.agents_yaml);
     const steps = parsePlaybook(inst.customizations?.playbook_md_override ?? tpl.playbook_md);
     const run = await createRun(...);
     try {
       const stepResults = [];
       for (const step of steps) {
         const m = await missionDispatcher.dispatch({ userId: inst.userId, command: step.command, args: resolveArgs(step.args, stepResults, input.triggerPayload) });
         await appendMissionId(db, run.id, m.id);
         const result = await missionDispatcher.awaitCompletion(m.id, { timeoutMs: 5*60_000 });
         if (result.status === 'failed') throw new StepFailed(step.order, result.error);
         stepResults.push(result.output);
       }
       const aggregate = aggregateResults(stepResults, tpl.outputSchema);
       validateOutput(aggregate, tpl.outputSchema);
       await updateRunStatus(db, run.id, { status: 'succeeded', resultSummary: JSON.stringify(aggregate), completedAt: now() });
       await advanceSchedule(db, inst.id, now(), nextCronAt(inst.scheduleCron));
       return { runId: run.id, status: 'succeeded', summary: aggregate };
     } catch (e) {
       await updateRunStatus(db, run.id, { status: e instanceof StepFailed ? 'partial' : 'failed', errorMessage: stringifyError(e), completedAt: now() });
       throw e;
     }
   }
   ```
4. **`resolveArgs()` helper** — substitute `{{step_1.output.foo}}` patterns from prior step results, plus `{{trigger.body.email}}` for webhook payloads. Keep simple: regex-replace, no full template engine.
5. **Cron handler** `sop-scheduler.ts`:
   ```ts
   export async function handleSopSchedulerTick(env: Env, now: number) {
     const due = await claimDueInstallations(env.DB, now, 20);
     await Promise.allSettled(due.map(inst => runSop(deps, { installationId: inst.id, trigger: 'cron' })));
   }
   ```
6. **Cron route** `/api/cron/sop-scheduler/route.ts` — POST only, validates `X-Cron-Token` header against `env.CRON_TOKEN` (already exists in repo for other crons; reuse). Calls `handleSopSchedulerTick`.
7. **Webhook route** `/api/v1/sop/[installationId]/trigger/route.ts` — POST, validates HMAC of body using installation-specific secret stored in `customizations.webhookSecret` (generated at install time in Phase 03). Returns `{runId, status}` immediately, run executes async via `ctx.waitUntil(runSop(...))`.
8. **wrangler.jsonc** — add cron entry:
   ```jsonc
   "triggers": { "crons": [ /* existing */ , "*/5 * * * *" ] }
   ```
   Map to scheduled handler that fans out to `/api/cron/sop-scheduler` via internal fetch with token.
9. **Tests**:
   - `agents-yaml-parser.test.ts` — valid YAML + invalid throws.
   - `playbook-parser.test.ts` — 3 step playbook → 3 ParsedSteps with args.
   - `output-validator.test.ts` — valid + invalid against schema.
   - `sop-runner.test.ts` — mock dispatcher, assert sequence of dispatch calls + status transitions + advanceSchedule called on success.
   - `sop-runner-integration.test.ts` — real D1 (test helper), stub mission handlers that return canned results; assert run row succeeded + missionIds populated.
10. **Manual smoke** (post-deploy): install daily-content-factory for admin user, set `next_run_at = now-1`, observe cron tick → run row created + advances → mission rows visible in `/dashboard/missions`.

## Todo List

- [ ] agents-yaml-parser.ts + test
- [ ] playbook-parser.ts + test
- [ ] output-validator.ts + test (install ajv if missing)
- [ ] executor/types.ts (ParsedAgent, ParsedStep, RunContext, StepFailed error class)
- [ ] sop-runner.ts (≤200 LOC; split if exceeds)
- [ ] resolveArgs helper inside runner or separate `arg-resolver.ts`
- [ ] cron/sop-scheduler.ts handler
- [ ] webhook-hmac.ts (sign+verify, reuse existing crypto utils if present)
- [ ] /api/cron/sop-scheduler/route.ts
- [ ] /api/v1/sop/[installationId]/trigger/route.ts
- [ ] wrangler.jsonc cron + inject-scheduled-handler.mjs route
- [ ] sop-runner integration test (stub handlers)
- [ ] Local cron smoke test via `npx wrangler dev` + `curl` to scheduler route
- [ ] Verify circuit-breaker + credit-charge still trigger via dispatcher (no bypass)

## Success Criteria

- Cron tick processes ≥1 due installation, creates run row status='succeeded' or 'failed'.
- Webhook trigger validates HMAC, returns 200 + runId in <500ms.
- Mission engine still charges credits per dispatched step (verify via existing `mcu_credits` table delta).
- Step failure → run status='partial' or 'failed', no schedule advance on full fail.
- All new tests pass; existing 2292 still pass.
- `npm run typecheck` clean; no `:any`.

## Risk Assessment

- R1: `ctx.waitUntil` not available in all CF runtimes — for webhook async run. Mitigation: fall back to fire-and-forget `Promise.resolve().then(...)` with try/catch logging; or queue via existing webhook fire pattern in `lib/missions/fire-webhook.ts`.
- R2: Mission dispatcher may not expose internal call API. Mitigation Step: read dispatcher.ts; if HTTP-only, use `fetch` to local `/api/v1/missions` with service-token header.
- R3: Long step (e.g. `video:create` ~3min) blocks runner — CF Workers single-request CPU limit ~30s on free tier. Mitigation: don't `await` long-poll inline; persist run as `running` after dispatch, schedule a follow-up check via a separate cron `*/1 * * * *` reconciler (defer to next sub-phase if needed). For Phase 02, document as known limitation; SOPs that only call fast commands (email, lead, analytics, proposal) work fully.
- R4: Cron pile-up. Mitigation: `claimDueInstallations` SETs `next_run_at = now + 5min` atomically before dispatch (claim-then-execute), so even if run lags, next tick won't re-claim same row.

## Security Considerations

- Webhook HMAC uses installation-specific secret (32 random bytes), stored encrypted in `customizations.webhookSecret` reusing existing `lib/crypto` AES-GCM pattern.
- Cron route token-gated (existing `CRON_TOKEN` env).
- Dispatched missions inherit user's auth context — no privilege escalation. Verify `userId` always sourced from installation row, never from request body.
- Output validation prevents schema-drift from leaking unexpected data into `result_summary`.

## Next Steps

- Phase 04 reads run history via `sop-repo`.
- Phase 05 sidebar can dispatch `manual` SOP runs through this same `runSop()`.

## Open Questions

- Long-running step handling (R3 above) — defer reconciler pattern to Phase 1.5 or solve here? Recommend defer; document clearly.
- Webhook payload size limit — set to 64KB to match CF Workers default; user signals if they need >64KB? Document.
- HMAC algorithm — `sha256` HMAC over raw body. Header convention: `X-Sophia-Signature: t=<unix>,v1=<hex>` (Stripe style).
