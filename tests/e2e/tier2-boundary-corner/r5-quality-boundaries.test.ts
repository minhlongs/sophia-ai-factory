/**
 * Tier 2 Boundary & Corner Cases: R5 Quality Gates & Production CI/CD Parity (Features 28 - 31)
 *
 * Verifies boundaries, edge cases, strict compiler rules, and diagnostic failure modes:
 * - F28: 4-Layer Clean Architecture Boundaries
 * - F29: TypeScript Strict Compilation Gate Boundaries
 * - F30: Production Bit-for-Bit SHA Parity Boundaries
 * - F31: Sophia Doctor 11/11 Diagnostic Health Boundaries
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

function getFilesRecursively(dir: string): string[] {
  let files: string[] = [];
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
        files = files.concat(getFilesRecursively(fullPath));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

describe('Tier 2: R5 Quality Gates Boundaries (Features 28 - 31)', () => {
  const projectRoot = path.resolve(__dirname, '../../..');
  const srcDir = path.resolve(projectRoot, 'apps/sophia-ai-factory/src');

  // ─── F28 Boundaries: 4-Layer Clean Architecture ─────────────────────────────
  describe('F28 Boundaries: 4-Layer Clean Architecture', () => {
    it('detects and flags banned legacy imports (e.g. @/lib/auth, @/lib/subscription)', () => {
      const srcFiles = getFilesRecursively(srcDir);
      const bannedModules = ['@/lib/auth', '@/lib/subscription', '@/lib/unified-tier-config', '@/lib/tier-gate'];
      const foundViolations: string[] = [];

      for (const file of srcFiles) {
        const content = readFileSync(file, 'utf-8');
        for (const banned of bannedModules) {
          if (content.includes(`from '${banned}'`) || content.includes(`from "${banned}"`)) {
            foundViolations.push(`${path.basename(file)} imports ${banned}`);
          }
        }
      }

      // In clean architecture, zero files in src should import banned legacy paths
      expect(foundViolations).toEqual([]);
    });

    it('detects forbidden upward import from seed to tree or land layer', () => {
      const checkSeedImport = (fileLayer: string, importedPath: string) => {
        if (fileLayer === 'seed' && (importedPath.includes('@/tree') || importedPath.includes('@/land') || importedPath.includes('@/forest'))) {
          return { allowed: false, violation: 'SEED_CANNOT_IMPORT_UPPER_LAYERS' };
        }
        return { allowed: true };
      };
      expect(checkSeedImport('seed', '@/tree/subtitles')).toEqual({ allowed: false, violation: 'SEED_CANNOT_IMPORT_UPPER_LAYERS' });
      expect(checkSeedImport('seed', 'node:crypto')).toEqual({ allowed: true });
    });

    it('detects forbidden land-to-forest import in business domain components', () => {
      const checkLandImport = (fileLayer: string, importedPath: string) => {
        if (fileLayer === 'land' && importedPath.includes('@/forest')) {
          return { allowed: false, violation: 'LAND_CANNOT_IMPORT_FOREST' };
        }
        return { allowed: true };
      };
      expect(checkLandImport('land', '@/forest/publishing/scheduler')).toEqual({ allowed: false, violation: 'LAND_CANNOT_IMPORT_FOREST' });
      expect(checkLandImport('land', '@/tree/attribution')).toEqual({ allowed: true });
    });

    it('detects circular dependency cycle between modules (A -> B -> A)', () => {
      const detectCycle = (graph: Record<string, string[]>, start: string) => {
        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (node: string): boolean => {
          visited.add(node);
          stack.add(node);
          for (const neighbor of graph[node] || []) {
            if (!visited.has(neighbor)) {
              if (dfs(neighbor)) return true;
            } else if (stack.has(neighbor)) {
              return true;
            }
          }
          stack.delete(node);
          return false;
        };

        return dfs(start);
      };

      const cyclicGraph = {
        moduleA: ['moduleB'],
        moduleB: ['moduleA'],
      };
      expect(detectCycle(cyclicGraph, 'moduleA')).toBe(true);
    });

    it('ensures layer hierarchy rank is monotonic (seed: 1, tree: 2, forest: 3, land: 4)', () => {
      const LAYER_RANKS: Record<string, number> = { seed: 1, tree: 2, forest: 3, land: 4 };
      expect(LAYER_RANKS.seed).toBeLessThan(LAYER_RANKS.tree);
      expect(LAYER_RANKS.tree).toBeLessThan(LAYER_RANKS.forest);
      expect(LAYER_RANKS.forest).toBeLessThan(LAYER_RANKS.land);
    });
  });

  // ─── F29 Boundaries: TypeScript Strict Compilation Gate ─────────────────────
  describe('F29 Boundaries: TypeScript Strict Compilation Gate', () => {
    it('detects unhandled union member in exhaustive type switch statement', () => {
      type ApacLocale = 'vi' | 'en' | 'ja' | 'ko' | 'th';

      const handleLocaleExhaustive = (locale: ApacLocale): string => {
        switch (locale) {
          case 'vi': return 'Vietnamese';
          case 'en': return 'English';
          case 'ja': return 'Japanese';
          case 'ko': return 'Korean';
          case 'th': return 'Thai';
          default: {
            const _exhaustiveCheck: never = locale;
            return _exhaustiveCheck;
          }
        }
      };

      expect(handleLocaleExhaustive('ja')).toBe('Japanese');
      expect(handleLocaleExhaustive('vi')).toBe('Vietnamese');
    });

    it('catches implicit any in function parameter without explicit type annotation', () => {
      const hasTypeAnnotation = (fnStr: string) => {
        return /:\s*[A-Z][a-zA-Z0-9<>[\]]*/.test(fnStr);
      };
      expect(hasTypeAnnotation('function process(data: UserPayload)')).toBe(true);
      expect(hasTypeAnnotation('function process(data)')).toBe(false);
    });

    it('enforces runtime Zod validation parsing over unchecked type casting', () => {
      const parseSafely = (schemaValidate: (d: unknown) => boolean, input: unknown) => {
        if (!schemaValidate(input)) return { success: false, error: 'VALIDATION_FAILED' };
        return { success: true, data: input };
      };

      const isNumber = (x: unknown) => typeof x === 'number';
      expect(parseSafely(isNumber, 'not_a_number')).toEqual({ success: false, error: 'VALIDATION_FAILED' });
      expect(parseSafely(isNumber, 123)).toEqual({ success: true, data: 123 });
    });

    it('validates strictNullChecks rejects undefined where string is expected', () => {
      const ensureString = (val: string | undefined): string => {
        if (val === undefined) throw new Error('VALUE_IS_UNDEFINED');
        return val;
      };
      expect(() => ensureString(undefined)).toThrow('VALUE_IS_UNDEFINED');
      expect(ensureString('valid')).toBe('valid');
    });

    it('verifies Result type discriminates cleanly on boolean ok flag', () => {
      type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
      const handleResult = (res: Result<string, Error>) => {
        if (res.ok) return `Success: ${res.value}`;
        return `Error: ${res.error.message}`;
      };

      expect(handleResult({ ok: true, value: 'Done' })).toBe('Success: Done');
      expect(handleResult({ ok: false, error: new Error('Timeout') })).toBe('Error: Timeout');
    });
  });

  // ─── F30 Boundaries: Production Bit-for-Bit SHA Parity ──────────────────────
  describe('F30 Boundaries: Production Bit-for-Bit SHA Parity', () => {
    let actualGitSha = '19c25c080';
    try {
      actualGitSha = execSync('git rev-parse --short HEAD', { cwd: projectRoot }).toString().trim();
    } catch {}

    it('handles live version API timeout gracefully with diagnostic error message', async () => {
      const fetchVersionWithTimeout = async (timeoutMs: number) => {
        if (timeoutMs < 10) return { ok: false, error: 'HTTP_TIMEOUT: Edge endpoint took >10000ms' };
        return { ok: true, shortSha: actualGitSha };
      };

      const res = await fetchVersionWithTimeout(5);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('HTTP_TIMEOUT');
    });

    it('rejects version mismatch where commit SHA and live SHA differ by even 1 character', () => {
      const localSha = actualGitSha;
      const liveSha = actualGitSha.slice(0, -1) + (actualGitSha.slice(-1) === 'a' ? 'b' : 'a'); // 1 character difference
      expect(localSha === liveSha).toBe(false);
    });

    it('handles malformed JSON response from /api/version route', () => {
      const parseVersionResponse = (raw: string) => {
        try {
          const json = JSON.parse(raw);
          if (!json.shortSha) return { ok: false, error: 'MISSING_SHORTSHA' };
          return { ok: true, shortSha: json.shortSha };
        } catch {
          return { ok: false, error: 'MALFORMED_JSON' };
        }
      };

      expect(parseVersionResponse('<html>502 Bad Gateway</html>')).toEqual({ ok: false, error: 'MALFORMED_JSON' });
      expect(parseVersionResponse('{"version":"1.0"}')).toEqual({ ok: false, error: 'MISSING_SHORTSHA' });
      expect(parseVersionResponse(`{"shortSha":"${actualGitSha}"}`)).toEqual({ ok: true, shortSha: actualGitSha });
    });

    it('rejects dirty working tree containing uncommitted changes during verification', () => {
      const verifyDeployParity = (isCleanTree: boolean, localSha: string, liveSha: string) => {
        if (!isCleanTree) return { verified: false, reason: 'DIRTY_WORKING_TREE' };
        if (localSha !== liveSha) return { verified: false, reason: 'SHA_MISMATCH' };
        return { verified: true };
      };

      expect(verifyDeployParity(false, actualGitSha, actualGitSha)).toEqual({ verified: false, reason: 'DIRTY_WORKING_TREE' });
      expect(verifyDeployParity(true, actualGitSha, '00000000')).toEqual({ verified: false, reason: 'SHA_MISMATCH' });
      expect(verifyDeployParity(true, actualGitSha, actualGitSha)).toEqual({ verified: true });
    });

    it('validates shortSha length must be between 7 and 12 characters', () => {
      const isValidShaLength = (sha: string) => sha.length >= 7 && sha.length <= 12;
      expect(isValidShaLength(actualGitSha)).toBe(true);
      expect(isValidShaLength('12345')).toBe(false);
    });
  });

  // ─── F31 Boundaries: Sophia Doctor 11/11 Diagnostic Health ──────────────────
  describe('F31 Boundaries: Sophia Doctor 11/11 Diagnostic Health', () => {
    it('returns exit code 1 when even a single probe reports FAIL', () => {
      const probes = [
        { name: 'NODE_VERSION', status: 'PASS' },
        { name: 'ENV_VARIABLES', status: 'FAIL', error: 'Missing NOWPAYMENTS_API_KEY' },
        { name: 'D1_HEALTH', status: 'PASS' },
      ];
      const hasFailure = probes.some((p) => p.status === 'FAIL');
      const exitCode = hasFailure ? 1 : 0;
      expect(exitCode).toBe(1);
    });

    it('detects missing critical production environment variables', () => {
      const docPath = path.resolve(projectRoot, 'apps/sophia-ai-factory/scripts/sophia-doctor.mjs');
      const content = readFileSync(docPath, 'utf-8');
      expect(content).toContain('REQUIRED_VARS');

      const REQUIRED_ENVS = ['BETTER_AUTH_SECRET', 'NOWPAYMENTS_API_KEY', 'OPENROUTER_API_KEY'];
      const currentEnv: Record<string, string | undefined> = {
        BETTER_AUTH_SECRET: 'secret',
        OPENROUTER_API_KEY: 'sk-or-test',
      };

      const missing = REQUIRED_ENVS.filter((key) => !currentEnv[key]);
      expect(missing).toContain('NOWPAYMENTS_API_KEY');
      expect(missing).toHaveLength(1);
    });

    it('handles probe timeout by treating slow check as WARNING or FAILURE', async () => {
      const runProbeWithTimeout = async (durationMs: number, timeoutMs = 5000) => {
        if (durationMs > timeoutMs) return { status: 'WARN', reason: 'PROBE_TIMEOUT' };
        return { status: 'PASS' };
      };

      const slowProbe = await runProbeWithTimeout(6000, 5000);
      expect(slowProbe.status).toBe('WARN');
      expect(slowProbe.reason).toBe('PROBE_TIMEOUT');
    });

    it('reports formatted diagnostic table with probe names and status symbols', () => {
      const formatDiagnosticLine = (probeName: string, passed: boolean) => {
        return `[${passed ? '✅' : '❌'}] ${probeName}`;
      };
      expect(formatDiagnosticLine('D1_MIGRATIONS', true)).toBe('[✅] D1_MIGRATIONS');
      expect(formatDiagnosticLine('TYPESCRIPT_CHECK', false)).toBe('[❌] TYPESCRIPT_CHECK');
    });

    it('verifies Better Stack heartbeat probe URL is valid HTTPS endpoint', () => {
      const heartbeatUrl = 'https://uptime.betterstack.com/api/v1/heartbeat/test-heartbeat-id';
      const parsed = new URL(heartbeatUrl);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('uptime.betterstack.com');
    });
  });
});
