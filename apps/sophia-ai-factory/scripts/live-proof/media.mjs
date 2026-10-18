import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const ALLOWED_MEDIA_HOSTS = new Set(['files2.heygen.ai']);
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_PROBE_TIMEOUT_MS = 30 * 1000;
const DEFAULT_DECODE_TIMEOUT_MS = 5 * 60 * 1000;
const PROCESS_MAX_BUFFER_BYTES = 1024 * 1024;

function validateMediaUrl(input, baseUrl) {
  let url;
  try {
    url = baseUrl ? new URL(input, baseUrl) : new URL(input);
  } catch {
    throw new Error('media URL must be an absolute HTTPS URL');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !ALLOWED_MEDIA_HOSTS.has(hostname)) {
    throw new Error('media URL host is not on the approved HeyGen media allowlist');
  }
  return url;
}

async function requestFullMedia(initialUrl, timeoutMs, fetchImpl) {
  let url = validateMediaUrl(initialUrl);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);
    if (!location) throw new Error('media redirect has no Location header');
    if (redirects === MAX_REDIRECTS) throw new Error('media redirect limit exceeded');
    url = validateMediaUrl(location, url);
  }
  throw new Error('media redirect limit exceeded');
}

async function runTool(binary, args, timeoutMs, label) {
  try {
    return await execFile(binary, args, {
      timeout: timeoutMs,
      maxBuffer: PROCESS_MAX_BUFFER_BYTES,
      windowsHide: true,
      encoding: 'utf8',
    });
  } catch (error) {
    const code = typeof error?.code === 'number' ? ` (exit ${error.code})` : '';
    const timedOut = error?.killed === true ? ' before timeout' : '';
    throw new Error(`${label} failed${code}${timedOut}`);
  }
}

function parseProbeOutput(stdout) {
  let metadata;
  try {
    metadata = JSON.parse(stdout);
  } catch {
    throw new Error('ffprobe returned invalid metadata');
  }

  const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
  const videoStreams = streams
    .filter((stream) => stream?.codec_type === 'video' && typeof stream.codec_name === 'string')
    .map((stream) => ({
      codec: stream.codec_name,
      width: Number.isInteger(stream.width) && stream.width > 0 ? stream.width : null,
      height: Number.isInteger(stream.height) && stream.height > 0 ? stream.height : null,
    }));
  const audioStreams = streams
    .filter((stream) => stream?.codec_type === 'audio' && typeof stream.codec_name === 'string')
    .map((stream) => ({ codec: stream.codec_name }));
  const durationSec = Number(metadata?.format?.duration);
  const formatName = typeof metadata?.format?.format_name === 'string' ? metadata.format.format_name : null;

  if (videoStreams.length === 0) throw new Error('media has no decodable video stream');
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('media duration is missing or invalid');
  if (!formatName) throw new Error('media container metadata is missing');

  return { formatName, durationSec, videoStreams, audioStreams };
}

/**
 * Download and decode the complete remote artifact. The exact provider host,
 * redirects, bytes, download time, and child-process time are all bounded.
 * This proves decodability of every audio/video stream, not perceptual quality.
 */
export async function verifyMp4Playback(url, options = {}) {
  const {
    fetchImpl = fetch,
    ffprobePath = 'ffprobe',
    ffmpegPath = 'ffmpeg',
    tempRoot = tmpdir(),
    maxBytes = DEFAULT_MAX_BYTES,
    downloadTimeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS,
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    decodeTimeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
  } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('media download size limit is invalid');

  const tempDirectory = await mkdtemp(join(tempRoot, 'sophia-live-video-'));
  const filePath = join(tempDirectory, 'artifact.mp4');
  try {
    let response;
    try {
      response = await requestFullMedia(url, downloadTimeoutMs, fetchImpl);
    } catch (error) {
      throw new Error(`full media download failed: ${error instanceof Error ? error.message : 'network error'}`);
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`full media download returned HTTP ${response.status}`);
    }
    if (!response.body) throw new Error('full media download returned an empty body');

    const rawLength = response.headers.get('content-length');
    const declaredBytes = rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;
    if (declaredBytes !== null && (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes)) {
      await response.body.cancel().catch(() => undefined);
      throw new Error('media artifact exceeds the configured download size limit');
    }
    const contentEncoding = (response.headers.get('content-encoding') ?? 'identity').toLowerCase();
    if (contentEncoding !== 'identity') {
      await response.body.cancel().catch(() => undefined);
      throw new Error('media artifact must use identity content encoding');
    }

    const digest = createHash('sha256');
    let totalBytes = 0;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          callback(new Error('media artifact exceeds the configured download size limit'));
          return;
        }
        digest.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(filePath, { flags: 'wx' }));
    } catch (error) {
      throw new Error(error instanceof Error && error.message.includes('size limit')
        ? error.message
        : 'media artifact download was incomplete');
    }
    if (totalBytes === 0) throw new Error('media artifact download was empty');
    if (declaredBytes !== null && totalBytes !== declaredBytes) {
      throw new Error('media artifact download was truncated or changed size');
    }

    const fileInfo = await stat(filePath);
    if (fileInfo.size !== totalBytes) throw new Error('temporary media file size does not match downloaded bytes');

    const probe = await runTool(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration:stream=codec_name,codec_type,width,height',
      '-of', 'json',
      filePath,
    ], probeTimeoutMs, 'ffprobe');
    const metadata = parseProbeOutput(probe.stdout);

    await runTool(ffmpegPath, [
      '-hide_banner', '-nostdin', '-v', 'error', '-xerror',
      '-i', filePath,
      '-map', '0:v?',
      '-map', '0:a?',
      '-f', 'null',
      '-',
    ], decodeTimeoutMs, 'ffmpeg full decode');

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'unknown',
      totalBytes,
      declaredBytes,
      sha256: digest.digest('hex'),
      ...metadata,
      fullDecode: true,
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
