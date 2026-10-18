import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMp4Brand, verifyMp4Playback } from '../../../../scripts/live-proof/media.mjs';

const tempRoots: string[] = [];
const mp4Bytes = new Uint8Array([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0,
  0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32,
]);
const metadata = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 320, height: 240 },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '1.25' },
};

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'sophia-media-proof-test-'));
  tempRoots.push(root);
  return root;
}

function createTool(root: string, name: string, body: string) {
  const toolsDir = join(root, 'tools');
  const file = join(toolsDir, name);
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

function createSuccessfulTools(root: string, probeMetadata = metadata) {
  const ffprobePath = createTool(root, 'ffprobe', `
    const fs = require('node:fs');
    const input = process.argv.at(-1);
    if (!fs.existsSync(input) || fs.statSync(input).size === 0) process.exit(2);
    process.stdout.write(${JSON.stringify(JSON.stringify(probeMetadata))});
  `);
  const ffmpegPath = createTool(root, 'ffmpeg', `
    const fs = require('node:fs');
    const inputArg = process.argv.indexOf('-i') + 1;
    if (inputArg < 1 || !fs.existsSync(process.argv[inputArg])) process.exit(2);
  `);
  return { ffprobePath, ffmpegPath };
}

function mediaResponse(body: Uint8Array = mp4Bytes, headers: Record<string, string> = {}) {
  const responseBody = Uint8Array.from(body).buffer as ArrayBuffer;
  return new Response(responseBody, {
    status: 200,
    headers: {
      'content-length': String(body.byteLength),
      'content-type': 'video/mp4',
      ...headers,
    },
  });
}

function leftoverDownloads(root: string) {
  return readdirSync(root).filter((name) => name.startsWith('sophia-live-video-'));
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempRoots.length > 0) rmSync(tempRoots.pop()!, { recursive: true, force: true });
});

