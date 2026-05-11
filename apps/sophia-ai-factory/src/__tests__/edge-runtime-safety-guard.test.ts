/**
 * Runs scripts/check-edge-runtime-safety.sh as a vitest test.
 *
 * If this test fails, a file under src/ uses a Node-only process API at
 * module top level. The Next.js Edge Runtime statically rejects such
 * modules — same root cause as the 2026-05-11 dev-server boot failure
 * (commit 58c7192b).
 */

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..')
const SCRIPT = resolve(REPO_ROOT, 'scripts', 'check-edge-runtime-safety.sh')

describe('edge runtime safety guard', () => {
  // Script walks every .ts file under src/ — ~8s on a cold cache. 30s gives
  // headroom for CI under contention.
  it('no unannotated process.on/exit/kill calls in Edge-importable modules', { timeout: 30_000 }, () => {
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
        `Edge runtime safety guard failed. Script output:\n\n${output}`,
      )
    }

    expect(output).toContain('Unannotated violations:                0')
    expect(output).toContain('OK — no unannotated Node-only Process APIs')
  })
})
