import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-user-video-flow-live-evidence.mjs');
const tempDirs: string[] = [];
const deploymentSha = 'abcdef1234567890abcdef1234567890abcdef12';
const shortSha = deploymentSha.slice(0, 8);

function makeEvidence(overrides: Record<string, unknown> = {}) {
  const context = {
    runId: 'run-1',
    baseUrl: 'https://sophia.agencyos.network',
    deployment: { sha: deploymentSha, shortSha, version: '1.19.9' },
    channelProviders: ['telegram', 'youtube'],
    missionId: 'mission-1',
    videoId: '00000000-0000-4000-8000-000000000001',
    heygenJobId: 'heygen-1',
    distributionJobIds: ['job-1', 'job-2'],
  };
  const events = [
    ['deployment-version', { sha: deploymentSha, shortSha }],
    ['sign-in', { cookieCount: 1 }],
    ['save-llm-byok', { providers: ['openrouter'] }],
    ['save-heygen-credential', { provider: 'heygen' }],
    ['channel-preflight', { activeProviders: ['telegram', 'youtube'] }],
    ['openclaw-exchange', { userIdPresent: true }],
    ['auto-video', { status: 'succeeded' }],
    ['heygen-completion', { status: 'completed', videoUrlPresent: true }],
    ['video-row', { status: 'completed', videoUrlPresent: true }],
    ['video-full-decode', {
      status: 200,
      totalBytes: 1024,
      sha256: 'a'.repeat(64),
      majorBrand: 'isom',
      compatibleMp4Brand: 'mp42',
      formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
      durationSec: 12,
      videoStreams: [{ codec: 'h264', width: 720, height: 1280 }],
      audioStreams: [{ codec: 'aac' }],
      fullDecode: true,
    }],
    ['distribution-scheduled', { jobIds: ['job-1', 'job-2'] }],
    ['publish-jobs-live', {
      jobs: [
        { id: 'job-1', provider: 'telegram', status: 'live' },
        { id: 'job-2', provider: 'youtube', status: 'completed' },
      ],
    }],
  ].map(([step, data]) => ({ step, status: 'passed', data }));

  return {
    schema: 'sophia-live-user-video-flow-proof-v4',
    status: 'passed',
    context,
    events,
    ...overrides,
  };
}

function writeEvidenceFile(data: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-live-evidence-'));
  tempDirs.push(dir);
  const file = join(dir, 'evidence.json');
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

function runValidator(path: string, args: string[] = []) {
  return spawnSync(process.execPath, [scriptPath, ...args, path], {
    cwd: resolve('.'),
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('verify-user-video-flow-live-evidence', () => {
  it('accepts a complete live proof artifact', () => {
    const result = runValidator(writeEvidenceFile(makeEvidence()));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE VIDEO EVIDENCE STRUCTURE PASS');
  });

  it('rejects artifacts that are not passed', () => {
    const result = runValidator(writeEvidenceFile(makeEvidence({ status: 'failed' })));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('evidence status is not passed');
  });

  it('rejects legacy evidence that cannot prove full download and decoding', () => {
    const result = runValidator(writeEvidenceFile(makeEvidence({ schema: 'sophia-live-user-video-flow-proof-v3' })));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('only v4 full-download/full-decode evidence can pass');
  });

  it('rejects publish jobs that did not reach a successful status', () => {
    const evidence = makeEvidence();
    const publish = (evidence.events as Array<{ step: string; data: { jobs?: Array<{ status: string }> } }>)
      .find((event) => event.step === 'publish-jobs-live');
    publish!.data.jobs![1].status = 'failed';

    const result = runValidator(writeEvidenceFile(evidence));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('status not successful');
  });

  it('rejects a completed video without a full-decode proof', () => {
    const evidence = makeEvidence();
    evidence.events = evidence.events.filter((event) => event.step !== 'video-full-decode');

    const result = runValidator(writeEvidenceFile(evidence));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('required step not passed: video-full-decode');
  });

  it('rejects a video artifact whose decode did not complete', () => {
    const evidence = makeEvidence();
    const artifact = evidence.events.find((event) => event.step === 'video-full-decode') as
      { data: Record<string, unknown> } | undefined;
    artifact!.data.fullDecode = false;

    const result = runValidator(writeEvidenceFile(evidence));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('did not prove a full audio/video decode');
  });

  it('rejects a non-MP4-compatible container brand', () => {
    const evidence = makeEvidence();
    const artifact = evidence.events.find((event) => event.step === 'video-full-decode') as
      { data: Record<string, unknown> } | undefined;
    artifact!.data.compatibleMp4Brand = 'qt  ';

    const result = runValidator(writeEvidenceFile(evidence));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not prove an MP4-compatible brand');
  });

  it('rejects evidence whose decoder metadata names a non-MP4 container', () => {
    const evidence = makeEvidence();
    const artifact = evidence.events.find((event) => event.step === 'video-full-decode') as
      { data: Record<string, unknown> } | undefined;
    artifact!.data.formatName = 'matroska,webm';

    const result = runValidator(writeEvidenceFile(evidence));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('container metadata does not identify MP4');
  });

  it('accepts a preflight proof artifact only in preflight mode', () => {
    const preflight = makeEvidence({
      status: 'preflight-passed',
      context: {
        runId: 'run-preflight',
        baseUrl: 'https://sophia.agencyos.network',
        deployment: { sha: deploymentSha, shortSha, version: '1.19.9' },
        channelProviders: ['telegram', 'youtube'],
      },
      events: [
        ['deployment-version', { sha: deploymentSha, shortSha }],
        ['sign-in', { cookieCount: 1 }],
        ['save-llm-byok', { providers: ['openrouter'] }],
        ['save-heygen-credential', { provider: 'heygen' }],
        ['channel-preflight', { activeProviders: ['telegram', 'youtube'] }],
      ].map(([step, data]) => ({ step, status: 'passed', data })),
    });
    const file = writeEvidenceFile(preflight);

    expect(runValidator(file).status).not.toBe(0);

    const result = runValidator(file, ['--preflight']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LIVE PREFLIGHT EVIDENCE PASS');
  });
});
