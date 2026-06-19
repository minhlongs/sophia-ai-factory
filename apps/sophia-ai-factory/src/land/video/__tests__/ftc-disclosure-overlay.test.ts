/**
 * ftc-disclosure-overlay.test.ts
 *
 * Tests for FTC disclosure overlay composition.
 * Uses the exported _setExecFileAsync test hook to inject a mock without
 * requiring real ffmpeg/ffprobe binaries in CI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { composeWithDisclosure, _setExecFileAsync, _resetExecFileAsync } from '../assembly/ftc-disclosure-overlay';

// The mock function that replaces execFile(Async)
const execFileMock = vi.fn();

describe('composeWithDisclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _setExecFileAsync(execFileMock);
  });

  afterEach(() => {
    _resetExecFileAsync();
  });

  it('calls ffprobe then ffmpeg with drawtext filter', async () => {
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '30.5' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await composeWithDisclosure('/tmp/test-video.mp4');

    expect(result.outputPath).toMatch(/ftc-.*\.mp4$/);
    expect(result.durationSec).toBe(3);

    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[0][0]).toBe('ffprobe');
    expect(execFileMock.mock.calls[0][1]).toContain('/tmp/test-video.mp4');

    expect(execFileMock.mock.calls[1][0]).toBe('ffmpeg');
    const vfArg = (execFileMock.mock.calls[1][1] as string[]).join(' ');
    expect(vfArg).toContain('drawtext');
    expect(vfArg).toContain('#ad');
    expect(vfArg).toContain('Affiliate link');
  });

  it('overlay starts at totalDuration - durationSec', async () => {
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '60.0' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await composeWithDisclosure('/tmp/video.mp4', { durationSec: 5 });

    const vfArg = (execFileMock.mock.calls[1][1] as string[]).join(' ');
    // enable='between(t,55.000,60.000)' — overlay starts at 60-5=55
    expect(vfArg).toContain('between(t,55.000,60.000)');
  });

  it('throws if ffprobe returns no duration', async () => {
    execFileMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ format: {} }),
      stderr: '',
    });

    await expect(composeWithDisclosure('/tmp/bad.mp4')).rejects.toThrow('could not determine duration');
  });

  it('respects custom fontSize and fontColor options', async () => {
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '20.0' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await composeWithDisclosure('/tmp/v.mp4', { fontSize: 32, fontColor: 'yellow' });

    const vfArg = (execFileMock.mock.calls[1][1] as string[]).join(' ');
    expect(vfArg).toContain('fontsize=32');
    expect(vfArg).toContain('fontcolor=yellow');
  });
});
