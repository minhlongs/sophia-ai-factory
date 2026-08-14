/**
 * FFmpeg Muxer Unit Tests
 *
 * Mocks Cloudconvert API and R2 binding. Verifies:
 * - Correct Cloudconvert job payload construction
 * - Polling loop terminates on job finish
 * - Final mp4 is uploaded to R2
 * - Idempotency: returns existing URL when R2 object already present
 * - Error when CLOUDCONVERT_API_KEY is absent (no silent stub)
 * - Error propagation on Cloudconvert failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockGetVideoBucket } = vi.hoisted(() => ({
  mockGetVideoBucket: vi.fn(),
}));

vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: mockGetVideoBucket,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('SERVER_ERROR'),
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

import { muxVideoAudio } from '../assembly/ffmpeg-muxer';
import type { R2BucketRef } from '@/land/video/storage/r2-binding';

// ── Helpers ────────────────────────────────────────────────────────────────────

const STUB_OUTPUT_KEY = 'videos/mission-123.mp4';
const STUB_VIDEO_URL = 'https://cdn.example.com/video.mp4';
const STUB_AUDIO_URL = 'https://cdn.example.com/audio.mp3';
const STUB_MUXED_URL = 'https://cloudconvert.com/download/muxed.mp4';
const PUBLIC_BASE = 'https://videos.sophia.agencyos.network';

function buildBucketRef(overrides?: Partial<{ head: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; publicBaseUrl: string | null }>): R2BucketRef {
  const mockHead = overrides?.head ?? vi.fn().mockResolvedValue(null);
  const mockPut = overrides?.put ?? vi.fn().mockResolvedValue(undefined);
  const publicBaseUrl = overrides?.publicBaseUrl !== undefined ? overrides.publicBaseUrl : PUBLIC_BASE;
  return {
    bucket: { head: mockHead, put: mockPut } as unknown as R2Bucket,
    publicBaseUrl,
  };
}

/** Build a successful Cloudconvert jobs/{id} response body. */
function cloudconvertFinishedResponse() {
  return {
    data: {
      status: 'finished',
      tasks: [
        { name: 'import-video', status: 'finished' },
        { name: 'import-audio', status: 'finished' },
        { name: 'mux-ffmpeg', status: 'finished' },
        {
          name: 'export-muxed',
          status: 'finished',
          result: { files: [{ url: STUB_MUXED_URL, size: 1024 }] },
        },
      ],
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('muxVideoAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing object in R2
    mockGetVideoBucket.mockResolvedValue(buildBucketRef());
    // Default: no CLOUDCONVERT_API_KEY
    delete process.env.CLOUDCONVERT_API_KEY;
  });

  afterEach(() => {
    delete process.env.CLOUDCONVERT_API_KEY;
  });

  // ── Missing API key (no silent stub) ──────────────────────────────────────────

  it('throws when CLOUDCONVERT_API_KEY is absent', async () => {
    // No CLOUDCONVERT_API_KEY set (deleted in beforeEach)
    await expect(
      muxVideoAudio({
        videoUrl: STUB_VIDEO_URL,
        audioUrl: STUB_AUDIO_URL,
        outputKey: STUB_OUTPUT_KEY,
      }),
    ).rejects.toThrow(/CLOUDCONVERT_API_KEY is required/);
  });

  it('does not write stub mp4 or call R2 when API key absent', async () => {
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const ref = buildBucketRef({ put: mockPut });
    mockGetVideoBucket.mockResolvedValue(ref);

    await expect(
      muxVideoAudio({
        videoUrl: STUB_VIDEO_URL,
        audioUrl: STUB_AUDIO_URL,
        outputKey: STUB_OUTPUT_KEY,
      }),
    ).rejects.toThrow();

    expect(mockPut).not.toHaveBeenCalled();
  });

  // ── Idempotency ──────────────────────────────────────────────────────────────

  it('returns existing URL without calling Cloudconvert when object already in R2', async () => {
    const mockHead = vi.fn().mockResolvedValue({ size: 2048 });
    const mockPut = vi.fn();
    const ref = buildBucketRef({ head: mockHead, put: mockPut });
    mockGetVideoBucket.mockResolvedValue(ref);
    process.env.CLOUDCONVERT_API_KEY = 'test-key';

    // fetch should never be called
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await muxVideoAudio({
      videoUrl: STUB_VIDEO_URL,
      audioUrl: STUB_AUDIO_URL,
      outputKey: STUB_OUTPUT_KEY,
    });

    expect(mockPut).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.url).toBe(`${PUBLIC_BASE}/${STUB_OUTPUT_KEY}`);
  });

  it('proceeds with muxing when head() returns null (object absent)', async () => {
    const mockHead = vi.fn().mockResolvedValue(null);
    const ref = buildBucketRef({ head: mockHead });
    mockGetVideoBucket.mockResolvedValue(ref);
    process.env.CLOUDCONVERT_API_KEY = 'test-key';

    // Mock Cloudconvert: POST /jobs → poll /jobs/{id} once → download
    let fetchCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      fetchCallCount++;
      if (typeof url === 'string' && url.includes('/jobs') && !url.match(/jobs\/[a-z]/)) {
        // POST create job
        return { ok: true, json: async () => ({ data: { id: 'job-abc' } }) } as Response;
      }
      if (typeof url === 'string' && url.includes('/jobs/job-abc')) {
        // GET poll
        return { ok: true, json: async () => cloudconvertFinishedResponse() } as Response;
      }
      // Download muxed file
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1024) } as Response;
    });

    const result = await muxVideoAudio({
      videoUrl: STUB_VIDEO_URL,
      audioUrl: STUB_AUDIO_URL,
      outputKey: STUB_OUTPUT_KEY,
    });

    expect(result.url).toBe(`${PUBLIC_BASE}/${STUB_OUTPUT_KEY}`);
    expect(fetchCallCount).toBeGreaterThanOrEqual(3); // create + poll + download
  });

  // ── Cloudconvert happy path ──────────────────────────────────────────────────

  it('submits correct ffmpeg_parameters and output_format to Cloudconvert', async () => {
    process.env.CLOUDCONVERT_API_KEY = 'my-api-key';
    const capturedBodies: unknown[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/jobs') && init?.method === 'POST') {
        capturedBodies.push(JSON.parse(init.body as string));
        return { ok: true, json: async () => ({ data: { id: 'job-xyz' } }) } as Response;
      }
      if (urlStr.includes('/jobs/job-xyz')) {
        return { ok: true, json: async () => cloudconvertFinishedResponse() } as Response;
      }
      // download
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(512) } as Response;
    });

    await muxVideoAudio({
      videoUrl: STUB_VIDEO_URL,
      audioUrl: STUB_AUDIO_URL,
      outputKey: STUB_OUTPUT_KEY,
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0] as { tasks: Record<string, { operation: string; ffmpeg_parameters?: string; output_format?: string }> };
    expect(body.tasks['import-video'].operation).toBe('import/url');
    expect(body.tasks['import-audio'].operation).toBe('import/url');
    expect(body.tasks['mux-ffmpeg'].operation).toBe('convert');
    expect(body.tasks['mux-ffmpeg'].output_format).toBe('mp4');
    expect(body.tasks['mux-ffmpeg'].ffmpeg_parameters).toContain('-map 0:v:0');
    expect(body.tasks['mux-ffmpeg'].ffmpeg_parameters).toContain('-map 1:a:0');
    expect(body.tasks['export-muxed'].operation).toBe('export/url');
  });

  it('uploads downloaded muxed mp4 to R2 after Cloudconvert completes', async () => {
    process.env.CLOUDCONVERT_API_KEY = 'my-api-key';
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const ref = buildBucketRef({ put: mockPut });
    mockGetVideoBucket.mockResolvedValue(ref);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/jobs')) {
        return { ok: true, json: async () => ({ data: { id: 'job-put' } }) } as Response;
      }
      if (urlStr.includes('/jobs/job-put')) {
        return { ok: true, json: async () => cloudconvertFinishedResponse() } as Response;
      }
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4096) } as Response;
    });

    const result = await muxVideoAudio({
      videoUrl: STUB_VIDEO_URL,
      audioUrl: STUB_AUDIO_URL,
      outputKey: STUB_OUTPUT_KEY,
    });

    expect(mockPut).toHaveBeenCalledOnce();
    const [putKey] = mockPut.mock.calls[0] as [string];
    expect(putKey).toBe(STUB_OUTPUT_KEY);
    expect(result.url).toBe(`${PUBLIC_BASE}/${STUB_OUTPUT_KEY}`);
  });

  // ── Error paths ──────────────────────────────────────────────────────────────

  it('throws when Cloudconvert job creation fails', async () => {
    process.env.CLOUDCONVERT_API_KEY = 'bad-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as unknown as Response);

    await expect(
      muxVideoAudio({
        videoUrl: STUB_VIDEO_URL,
        audioUrl: STUB_AUDIO_URL,
        outputKey: STUB_OUTPUT_KEY,
      }),
    ).rejects.toThrow(/job creation failed.*401/);
  });

  it('throws when Cloudconvert job ends with error status', async () => {
    process.env.CLOUDCONVERT_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/jobs')) {
        return { ok: true, json: async () => ({ data: { id: 'job-err' } }) } as Response;
      }
      // Return error status job
      return {
        ok: true,
        json: async () => ({
          data: {
            status: 'error',
            tasks: [{ name: 'mux-ffmpeg', status: 'error', message: 'Invalid codec' }],
          },
        }),
      } as Response;
    });

    await expect(
      muxVideoAudio({
        videoUrl: STUB_VIDEO_URL,
        audioUrl: STUB_AUDIO_URL,
        outputKey: STUB_OUTPUT_KEY,
      }),
    ).rejects.toThrow(/errored.*Invalid codec/);
  });

  it('throws when no export URL is in the finished job result', async () => {
    process.env.CLOUDCONVERT_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/jobs')) {
        return { ok: true, json: async () => ({ data: { id: 'job-nourl' } }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            status: 'finished',
            tasks: [{ name: 'export-muxed', status: 'finished', result: { files: [] } }],
          },
        }),
      } as Response;
    });

    await expect(
      muxVideoAudio({
        videoUrl: STUB_VIDEO_URL,
        audioUrl: STUB_AUDIO_URL,
        outputKey: STUB_OUTPUT_KEY,
      }),
    ).rejects.toThrow(/No output URL/);
  });
});