describe('verifyMp4Playback', () => {
  it('downloads the entire allowlisted artifact and probes plus decodes it', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const tools = createSuccessfulTools(root);

    const result = await verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    });

    expect(result).toMatchObject({
      status: 200,
      contentType: 'video/mp4',
      totalBytes: mp4Bytes.byteLength,
      majorBrand: 'isom',
      compatibleMp4Brand: 'isom',
      formatName: metadata.format.format_name,
      durationSec: 1.25,
      videoStreams: [{ codec: 'h264', width: 320, height: 240 }],
      audioStreams: [{ codec: 'aac' }],
      fullDecode: true,
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://files2.heygen.ai/video.mp4'), expect.objectContaining({
      method: 'GET',
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    }));
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects an untrusted media URL before making a request', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn();
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://127.0.0.1/admin', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('not on the approved HeyGen media allowlist');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects a non-MP4 ISO BMFF brand even when ffprobe can decode it', async () => {
    const root = createTempRoot();
    const quickTimeBytes = Uint8Array.from(mp4Bytes);
    quickTimeBytes.set([0x71, 0x74, 0x20, 0x20], 8);
    quickTimeBytes.set([0x71, 0x74, 0x20, 0x20], 16);
    quickTimeBytes.set([0x71, 0x74, 0x20, 0x20], 20);
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse(quickTimeBytes));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('does not declare a recognized MP4 brand');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('uses the complete ftyp box and rejects broad ISO-like brands', async () => {
    expect(isMp4Brand('isoa')).toBe(false);
    const root = createTempRoot();
    const laterCompatibleBrand = Uint8Array.from([
      0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70,
      0x71, 0x74, 0x20, 0x20, 0, 0, 2, 0,
      0x71, 0x74, 0x20, 0x20, 0x71, 0x74, 0x20, 0x20,
      0x6d, 0x70, 0x34, 0x32, 0x71, 0x74, 0x20, 0x20,
    ]);
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse(laterCompatibleBrand));
    const tools = createSuccessfulTools(root);

    const result = await verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    });

    expect(result).toMatchObject({ majorBrand: 'qt  ', compatibleMp4Brand: 'mp42' });
    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects an explicit non-MP4 content type', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse(mp4Bytes, { 'content-type': 'video/webm' }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('content type is not MP4-compatible');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects unsuccessful full-download HTTP responses', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(new Response('provider unavailable', { status: 503 }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('full media download returned HTTP 503');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects an empty artifact even when the response itself is successful', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('media artifact download was empty');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects ffprobe output that identifies a non-MP4 container', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const tools = createSuccessfulTools(root, {
      streams: metadata.streams,
      format: { format_name: 'matroska,webm', duration: '1.25' },
    });

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('ffprobe did not identify an MP4 container');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects redirects to untrusted hosts', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/admin' },
    }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('not on the approved HeyGen media allowlist');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects an artifact larger than the configured limit from its header', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse(mp4Bytes, { 'content-length': '13' }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      maxBytes: 12,
      ...tools,
    })).rejects.toThrow('exceeds the configured download size limit');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('enforces the byte limit while streaming when content length is absent', async () => {
    const root = createTempRoot();
    const oversized = new Uint8Array(25);
    oversized.set(mp4Bytes);
    const fetchMock = vi.fn().mockResolvedValue(new Response(Uint8Array.from(oversized).buffer as ArrayBuffer, {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    }));
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      maxBytes: 24,
      ...tools,
    })).rejects.toThrow('exceeds the configured download size limit');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects a truncated artifact and removes its partial temporary file', async () => {
    const root = createTempRoot();
    const response = new Response(mp4Bytes, {
      status: 200,
      headers: { 'content-length': '1024', 'content-type': 'video/mp4' },
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ...tools,
    })).rejects.toThrow('truncated or changed size');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects missing video metadata and cleans the complete temporary download', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const ffprobePath = createTool(root, 'ffprobe', `process.stdout.write(JSON.stringify({ streams: [], format: { format_name: 'mp4', duration: '1' } }));`);
    const ffmpegPath = createTool(root, 'ffmpeg', 'process.exit(0);');

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ffprobePath,
      ffmpegPath,
    })).rejects.toThrow('no decodable video stream');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects decode failures and cleans the temporary file', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const ffprobePath = createSuccessfulTools(root).ffprobePath;
    const ffmpegPath = createTool(root, 'ffmpeg', 'process.exit(1);');

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ffprobePath,
      ffmpegPath,
    })).rejects.toThrow('ffmpeg full decode failed (exit 1)');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('rejects invalid timeout overrides instead of allowing unbounded work', async () => {
    const root = createTempRoot();

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      tempRoot: root,
      downloadTimeoutMs: 0,
    })).rejects.toThrow('downloadTimeoutMs must be between');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('aborts a stalled full download within its configured timeout', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn((_url: URL, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      downloadTimeoutMs: 25,
    })).rejects.toThrow('full media download exceeded its time limit');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('aborts a response body that stalls after headers arrive', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn((_url: URL, init: RequestInit) => Promise.resolve(new Response(new ReadableStream({
      start(controller) {
        init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
      },
    }), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    })));

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      downloadTimeoutMs: 25,
    })).rejects.toThrow('media artifact download exceeded its time limit');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('kills a decoder that exceeds its configured timeout', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const ffprobePath = createSuccessfulTools(root).ffprobePath;
    const ffmpegPath = createTool(root, 'ffmpeg', 'setTimeout(() => {}, 10000);');

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ffprobePath,
      ffmpegPath,
      decodeTimeoutMs: 50,
    })).rejects.toThrow('ffmpeg full decode timed out');

    expect(leftoverDownloads(root)).toEqual([]);
  });

  it('escalates to SIGKILL when a timed-out decoder ignores SIGTERM', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const ffprobePath = createSuccessfulTools(root).ffprobePath;
    const ffmpegPath = createTool(root, 'ffmpeg', "process.on('SIGTERM', () => {}); setInterval(() => {}, 10000);");

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      ffprobePath,
      ffmpegPath,
      decodeTimeoutMs: 25,
    })).rejects.toThrow('ffmpeg full decode timed out');

    expect(leftoverDownloads(root)).toEqual([]);
  }, 5000);

  it('fails the proof when temporary-file cleanup fails', async () => {
    const root = createTempRoot();
    const fetchMock = vi.fn().mockResolvedValue(mediaResponse());
    const tools = createSuccessfulTools(root);

    await expect(verifyMp4Playback('https://files2.heygen.ai/video.mp4', {
      fetchImpl: fetchMock,
      tempRoot: root,
      removeTempDirectory: async () => { throw new Error('simulated file system failure'); },
      ...tools,
    })).rejects.toThrow('temporary media cleanup failed');
  });
});
