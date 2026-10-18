import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEvidenceRecorder } from '../../../../scripts/live-proof/evidence.mjs';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('live proof evidence recorder', () => {
  it('redacts signed URLs and bearer tokens from free-text evidence messages', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophia-evidence-redaction-'));
    tempDirs.push(dir);
    const path = join(dir, 'evidence.json');
    const evidence = createEvidenceRecorder(path);
    evidence.record('failure', 'failed', {
      message: 'provider response included https://media.example/video.mp4?token=private-signature and Bearer abc123',
    });
    evidence.write('failed', 'response=https://media.example/video.mp4?token=private-signature Bearer abc123');

    const saved = readFileSync(path, 'utf8');
    expect(saved).not.toContain('private-signature');
    expect(saved).not.toContain('abc123');
    expect(saved).toContain('[URL_REDACTED]');
    expect(saved).toContain('Bearer [REDACTED]');
  });
});
