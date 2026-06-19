/**
 * crypto-disclaimer-overlay.test.ts
 *
 * Uses _setExecFileAsync test hook (same pattern as ftc-disclosure-overlay.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  composeWithCryptoDisclaimer,
  _setExecFileAsync,
  _resetExecFileAsync,
} from '../assembly/crypto-disclaimer-overlay';

const execFileMock = vi.fn();

describe('composeWithCryptoDisclaimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _setExecFileAsync(execFileMock);
  });

  afterEach(() => {
    _resetExecFileAsync();
  });

  it('calls ffprobe then ffmpeg with drawtext filter for US', async () => {
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '60.0' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await composeWithCryptoDisclaimer('/tmp/video.mp4', 'US');

    expect(execFileMock).toHaveBeenCalledTimes(2);

    // First call = ffprobe
    expect(execFileMock.mock.calls[0][0]).toBe('ffprobe');

    // Second call = ffmpeg with drawtext
    expect(execFileMock.mock.calls[1][0]).toBe('ffmpeg');
    const ffmpegArgs = execFileMock.mock.calls[1][1] as string[];
    expect(ffmpegArgs).toContain('-vf');
    const vfArg = ffmpegArgs[ffmpegArgs.indexOf('-vf') + 1];
    expect(vfArg).toContain('drawtext=text=');

    // Result fields
    expect(result.durationSec).toBe(15);
    expect(result.jurisdiction).toBe('US');
    expect(result.outputPath).toMatch(/crypto-disc-.+\.mp4$/);
    expect(result.disclaimerPreview).toBeTruthy();
  });

  it('overlay starts 15s before end by default', async () => {
    const videoDuration = 60;
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: String(videoDuration) } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await composeWithCryptoDisclaimer('/tmp/video.mp4', 'EU');

    const ffmpegArgs = execFileMock.mock.calls[1][1] as string[];
    const vfArg = ffmpegArgs[ffmpegArgs.indexOf('-vf') + 1];
    // enable starts at 60-15=45
    expect(vfArg).toContain('45.000');
  });

  it('uses Vietnamese disclaimer text when locale=vi', async () => {
    execFileMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '30.0' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await composeWithCryptoDisclaimer('/tmp/video.mp4', 'US', { locale: 'vi' });

    const ffmpegArgs = execFileMock.mock.calls[1][1] as string[];
    const vfArg = ffmpegArgs[ffmpegArgs.indexOf('-vf') + 1];
    // Vietnamese full disclaimer for US should contain "biến động cao"
    expect(vfArg).toContain('bi\u1ebfn \u0111\u1ed9ng cao');
    expect(vfArg).toContain('drawtext=text=');
  });

  it('throws when ffprobe returns no duration', async () => {
    execFileMock.mockResolvedValueOnce({ stdout: '{}', stderr: '' });
    await expect(
      composeWithCryptoDisclaimer('/tmp/video.mp4', 'SG')
    ).rejects.toThrow('ffprobe: cannot determine duration');
  });
});
