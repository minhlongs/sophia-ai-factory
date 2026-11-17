import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const WORKFLOWS_DIR = path.resolve(process.cwd(), '../../.github/workflows');

const CRON_WORKFLOW_SPECS = [
  {
    file: 'cron-fulfillment-reconcile.yml',
    cron: '0 6 * * *',
    url: 'https://sophia.agencyos.network/api/cron/fulfillment-reconcile',
  },
  {
    file: 'cron-fulfillment-retry.yml',
    cron: '*/2 * * * *',
    url: 'https://sophia.agencyos.network/api/cron/fulfillment-retry',
  },
  {
    file: 'cron-smoke-one-time.yml',
    cron: '*/15 * * * *',
    url: 'https://sophia.agencyos.network/api/cron/smoke-one-time',
  },
  {
    file: 'cron-video-status-sync.yml',
    cron: '*/5 * * * *',
    url: 'https://sophia.agencyos.network/api/cron/video-status-sync',
  },
] as const;

const tempDirs: string[] = [];

function readWorkflow(fileName: string): string {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, fileName), 'utf8');
}

function extractRunBlocks(source: string): string[] {
  const lines = source.split('\n');
  const blocks: string[] = [];
  let active: string[] | null = null;
  let baseIndent = 0;

  for (const line of lines) {
    const startMatch = line.match(/^(\s*)run:\s*\|\s*$/);
    if (startMatch) {
      if (active) blocks.push(active.join('\n'));
      active = [];
      baseIndent = startMatch[1].length + 2;
      continue;
    }
    if (active) {
      if (line.trim() === '') {
        active.push('');
        continue;
      }
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent < baseIndent) {
        blocks.push(active.join('\n'));
        active = null;
        continue;
      }
      active.push(line.slice(baseIndent));
    }
  }
  if (active) blocks.push(active.join('\n'));
  return blocks;
}

function runShellStepWithMockCurl(
  script: string,
  envVars: Record<string, string | undefined>,
  curlBehavior: { status?: string; exitCode?: number; body?: string } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-wf-test-'));
  tempDirs.push(dir);
  const argsLog = path.join(dir, 'curl-args.json');
  const mockCurl = path.join(dir, 'curl');

  const fakeCurlSource = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsLog)}, JSON.stringify(args));
