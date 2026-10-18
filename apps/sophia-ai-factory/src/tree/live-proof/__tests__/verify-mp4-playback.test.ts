import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyMp4Playback } from '../../../../scripts/live-proof/media.mjs';

const tempRoots: string[] = [];
const mp4Bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
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

function createSuccessfulTools(root: string) {
  const ffprobePath = createTool(root, 'ffprobe', `
    const fs = require('node:fs');
    const input = process.argv.at(-1);
    if (!fs.existsSync(input) || fs.statSync(input).size === 0) process.exit(2);
    process.stdout.write(${JSON.stringify(JSON.stringify(metadata))});
  `);
  const ffmpegPath = createTool(root, 'ffmpeg', `
    const fs = require('node:fs');
    const inputArg = process.argv.indexOf('-i') + 1;
    if (inputArg < 1 || !fs.existsSync(process.argv[inputArg])) process.exit(2);
  `);
  return { ffprobePath, ffmpegPath };
}

function mediaResponse(body: Uint8Array = mp4Bytes, headers: Record<string, string> = {}) {
  return new Response(body, {
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
});
