/**
 * Cross-environment release governance regression — REAL workflow check.
 *
 * Ensures Production and Pilot deployments are strictly decoupled in
 * `.github/workflows/deploy.yml`:
 *   1. `stage-2-3-build-and-deploy` (`environment: production`) deploys ONLY
 *      Production and never references `wrangler.pilot.toml` or
 *      `sophia-ai-factory-pilot`.
 *   2. Any Pilot deploy job in `.github/workflows/deploy.yml` never runs on
 *      `push`, gates on `workflow_dispatch` + `inputs.deploy_pilot_explicit`,
 *      targets `environment: pilot` (never `production`), and runs
 *      `verify-pilot-wrangler-isolation.mjs --require-resolved-ids`.
 *   3. Workflow-level `concurrency` serialization (`cancel-in-progress: false`)
 *      remains intact so concurrent deploys cannot race.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function findRepoRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, '.github/workflows/deploy.yml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not locate repo root containing .github/workflows/deploy.yml');
}

const DEPLOY_YML = resolve(findRepoRoot(), '.github/workflows/deploy.yml');

/**
 * Extract top-level job blocks under `jobs:` keyed by job ID.
 * Keeps raw lines so environment, `if:`, and step commands can be checked
 * deterministically without external YAML parser dependencies.
 */
function parseWorkflowJobs(yml: string): Map<string, string> {
  const lines = yml.split('\n');
  const jobsStart = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (jobsStart === -1) {
    throw new Error('Could not locate top-level `jobs:` section in deploy.yml');
  }

  const jobs = new Map<string, string[]>();
  let currentJob: string | null = null;

  for (let i = jobsStart + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line) && !line.startsWith('#')) {
      break;
    }
    const jobHeader = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (jobHeader) {
      currentJob = jobHeader[1];
      jobs.set(currentJob, [line]);
    } else if (currentJob) {
      jobs.get(currentJob)?.push(line);
    }
  }

  return new Map(Array.from(jobs.entries()).map(([k, v]) => [k, v.join('\n')]));
}

function executableText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

describe('deploy cross-environment governance: Production and Pilot isolation', () => {
  const rawYml = readFileSync(DEPLOY_YML, 'utf8');
  const jobs = parseWorkflowJobs(rawYml);

  it('stage-2-3-build-and-deploy targets environment: production and never references Pilot', () => {
    const prodJob = jobs.get('stage-2-3-build-and-deploy');
    expect(prodJob, 'missing stage-2-3-build-and-deploy job').toBeDefined();

    const exec = executableText(prodJob ?? '');
    expect(exec).toMatch(/^\s+environment:\s*production\s*$/m);
    expect(exec).not.toContain('wrangler.pilot.toml');
    expect(exec).not.toContain('sophia-ai-factory-pilot');
  });

  it('declares explicit workflow_dispatch opt-in deploy_pilot_explicit defaulting to false', () => {
    const exec = executableText(rawYml);
    expect(exec).toMatch(/deploy_pilot_explicit:\s*\n[\s\S]*?type:\s*boolean[\s\S]*?default:\s*false/);
  });

  it('every Pilot deploy job is gated on workflow_dispatch + deploy_pilot_explicit, targets environment: pilot, and verifies isolation', () => {
    const pilotJobs = Array.from(jobs.entries()).filter(([, body]) => {
      const exec = executableText(body);
      return exec.includes('wrangler.pilot.toml') || exec.includes('sophia-ai-factory-pilot');
    });

    expect(pilotJobs.length, 'expected at least one explicit Pilot deploy job').toBeGreaterThan(0);

    for (const [jobId, body] of pilotJobs) {
      const exec = executableText(body);
      expect(jobId, 'Pilot deploy must not live inside production deploy job').not.toBe('stage-2-3-build-and-deploy');
      expect(exec, `${jobId}: must target environment: pilot`).toMatch(/^\s+environment:\s*pilot\s*$/m);
      expect(exec, `${jobId}: must not target environment: production`).not.toMatch(/^\s+environment:\s*production\s*$/m);

      const ifMatch = exec.match(/^\s+if:\s*(.+)$/m);
      expect(ifMatch, `${jobId}: must declare an explicit job-level if: gate`).not.toBeNull();
      const condition = ifMatch?.[1] ?? '';
      expect(condition, `${jobId}: must gate on workflow_dispatch`).toContain("github.event_name == 'workflow_dispatch'");
      expect(condition, `${jobId}: must gate on inputs.deploy_pilot_explicit`).toContain('inputs.deploy_pilot_explicit == true');
      expect(condition, `${jobId}: must not run on push`).not.toContain("github.event_name == 'push'");

      expect(exec, `${jobId}: must run verify-pilot-wrangler-isolation.mjs --require-resolved-ids`).toMatch(
        /verify-pilot-wrangler-isolation\.mjs\s+--require-resolved-ids/,
      );
    }
  });

  it('retains workflow-level concurrency serialization with cancel-in-progress: false', () => {
    const exec = executableText(rawYml);
    expect(exec).toMatch(/^concurrency:\s*\n\s+group:\s*production-deploy\s*\n\s+cancel-in-progress:\s*false\s*$/m);
  });
});
