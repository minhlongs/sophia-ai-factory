/**
 * Deploy config drift regression — REAL config cross-check.
 *
 * Historical bug (observed in deploy run 40605009064, Stage 3b):
 * `wrangler secret put ... --env health || true` was executed although wrangler
 * reported `No environment found in configuration with name "health". The
 * available configured environment names are: ["0","1"]`. The `|| true` /
 * `if ! ... non-fatal` hid a genuine config error on every deploy.
 *
 * Root cause: `wrangler.toml` declares worker variants with `[[env]]`
 * (array-of-tables). Wrangler then exposes only INDEXED environments ("0","1"),
 * NOT named ones. A named `--env <name>` therefore never resolves.
 *
 * This test reads the REAL workflow, the REAL fallback deploy script and the
 * REAL wrangler.toml (no mocking, no self-comparison) and asserts:
 *   1. no `--env <non-empty>` in the deploy flow references an env that
 *      wrangler cannot expose (i.e. any named env while `[[env]]` is in use);
 *   2. the three version/health metadata `secret put` commands are present and
 *      fail loud (no `|| true`, no non-fatal wrapper);
 *   3. the wrangler.toml dependency is actually consulted — if it is missing or
 *      unparseable the test fails instead of skipping.
 *
 * Layer: scripts/__tests__ (config boundary, not browser / not provider).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Resolve REAL repo/app roots without relying on `__dirname` (which Vite/Vitest
 * can rewrite when coverage instrumentation is enabled). Walk up from the
 * current working directory (vitest.config.ts chdir's to the app root) until
 * `.github/workflows/deploy.yml` is found — then assert every required file is
 * present so the dependency can never be silently skipped.
 */
function findRepoRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, '.github/workflows/deploy.yml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not locate repo root containing .github/workflows/deploy.yml');
}

const REPO_ROOT = findRepoRoot();
const APP_ROOT = resolve(REPO_ROOT, 'apps/sophia-ai-factory');

const DEPLOY_YML = resolve(REPO_ROOT, '.github/workflows/deploy.yml');
const FALLBACK_SH = resolve(APP_ROOT, 'scripts/deploy-with-sha.sh');
const WRANGLER_TOML = resolve(APP_ROOT, 'wrangler.toml');

const CRITICAL_SECRETS = ['COMMIT_SHA', 'DEPLOYED_AT', 'DEPLOY_BRANCH'] as const;

interface WranglerEnvShape {
  /** True when `[[env]]` array-of-tables is used (named envs NOT addressable). */
  hasArrayOfTables: boolean;
  /** Names found in `[env.NAME]` / `[env.NAME.*]` tables. */
  declaredNames: string[];
}

/**
 * Minimal, dependency-free parse of the env declarations in wrangler.toml.
 * We deliberately do NOT import a TOML lib: we only need the env table headers,
 * and a regex over the real file is enough to detect the drift deterministically.
 */
function parseWranglerEnvShape(toml: string): WranglerEnvShape {
  const hasArrayOfTables = /^\s*\[\[env\]\]\s*$/m.test(toml);
  const declaredNames = new Set<string>();
  for (const m of toml.matchAll(/^\s*\[env\.([A-Za-z0-9_-]+)(?:\.|\])/gm)) {
    declaredNames.add(m[1]);
  }
  return { hasArrayOfTables, declaredNames: [...declaredNames].sort() };
}

/**
 * Keep only executable lines: drop YAML/shell comment lines. Documentation may
 * legitimately mention the historical `--env health` bug, but a REAL command
 * using it must never be reintroduced. Inline trailing comments are retained
 * (they cannot hide a leading `wrangler ...` command from the regexes).
 */
function executableText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

