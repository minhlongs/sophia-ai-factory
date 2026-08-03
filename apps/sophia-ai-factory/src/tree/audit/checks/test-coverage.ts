/**
 * Test Coverage Checks
 * Reads test result JSON from the last vitest run and validates pass count.
 *
 * @module lib/audit/checks/test-coverage
 */

import type { CheckResult, AuditEnv } from '@/tree/audit/zero-gap-types'

interface VitestResult {
 numPassedTests?: number
 numFailedTests?: number
 numTotalTests?: number
 success?: boolean
 testResults?: Array<{ status: string; numPassingAsserts?: number }>
}

function readTestResults(): VitestResult | null {
 // Lazy require — fs/path are Node.js builtins that Next.js NFT static tracer
 // cannot resolve when imported at module top-level. require() inside this
 // function means they are only resolved at runtime, after the trace is done.
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const { existsSync, readFileSync } = require('node:fs') as typeof import('node:fs')
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const { join } = require('node:path') as typeof import('node:path')

 const TEST_RESULT_PATHS = [
   join(process.cwd(), 'test-results.json'),
   join(process.cwd(), '.vitest-results.json'),
 ]

 for (const p of TEST_RESULT_PATHS) {
   if (existsSync(p)) {
     try {
       const raw = readFileSync(p, 'utf-8')
       return JSON.parse(raw) as VitestResult
     } catch {
       // continue
     }
   }
 }
 return null
}

export async function runTestCoverageChecks(_env: AuditEnv): Promise<CheckResult[]> {
 const start = Date.now()
 const results = readTestResults()

 if (!results) {
   return [
     {
       id: 'test-coverage',
       category: 'Test Coverage',
       name: 'Test Suite Passing',
       status: 'warn',
       weight: 8,
       score: 0.5,
       evidence: 'No test-results.json found — run `npm test -- --reporter=json > test-results.json` to generate',
       fix: 'Run: cd apps/sophia-ai-factory && npm test -- --reporter json --outputFile test-results.json',
       durationMs: Date.now() - start,
     },
   ]
 }

 const passed = results.numPassedTests ?? 0
 const failed = results.numFailedTests ?? 0
 const total = results.numTotalTests ?? passed + failed

 let status: 'pass' | 'warn' | 'fail'
 if (failed > 0) {
   status = 'fail'
 } else if (passed >= 2400) {
   status = 'pass'
 } else if (passed >= 2200) {
   status = 'warn'
 } else {
   status = 'fail'
 }

 const evidence = `${passed} tests passing, ${failed} failing (total: ${total})`

 return [
   {
     id: 'test-coverage',
     category: 'Test Coverage',
     name: 'Test Suite Passing',
     status,
     weight: 8,
     score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
     evidence,
     fix:
       failed > 0
         ? `Fix ${failed} failing tests before production deploy`
         : passed < 2400
           ? `Only ${passed} tests passing — target is >=2400`
           : undefined,
     durationMs: Date.now() - start,
   },
 ]
}
