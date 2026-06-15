export const meta = {
  name: 'full-team-phases-01-02-04-07',
  description: 'Full team parallel execution for remaining phases: 01, 02, 04, 07',
  phases: [
    { title: 'Phase 01', detail: 'OpenClaw Executor Logging' },
    { title: 'Phase 02', detail: 'Verify Seed Default Team Roles' },
    { title: 'Phase 04', detail: 'Deduplicate Multi-Agent Types' },
    { title: 'Phase 07', detail: 'Enable Agent Teams' },
    { title: 'Verify', detail: 'Typecheck + Lint + Test' },
    { title: 'Review', detail: 'Code Review' },
  ],
};

// Phase definitions with file sets
const PHASES = {
  '01': {
    name: 'OpenClaw Executor Logging',
    files: ['src/land/openclaw/queue.ts', 'src/land/openclaw/schedule.ts'],
    task: `Add structured logging to OpenClaw executor primitives.

Files:
- src/land/openclaw/queue.ts (enqueue function)
- src/land/openclaw/schedule.ts (scheduleAgent function)

Requirements:
1. Import logger from seed: import { logger } from '@/seed/utils/logger-utility'
2. Add logger.info() calls with structured data:
   - queue.ts: log "enqueue" with { eventName, tenantId, priority, retry, eventId }
   - schedule.ts: log "schedule" with { eventName, tenantId, cron, eventId }
3. Log before/after audit() calls
4. Follow existing logger patterns (search codebase for logger.info)
5. No breaking changes

Return: list of changes (file:line), typecheck result`,
  },
  '02': {
    name: 'Verify Seed Default Team Roles',
    files: ['src/forest/agents/seed-default-team.ts', 'src/forest/agents/prompts.ts', 'src/forest/agents/types.ts'],
    task: `Verify default agent team seeding is correct.

Files:
- src/forest/agents/seed-default-team.ts
- src/forest/agents/prompts.ts
- src/forest/agents/types.ts

Checklist:
1. DEFAULT_AGENTS has exactly 5 roles: CEO, Developer, QA, Ops, Marketing
2. All 5 prompts exist (CEO_PROMPT, DEVELOPER_PROMPT, QA_PROMPT, OPS_PROMPT, MARKETING_PROMPT)
3. AgentRole type matches these 5 values exactly
4. seedDefaultTeam() is idempotent (safe to call multiple times)
5. Related tests exist and pass

Return: VERIFIED or ISSUES_FOUND with details`,
  },
  '04': {
    name: 'Deduplicate Multi-Agent Types',
    files: ['src/forest/agents/types.ts', 'src/forest/quota/quota-checker-types.ts', 'src/land/analytics/types.ts', 'src/seed/types/multi-agent.ts'],
    task: `Deduplicate common agent types to seed layer.

Current duplication:
- AgentRole and AgentTaskStatus defined in forest/agents/types.ts
- These are used across multiple modules (quota, analytics, etc.)

Task:
1. Create/update src/seed/types/agent-fleet.ts (or multi-agent.ts) with:
   - export type AgentRole = 'CEO' | 'Developer' | 'QA' | 'Ops' | 'Marketing'
   - export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed'
2. Update forest/agents/types.ts to re-export from seed
3. Update imports in:
   - forest/quota/quota-checker-types.ts (if uses these types)
   - land/analytics/types.ts (if uses these types)
   - tree/agents/ (any files using these types)
   - Check for any other references with grep
4. Ensure seed types don't import from forest/land (no circular)
5. Typecheck must pass

Return: files created/modified, typecheck status`,
  },
  '07': {
    name: 'Enable Agent Teams',
    files: [
      'src/app/actions/agent-team-config.ts',
      'src/app/api/agents/team/create/route.ts',
      'src/app/api/agents/team/delete/route.ts',
      'src/app/api/agents/team/update/route.ts',
      'src/app/api/agents/team/route.ts',
      'src/forest/agents/repository.ts',
    ],
    task: `Verify agent teams API routes are fully functional.

Files to check:
- Server Action: src/app/actions/agent-team-config.ts
- API routes: src/app/api/agents/team/*/route.ts
- Repository: src/forest/agents/repository.ts

Verification:
1. All routes use getCurrentUser() from seed/auth
2. All routes properly call repository functions
3. Response formats are consistent
4. Integration tests exist and pass (check __tests__ folders)
5. No runtime errors in code paths
6. Typecheck and lint pass

Return: status per route, test results, any issues found`,
  },
};

// Phase 1-4: Parallel execution
phase('Phase 01');
phase('Phase 02');
phase('Phase 04');
phase('Phase 07');

log('Spawning parallel agents for 4 phases...');

const results = await parallel(
  ['01', '02', '04', '07'].map(phaseKey =>
    () => agent(PHASES[phaseKey].name, {
      label: `phase-${phaseKey}`,
      phase: `Phase ${phaseKey}`,
      prompt: PHASES[phaseKey].task,
      isolation: 'worktree'
    })
  )
);

// Verification phase
phase('Verify');
log('Running quality gates...');

const typecheck = await agent('Typecheck', {
  label: 'verify:typecheck',
  phase: 'Verify',
  prompt: `Run typecheck on Sophia project.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm exec tsc --noEmit
Return: exit code, error count`,
  schema: { type: 'object', properties: { exitCode: {type:'number'}, errors: {type:'string'}}, required:['exitCode'] }
});

const lint = await agent('Lint', {
  label: 'verify:lint',
  phase: 'Verify',
  prompt: `Run lint on Sophia project.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm exec next lint
Return: exit code, error count`,
  schema: { type: 'object', properties: { exitCode: {type:'number'}, errors: {type:'string'}}, required:['exitCode'] }
});

const test = await agent('Test', {
  label: 'verify:test',
  phase: 'Verify',
  prompt: `Run test suite and capture summary.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm test
Return: total suites, passed, failed, total tests, failed tests`,
  schema: {
    type: 'object',
    properties: {
      totalSuites: {type:'number'},
      passedSuites: {type:'number'},
      failedSuites: {type:'number'},
      totalTests: {type:'number'},
      passedTests: {type:'number'},
      failedTests: {type:'number'},
      failures: {type:'array', items:{type:'string'}}
    }
  }
});

// Review phase
phase('Review');
log('Code review of all phase changes...');

const review = await agent('Code Review', {
  label: 'review:all-phases',
  phase: 'Review',
  prompt: `Review all changes from Phases 01, 02, 04, 07.

Verify:
1. Phase 01: Logging added correctly to queue.ts and schedule.ts
2. Phase 02: Default team roles verified (5 roles)
3. Phase 04: Types deduplicated to seed, no circular deps
4. Phase 07: Agent teams API functional
5. All quality gates: typecheck ${typecheck.exitCode}, lint ${lint.exitCode}, test ${test.failedSuites}/${test.totalSuites} suites failed
6. No breaking changes or regressions

Report: APPROVED | CRITICAL | WARNING with specific issues if any.`,
  schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['APPROVED', 'CRITICAL', 'WARNING'] },
      issues: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' }
    },
    required: ['status', 'summary']
  }
});

return {
  phases: {
    '01': results[0],
    '02': results[1],
    '04': results[2],
    '07': results[3],
  },
  verification: { typecheck, lint, test },
  review,
  success: review.status === 'APPROVED' && test.failedSuites <= 10
};
