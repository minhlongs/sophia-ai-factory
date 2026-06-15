/**
 * Runs scripts/check-migration-coverage.sh as a vitest test so every
 * `npm test` re-enforces the INC-2026-01 prevention guard.
 *
 * If this test fails, a CREATE TABLE somewhere under src/ has no matching
 * canonical migrations/*.sql — same drift that left 3 production tables
 * missing for ~10 days on 2026-05-10. See:
 *   docs/postmortems/2026-05-10-revenue-split-tables-missing.md
 */

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..')
const SCRIPT = resolve(REPO_ROOT, 'scripts', 'check-migration-coverage.sh')

describe('migration coverage guard', () => {
  it('every D1 CREATE TABLE in src/ has a canonical migrations/ match', () => {
    let output = ''
    let failed = false
    try {
      output = execFileSync('bash', [SCRIPT], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      failed = true
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string }
      output = `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`
    }

    if (failed) {
      throw new Error(
        `Migration coverage guard failed. Script output:\n\n${output}`,
      )
    }

    expect(output).toContain('Orphan tables:          0')
    expect(output).toContain('OK — all D1 CREATE TABLE statements')
  })
})