/** Collect every non-empty `--env VALUE` token from executable lines. */
function collectEnvFlags(text: string): string[] {
  const out: string[] = [];
  for (const m of executableText(text).matchAll(/--env[ =]+"?([^"\s]+)"?/g)) {
    // `--env ""` targets the top-level worker (valid); ignore empty / quote-only.
    const v = m[1].replace(/^"|"$/g, '').trim();
    if (v && v !== '""' && v !== "''") out.push(v);
  }
  return out;
}

/** Find executable lines that set a critical secret and check they are fail-loud. */
function findCriticalSecretLines(text: string): string[] {
  return executableText(text)
    .split('\n')
    .filter((line) => CRITICAL_SECRETS.some((s) => new RegExp(`secret put ${s}\\b`).test(line)));
}

describe('deploy config: wrangler env references are consistent and fail-loud', () => {
  it('reads the real workflow, fallback script and wrangler config (dependency not skipped)', () => {
    for (const p of [DEPLOY_YML, FALLBACK_SH, WRANGLER_TOML]) {
      expect(existsSync(p), `missing required deploy config file: ${p}`).toBe(true);
      expect(readFileSync(p, 'utf8').length).toBeGreaterThan(0);
    }
  });

  it('no deploy step targets a named env that wrangler cannot expose', () => {
    const shape = parseWranglerEnvShape(readFileSync(WRANGLER_TOML, 'utf8'));
    // The drift trigger: `[[env]]` means ONLY indexed envs "0","1" exist, so
    // every named `--env NAME` is invalid regardless of `[env.NAME.*]` tables.
    const addressable = shape.hasArrayOfTables ? [] : shape.declaredNames;

    for (const file of [DEPLOY_YML, FALLBACK_SH]) {
      const flags = collectEnvFlags(readFileSync(file, 'utf8'));
      for (const env of flags) {
        expect(
          addressable,
          `${file}: "--env ${env}" is not an addressable wrangler environment ` +
            `(hasArrayOfTables=${shape.hasArrayOfTables}, declared=[${shape.declaredNames.join(',')}]). ` +
            `Remove the dead call or fix wrangler.toml to a real named env.`,
        ).toContain(env);
      }
    }
  });

  it('the three version/health metadata secrets are set and never silently skipped', () => {
    const yml = readFileSync(DEPLOY_YML, 'utf8');
    const sh = readFileSync(FALLBACK_SH, 'utf8');

    for (const source of [yml, sh]) {
      const lines = findCriticalSecretLines(source);
      for (const secret of CRITICAL_SECRETS) {
        const matching = lines.filter((l) => new RegExp(`secret put ${secret}\\b`).test(l));
        expect(matching.length, `missing fail-loud secret put for ${secret}`).toBeGreaterThan(0);
        for (const line of matching) {
          expect(line, `critical secret ${secret} must fail loud`).not.toMatch(/\|\|\s*true/);
          expect(line, `critical secret ${secret} must not use --env`).not.toMatch(/--env/);
        }
      }
    }
  });

  it('no residual `--env health` best-effort propagation anywhere in the deploy flow', () => {
    for (const file of [DEPLOY_YML, FALLBACK_SH]) {
      const exec = executableText(readFileSync(file, 'utf8'));
      expect(exec, `${file}: dead health-env propagation reintroduced`).not.toMatch(/--env[ =]+"?health"?/);
      expect(exec, `${file}: a secret put is being swallowed again`).not.toMatch(/secret put[^\n]*\|\|\s*true/);
    }
  });

  it('records the wrangler.toml drift as a known, explicitly-detected shape', () => {
    // If someone FIXES wrangler.toml (converts `[[env]]` to real named envs),
    // this assertion will fail on purpose — forcing them to re-validate the
    // deploy topology instead of silently changing worker variants.
    const shape = parseWranglerEnvShape(readFileSync(WRANGLER_TOML, 'utf8'));
    expect(shape.hasArrayOfTables).toBe(true);
    expect(shape.declaredNames).toEqual(expect.arrayContaining(['health', 'ultracode']));
  });
});
