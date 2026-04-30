/**
 * Subtitle Generator Tests
 * Verifies: Workers AI binding mock response → SRT output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock('@/lib/video/r2-binding', () => ({
  getVideoBucket: vi.fn(),
}));

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateSubtitles } from '../subtitle-generator';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getVideoBucket } from '@/lib/video/r2-binding';

const mockArrayBuffer = () => Promise.resolve(new ArrayBuffer(1024));
const mockR2Obj = { arrayBuffer: mockArrayBuffer };

describe('generateSubtitles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty SRT when AI binding not available', async () => {
    vi.mocked(getCloudflareContext).mockResolvedValue({ env: {} } as never);

    const result = await generateSubtitles({ audioR2Key: 'audio.wav', jobId: 'job-1' });
    expect(result.srt).toBe('');
  });

  it('returns empty SRT when VIDEO_BUCKET not available', async () => {
    const mockAI = { run: vi.fn() };
    vi.mocked(getCloudflareContext).mockResolvedValue({ env: { AI: mockAI } } as never);
    vi.mocked(getVideoBucket).mockResolvedValue(null);

    const result = await generateSubtitles({ audioR2Key: 'audio.wav', jobId: 'job-2' });
    expect(result.srt).toBe('');
    expect(mockAI.run).not.toHaveBeenCalled();
  });

  it('returns empty SRT when R2 audio object not found', async () => {
    const mockAI = { run: vi.fn() };
    vi.mocked(getCloudflareContext).mockResolvedValue({ env: { AI: mockAI } } as never);
    const mockBucket = { get: vi.fn().mockResolvedValue(null) };
    vi.mocked(getVideoBucket).mockResolvedValue({ bucket: mockBucket as never, publicBaseUrl: null });

    const result = await generateSubtitles({ audioR2Key: 'missing.wav', jobId: 'job-3' });
    expect(result.srt).toBe('');
  });

  it('generates SRT from word-level Whisper output', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({
        text: 'Hello world',
        words: [
          { word: 'Hello', start: 0.0, end: 0.5 },
          { word: 'world', start: 0.6, end: 1.0 },
        ],
      }),
    };
    vi.mocked(getCloudflareContext).mockResolvedValue({ env: { AI: mockAI } } as never);
    const mockBucket = { get: vi.fn().mockResolvedValue(mockR2Obj) };
    vi.mocked(getVideoBucket).mockResolvedValue({ bucket: mockBucket as never, publicBaseUrl: null });

    const result = await generateSubtitles({ audioR2Key: 'audio.wav', jobId: 'job-4' });
    expect(result.srt).toContain('Hello world');
    expect(result.srt).toContain('-->');
  });

  it('falls back to single-block SRT when no word timestamps', async () => {
    const mockAI = {
      run: vi.fn().mockResolvedValue({ text: 'Full transcript here' }),
    };
    vi.mocked(getCloudflareContext).mockResolvedValue({ env: { AI: mockAI } } as never);
    const mockBucket = { get: vi.fn().mockResolvedValue(mockR2Obj) };
    vi.mocked(getVideoBucket).mockResolvedValue({ bucket: mockBucket as never, publicBaseUrl: null });

    const result = await generateSubtitles({ audioR2Key: 'audio.wav', jobId: 'job-5' });
    expect(result.srt).toContain('Full transcript here');
    expect(result.srt).toContain('00:00:00,000 --> 00:00:30,000');
  });
});
