export const meta = {
  name: 'phase-06-test-fixes-full-team',
  description: 'Full team parallel fix for remaining test failures in Phase 06',
  phases: [
    { title: 'Analyze', detail: 'Categorize test failures' },
    { title: 'Fix', detail: 'Parallel agents per failure type' },
    { title: 'Verify', detail: 'Typecheck + Lint + Test' },
    { title: 'Review', detail: 'Code review verification' },
  ],
};

// Phase 1: Read test output and categorize
phase('Analyze');
log('Reading test output and categorizing failures...');

const readTestOutput = await agent('Read test output', {
  label: 'read:test-output',
  phase: 'Analyze',
  prompt: `Read the test output file at /tmp/vitest-output.txt in project /Users/macbook/projects/sophia-ai-factory.

Extract:
1. List of failed test files (full paths)
2. For each file, list the specific test names that failed
3. The error messages for each failure
4. Count total failed suites and tests

Return structured JSON with:
{
  "failedFiles": [
    {
      "path": "src/path/to/file.test.ts",
      "failedTests": ["test name 1", "test name 2"],
      "errors": ["full error message 1", "full error message 2"]
    }
  ],
  "summary": { "totalSuites": X, "failedSuites": Y, "totalTests": A, "failedTests": B }
}`,
  schema: {
    type: 'object',
    properties: {
      failedFiles: { type: 'array', items: { type: 'object' } },
      summary: { type: 'object' }
    },
    required: ['failedFiles', 'summary']
  }
});

log(`Found ${readTestOutput.failedFiles.length} failed files, ${readTestOutput.summary.failedTests} failed tests`);

// Phase 2: Spawn parallel fix agents for each failure type
phase('Fix');

const fixAgents = [];
for (const file of readTestOutput.failedFiles) {
  fixAgents.push(() =>
    agent(`Fix: ${file.path}`, {
      label: `fix:${file.path.split('/').pop().replace('.test.ts','')}`,
      phase: 'Fix',
      prompt: `You are fixing test failures in Sophia AI Factory.

FILE: ${file.path}
FAILED TESTS:
${file.failedTests.map((t,i) => `${i+1}. ${t}\n   Error: ${file.errors[i]}`).join('\n')}

TASK:
1. Read the source file (${file.path.replace('.test.ts','.ts')}) and the test file
2. Identify the root cause
3. Make minimal fix to make tests pass
4. Follow existing codebase patterns
5. Do NOT break other tests

REPORT:
- Changes made (file:line with before/after)
- Rationale
- Any remaining issues`,
      isolation: 'worktree'
    })
  );
}

const fixResults = await parallel(fixAgents);

// Phase 3: Verify with typecheck, lint, test
phase('Verify');
log('Running quality gates...');

const verifyResults = await parallel([
  () => agent('Typecheck', {
    label: 'check:typecheck',
    phase: 'Verify',
    prompt: `Run typecheck on Sophia AI Factory project.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm exec tsc --noEmit
Report: Exit code and any errors (first 50 lines)`,
    schema: { type: 'object', properties: { exitCode: {type:'number'}, errors: {type:'string'} }, required: ['exitCode'] }
  }),
  () => agent('Lint', {
    label: 'check:lint',
    phase: 'Verify',
    prompt: `Run lint on Sophia AI Factory project.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm exec next lint
Report: Exit code and any errors (first 50 lines)`,
    schema: { type: 'object', properties: { exitCode: {type:'number'}, errors: {type:'string'} }, required: ['exitCode'] }
  }),
  () => agent('Test', {
    label: 'check:test',
    phase: 'Verify',
    prompt: `Run full test suite on Sophia AI Factory.
Command: cd /Users/macbook/projects/sophia-ai-factory && pnpm test
Capture: Total suites, passed, failed, total tests
Report: Summary and list of any remaining failures`,
    schema: { type: 'object', properties: { summary: {type:'string'}, remainingFailures: {type:'array', items:{type:'string'}} }, required: ['summary'] }
  })
]);

// Phase 4: Code review
phase('Review');
log('Code review of all changes...');

const review = await agent('Code Review', {
  label: 'review:phase-06',
  phase: 'Review',
  prompt: `Review all test fixes made in Phase 06.

Verify:
1. Tests now pass (target ≤10 failed suites)
2. No regression introduced
3. No breaking changes
4. Follows codebase conventions
5. Zero new type/lint errors

From verify results:
- Typecheck: ${verifyResults[0].exitCode} ${verifyResults[0].errors?.slice(0,200)}
- Lint: ${verifyResults[1].exitCode} ${verifyResults[1].errors?.slice(0,200)}
- Test: ${verifyResults[2].summary}

Report:
- status: APPROVED | CRITICAL | WARNING
- issues: [] (if any)
- summary: brief verdict`,
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
  analysis: readTestOutput,
  fixes: fixResults,
  verification: verifyResults,
  review,
  targetMet: review.status === 'APPROVED' && verifyResults[2].remainingFailures?.length <= 10
};