const outIdx = args.indexOf('-o');
const outTarget = outIdx !== -1 ? args[outIdx + 1] : null;
const body = process.env.MOCK_CURL_BODY || 'LEAKED_RESPONSE_BODY_CONTENT';
if (outTarget && outTarget !== '/dev/null') {
  fs.writeFileSync(outTarget, body);
} else if (!outTarget) {
  process.stdout.write(body);
}
const exitCode = Number(process.env.MOCK_CURL_EXIT || '0');
if (exitCode !== 0) {
  process.stderr.write('curl: (' + exitCode + ') simulated transport failure\\n');
  process.exit(exitCode);
}
if (args.includes('-w')) {
  process.stdout.write(process.env.MOCK_CURL_STATUS || '200');
}
`;
  fs.writeFileSync(mockCurl, fakeCurlSource, { mode: 0o755 });

  const childEnv: NodeJS.ProcessEnv = {
    PATH: `${dir}:${process.env.PATH ?? ''}`,
    HOME: dir,
    MOCK_CURL_STATUS: curlBehavior.status ?? '200',
    MOCK_CURL_EXIT: String(curlBehavior.exitCode ?? 0),
    MOCK_CURL_BODY: curlBehavior.body ?? 'LEAKED_SECRET_BODY_PAYLOAD',
  };
  for (const [k, v] of Object.entries(envVars)) {
    if (v !== undefined) childEnv[k] = v;
  }

  const res = spawnSync('bash', ['-c', script], { env: childEnv, encoding: 'utf8' });
  const recordedArgs: string[] | null = fs.existsSync(argsLog)
    ? JSON.parse(fs.readFileSync(argsLog, 'utf8'))
    : null;

  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    recordedArgs,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('sophia-ingestion.yml and cron-*.yml workflow contracts', () => {
  const allFiles = ['sophia-ingestion.yml', ...CRON_WORKFLOW_SPECS.map((s) => s.file)];

  it('enforces environment: production, permissions, timeouts, and zero inline expressions in run blocks', () => {
    for (const file of allFiles) {
      const wf = readWorkflow(file);
      expect(wf).toMatch(/^permissions:\s*\n\s+contents:\s*read/m);
      expect(wf).toMatch(/^\s+environment:\s*production$/m);
      expect(wf).toMatch(/^\s+timeout-minutes:\s*\d+$/m);
      expect(wf).toContain('--connect-timeout');
      expect(wf).toContain('--max-time');
      expect(wf).toContain('-o /dev/null');
      expect(wf).not.toContain('non-blocking');
      expect(wf).not.toContain('secrets.APP_URL');

      const blocks = extractRunBlocks(wf);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).not.toContain('${{');
    }
  });

  it('preserves existing cron schedules and targets canonical production endpoints', () => {
    const ingestion = readWorkflow('sophia-ingestion.yml');
    expect(ingestion).toContain("- cron: '0 2 * * *'");
    expect(ingestion).toContain('https://sophia.agencyos.network/api/ingestion/trigger');

    for (const spec of CRON_WORKFLOW_SPECS) {
      const wf = readWorkflow(spec.file);
      expect(wf).toContain(`- cron: '${spec.cron}'`);
      expect(wf).toContain(spec.url);
    }
  });

  it('validates ingestion secrets, networks allowlist, and HTTP/transport failures without leaking bodies or secrets', () => {
    const [script] = extractRunBlocks(readWorkflow('sophia-ingestion.yml'));
    const token = 'ing-unit-secret-val';

    // Missing or blank secret fails before curl
    const noSecret = runShellStepWithMockCurl(script, { EVENT_NAME: 'schedule' });
    expect(noSecret.status).not.toBe(0);
    expect(noSecret.recordedArgs).toBeNull();

    // Schedule trigger with empty INPUT_NETWORKS defaults to clickbank,shareasale
    const scheduledOk = runShellStepWithMockCurl(script, {
      CRON_SECRET: token,
      EVENT_NAME: 'schedule',
      INPUT_NETWORKS: '',
    });
    expect(scheduledOk.status).toBe(0);
    expect(scheduledOk.recordedArgs).toContain('https://sophia.agencyos.network/api/ingestion/trigger');
    expect(scheduledOk.recordedArgs).toContain('{"networks":["clickbank","shareasale"]}');
    expect(scheduledOk.stdout + scheduledOk.stderr).not.toContain(token);
    expect(scheduledOk.stdout + scheduledOk.stderr).not.toContain('LEAKED_SECRET_BODY_PAYLOAD');

    // workflow_dispatch deduplicates valid networks and rejects malformed/unsupported/injected values
    const dispatchValid = runShellStepWithMockCurl(script, {
      CRON_SECRET: token,
      EVENT_NAME: 'workflow_dispatch',
      INPUT_NETWORKS: ' shareasale , clickbank , shareasale ',
    });
    expect(dispatchValid.status).toBe(0);
    expect(dispatchValid.recordedArgs).toContain('{"networks":["shareasale","clickbank"]}');

    for (const badInput of ['', '   ', 'clickbank,', 'awin', 'clickbank"}\n$(id)', 'clickbank;ls']) {
      const rejected = runShellStepWithMockCurl(script, {
        CRON_SECRET: token,
        EVENT_NAME: 'workflow_dispatch',
        INPUT_NETWORKS: badInput,
      });
      expect(rejected.status).not.toBe(0);
      expect(rejected.recordedArgs).toBeNull();
      expect(rejected.stdout + rejected.stderr).not.toContain('$(id)');
    }

    // HTTP 500, HTTP 401, and transport timeout fail hard without leaking body or secret
    const http500 = runShellStepWithMockCurl(
      script,
      { CRON_SECRET: token, EVENT_NAME: 'schedule', INPUT_NETWORKS: '' },
      { status: '500', body: 'DB_CREDENTIALS_IN_ERROR_BODY' }
    );
    expect(http500.status).not.toBe(0);
    expect(http500.stdout + http500.stderr).not.toContain('DB_CREDENTIALS_IN_ERROR_BODY');
    expect(http500.stdout + http500.stderr).not.toContain(token);

    const transportErr = runShellStepWithMockCurl(
      script,
      { CRON_SECRET: token, EVENT_NAME: 'schedule', INPUT_NETWORKS: '' },
      { exitCode: 28, body: 'TIMEOUT_BODY' }
    );
    expect(transportErr.status).not.toBe(0);
    expect(transportErr.stdout + transportErr.stderr).not.toContain('TIMEOUT_BODY');
    expect(transportErr.stdout + transportErr.stderr).not.toContain(token);
  });

  it('hard-fails all four cron workflows on missing secret, HTTP errors, and transport errors', () => {
    const token = 'cron-unit-secret-val';
    for (const spec of CRON_WORKFLOW_SPECS) {
      const [script] = extractRunBlocks(readWorkflow(spec.file));

      expect(runShellStepWithMockCurl(script, {}).status).not.toBe(0);
      expect(runShellStepWithMockCurl(script, { CRON_SECRET: '  ' }).status).not.toBe(0);

      const ok = runShellStepWithMockCurl(script, { CRON_SECRET: token }, { status: '200' });
      expect(ok.status).toBe(0);
      expect(ok.recordedArgs).toContain(spec.url);
      expect(ok.stdout + ok.stderr).not.toContain(token);
      expect(ok.stdout + ok.stderr).not.toContain('LEAKED_SECRET_BODY_PAYLOAD');

      const http401 = runShellStepWithMockCurl(
        script,
        { CRON_SECRET: token },
        { status: '401', body: 'UNAUTHORIZED_INTERNAL_DETAIL' }
      );
      expect(http401.status).not.toBe(0);
      expect(http401.stdout + http401.stderr).not.toContain('UNAUTHORIZED_INTERNAL_DETAIL');
      expect(http401.stdout + http401.stderr).not.toContain(token);

      const netFail = runShellStepWithMockCurl(script, { CRON_SECRET: token }, { exitCode: 7 });
      expect(netFail.status).not.toBe(0);
    }
  });
});
