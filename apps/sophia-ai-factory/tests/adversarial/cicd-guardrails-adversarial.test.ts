/**
 * Adversarial Test Suite for Local Deployment Deprecation Guard & Break-Glass Protocol
 *
 * @vitest-environment node
 *
 * Requirements Verified:
 * 1. Default local deployment invocation exits with code 1 and outputs canonical error banner.
 * 2. Break-glass override with EMERGENCY_CF_DIRECT=1 permits execution and displays warning banner.
 * 3. CI runner simulation (GITHUB_ACTIONS=true) permits execution cleanly without break-glass banner.
 * 4. Adversarial tamper values (EMERGENCY_CF_DIRECT=0, 'true', '', 2, -1, ' 1 ') remain strictly blocked.
 * 5. CI tamper values (GITHUB_ACTIONS=false, 0, 1, 'TRUE', ' true ') remain strictly blocked.
 * 6. Root script wrapper `./scripts/deploy-with-sha.sh` maintains 100% behavioral parity with app script.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const APP_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(APP_DIR, '../..');
const ROOT_SCRIPT = path.resolve(REPO_ROOT, 'scripts/deploy-with-sha.sh');
const APP_SCRIPT = path.resolve(APP_DIR, 'scripts/deploy-with-sha.sh');

const EXPECTED_BLOCK_BANNER_LINE1 = '❌ Local direct deployment is disabled to prevent bugs and environment drift.';
const EXPECTED_BLOCK_BANNER_LINE2 = "👉 Push your commits to 'main' for automated CI/CD deployment via GitHub Actions.";
const EXPECTED_BREAK_GLASS_HEADER = '⚠️ BREAK-GLASS PROTOCOL ACTIVE: EMERGENCY_CF_DIRECT=1';

function runScript(
  scriptPath: string,
  args: string[] = [],
  envOverrides: Record<string, string | undefined> = {},
  cwd: string = REPO_ROOT
) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Purge any CI or deploy bypass env vars by default
  delete env.GITHUB_ACTIONS;
  delete env.EMERGENCY_CF_DIRECT;
  delete env.ALLOW_UNPUSHED_DEPLOY;
  delete env.SKIP_TSC;
  delete env.SKIP_TESTS;

  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete env[k];
    } else {
      env[k] = v;
    }
  }

  const result = spawnSync('bash', [scriptPath, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 15000,
  });

  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    combined: (result.stdout || '') + '\n' + (result.stderr || ''),
  };
}

describe('Adversarial Verification: Local Deployment Guardrails', () => {
  describe('Category 1: Default Local Invocation (Guardrail Active)', () => {
    it('blocks execution when root script wrapper is invoked without flags (exit code 1)', () => {
      const res = runScript(ROOT_SCRIPT, [], {});
      expect(res.code).toBe(1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE2);
    });

    it('blocks execution when app script is invoked directly from repo root (exit code 1)', () => {
      const res = runScript(APP_SCRIPT, [], {}, REPO_ROOT);
      expect(res.code).toBe(1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE2);
    });

    it('blocks execution when app script is invoked from inside apps/sophia-ai-factory (exit code 1)', () => {
      const res = runScript(APP_SCRIPT, [], {}, APP_DIR);
      expect(res.code).toBe(1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE2);
    });

    it('blocks execution even when --help is passed without break-glass flag (guard evaluates first)', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], {});
      expect(res.code).toBe(1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
      expect(res.combined).not.toContain('Usage: ./scripts/deploy-with-sha.sh');
    });
  });

  describe('Category 2: Break-Glass Protocol Active (EMERGENCY_CF_DIRECT=1)', () => {
    it('passes guard and displays prominent BREAK-GLASS warning banner with --help on root wrapper', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], { EMERGENCY_CF_DIRECT: '1' });
      expect(res.code).toBe(0);
      expect(res.combined).toContain(EXPECTED_BREAK_GLASS_HEADER);
      expect(res.combined).toContain('⚠️ Bypassing CI/CD requirement for local direct deployment to Cloudflare edge.');
      expect(res.combined).toContain('⚠️ Operator:');
      expect(res.combined).toContain('⚠️ Ensure all quality gates have passed locally before proceeding!');
      expect(res.combined).toContain('Usage: ./scripts/deploy-with-sha.sh');
      expect(res.combined).not.toContain(EXPECTED_BLOCK_BANNER_LINE1);
    });

    it('passes guard on app script when invoked with EMERGENCY_CF_DIRECT=1', () => {
      const res = runScript(APP_SCRIPT, ['--help'], { EMERGENCY_CF_DIRECT: '1' }, APP_DIR);
      expect(res.code).toBe(0);
      expect(res.combined).toContain(EXPECTED_BREAK_GLASS_HEADER);
      expect(res.combined).toContain('Usage: ./scripts/deploy-with-sha.sh');
    });
  });

  describe('Category 3: CI Environment Simulation (GITHUB_ACTIONS=true)', () => {
    it('bypasses local deprecation guard cleanly in CI without break-glass warning banner', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], { GITHUB_ACTIONS: 'true' });
      expect(res.code).toBe(0);
      expect(res.combined).toContain('Usage: ./scripts/deploy-with-sha.sh');
      expect(res.combined).not.toContain('BREAK-GLASS PROTOCOL ACTIVE');
      expect(res.combined).not.toContain(EXPECTED_BLOCK_BANNER_LINE1);
    });
  });

  describe('Category 4: Adversarial Tamper Probes on EMERGENCY_CF_DIRECT', () => {
    const invalidEmergencyValues = [
      ['0', 'zero string'],
      ['true', 'boolean string "true"'],
      ['TRUE', 'uppercase boolean string'],
      ['', 'empty string'],
      ['2', 'integer 2'],
      ['-1', 'negative integer'],
      [' 1 ', 'space padded " 1 "'],
      ['1; echo hacked', 'shell injection attempt'],
    ];

    for (const [val, label] of invalidEmergencyValues) {
      it(`strictly rejects EMERGENCY_CF_DIRECT="${val}" (${label}) with exit code 1`, () => {
        const res = runScript(ROOT_SCRIPT, [], { EMERGENCY_CF_DIRECT: val });
        expect(res.code).toBe(1);
        expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
        expect(res.combined).not.toContain('hacked');
      });
    }
  });

  describe('Category 5: Adversarial Tamper Probes on GITHUB_ACTIONS', () => {
    const invalidCiValues = [
      ['false', 'explicit "false"'],
      ['0', 'zero string'],
      ['1', 'one string'],
      ['TRUE', 'uppercase "TRUE"'],
      ['', 'empty string'],
      [' true ', 'space padded " true "'],
    ];

    for (const [val, label] of invalidCiValues) {
      it(`strictly treats GITHUB_ACTIONS="${val}" (${label}) as non-CI environment (exit code 1)`, () => {
        const res = runScript(ROOT_SCRIPT, [], { GITHUB_ACTIONS: val });
        expect(res.code).toBe(1);
        expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
      });
    }
  });

  describe('Category 6: Precedence & Combined Flag Permutations', () => {
    it('GITHUB_ACTIONS=false & EMERGENCY_CF_DIRECT=0 is strictly blocked', () => {
      const res = runScript(ROOT_SCRIPT, [], {
        GITHUB_ACTIONS: 'false',
        EMERGENCY_CF_DIRECT: '0',
      });
      expect(res.code).toBe(1);
      expect(res.combined).toContain(EXPECTED_BLOCK_BANNER_LINE1);
    });

    it('GITHUB_ACTIONS=false & EMERGENCY_CF_DIRECT=1 triggers break-glass', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], {
        GITHUB_ACTIONS: 'false',
        EMERGENCY_CF_DIRECT: '1',
      });
      expect(res.code).toBe(0);
      expect(res.combined).toContain(EXPECTED_BREAK_GLASS_HEADER);
    });

    it('GITHUB_ACTIONS=true & EMERGENCY_CF_DIRECT=0 runs CI path without break-glass banner', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], {
        GITHUB_ACTIONS: 'true',
        EMERGENCY_CF_DIRECT: '0',
      });
      expect(res.code).toBe(0);
      expect(res.combined).not.toContain('BREAK-GLASS PROTOCOL ACTIVE');
    });

    it('GITHUB_ACTIONS=true & EMERGENCY_CF_DIRECT=1 runs CI path (CI takes precedence)', () => {
      const res = runScript(ROOT_SCRIPT, ['--help'], {
        GITHUB_ACTIONS: 'true',
        EMERGENCY_CF_DIRECT: '1',
      });
      expect(res.code).toBe(0);
      expect(res.combined).not.toContain('BREAK-GLASS PROTOCOL ACTIVE');
    });
  });
});
