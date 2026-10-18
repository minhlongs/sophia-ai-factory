import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const ALLOWED_MEDIA_HOSTS = new Set(['files2.heygen.ai']);
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_PROBE_TIMEOUT_MS = 30 * 1000;
const DEFAULT_DECODE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TOOL_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_MAX_BUFFER_BYTES = 1024 * 1024;
const ALLOWED_MP4_MIME_TYPES = new Set(['video/mp4', 'application/mp4', 'application/octet-stream', 'binary/octet-stream']);
const ALLOWED_MP4_BRANDS = new Set([
  'isom', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4VH', 'M4VP', 'M4A ', 'M4B ', 'M4P ', 'M4S ',
  'M4T ', 'dash', 'MSNV', 'F4V ', 'F4P ', 'F4A ', 'F4B ',
]);

export function isMp4Brand(brand) {
  return ALLOWED_MP4_BRANDS.has(brand) || /^iso[2-9a-z]$/.test(brand);
}

export function isMp4FormatName(formatName) {
  return typeof formatName === 'string' && formatName.toLowerCase().split(',').includes('mp4');
}

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

async function requestFullMedia(initialUrl, signal, fetchImpl) {
  let url = validateMediaUrl(initialUrl);
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
    if (error?.killed === true) throw new Error(`${label} timed out`);
    if (typeof error?.code === 'number') throw new Error(`${label} failed${code}`);
    throw new Error(`${label} could not run`);
  }
}

function validatePositiveTimeout(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_TOOL_TIMEOUT_MS) {
    throw new Error(`${label} must be between 1 and ${MAX_TOOL_TIMEOUT_MS} milliseconds`);
  }
}

async function verifyMp4FileType(filePath, fileSize) {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 16 || header.toString('ascii', 4, 8) !== 'ftyp') {
      throw new Error('media artifact is missing an ISO BMFF ftyp box');
    }

    const shortSize = header.readUInt32BE(0);
    const extended = shortSize === 1;
    const majorOffset = extended ? 16 : 8;
    const compatibleOffset = majorOffset + 8;
    if (bytesRead < compatibleOffset) throw new Error('media ftyp box is truncated');
    const boxSize = extended ? Number(header.readBigUInt64BE(8)) : shortSize;
    if (!Number.isSafeInteger(boxSize) || boxSize < compatibleOffset || boxSize > fileSize) {
      throw new Error('media ftyp box size is invalid');
    }

    const brands = [header.toString('ascii', majorOffset, majorOffset + 4)];
    for (let offset = compatibleOffset; offset + 4 <= Math.min(bytesRead, boxSize); offset += 4) {
      brands.push(header.toString('ascii', offset, offset + 4));
    }
    const mp4Brand = brands.find(isMp4Brand);
    if (!mp4Brand) throw new Error('media artifact does not declare a recognized MP4 brand');
    return { majorBrand: brands[0], compatibleMp4Brand: mp4Brand };
  } finally {
    await handle.close();
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
  if (!isMp4FormatName(formatName)) throw new Error('ffprobe did not identify an MP4 container');

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
    removeTempDirectory = rm,
    tempRoot = tmpdir(),
    maxBytes = DEFAULT_MAX_BYTES,
    downloadTimeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS,
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    decodeTimeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
  } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_DOWNLOAD_BYTES) {
    throw new Error(`media download size limit must be between 1 and ${MAX_DOWNLOAD_BYTES} bytes`);
  }
  validatePositiveTimeout(downloadTimeoutMs, 'downloadTimeoutMs');
  validatePositiveTimeout(probeTimeoutMs, 'probeTimeoutMs');
  validatePositiveTimeout(decodeTimeoutMs, 'decodeTimeoutMs');

  const tempDirectory = await mkdtemp(join(tempRoot, 'sophia-live-video-'));
  const filePath = join(tempDirectory, 'artifact.mp4');
  try {
    let response;
    const downloadSignal = AbortSignal.timeout(downloadTimeoutMs);
    try {
      response = await requestFullMedia(url, downloadSignal, fetchImpl);
    } catch (error) {
      if (downloadSignal.aborted) throw new Error('full media download exceeded its time limit');
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
    const contentType = (response.headers.get('content-type') ?? 'unknown').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'unknown' && !ALLOWED_MP4_MIME_TYPES.has(contentType)) {
      await response.body.cancel().catch(() => undefined);
      throw new Error('media artifact content type is not MP4-compatible');
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
      if (downloadSignal.aborted) throw new Error('media artifact download exceeded its time limit');
      throw new Error(error instanceof Error && error.message.includes('size limit') ? error.message : 'media artifact download was incomplete');
    }
    if (totalBytes === 0) throw new Error('media artifact download was empty');
    if (declaredBytes !== null && totalBytes !== declaredBytes) {
      throw new Error('media artifact download was truncated or changed size');
    }

    const fileInfo = await stat(filePath);
    if (fileInfo.size !== totalBytes) throw new Error('temporary media file size does not match downloaded bytes');
    const mp4FileType = await verifyMp4FileType(filePath, fileInfo.size);

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
      contentType,
      totalBytes,
      declaredBytes,
      sha256: digest.digest('hex'),
      ...mp4FileType,
      ...metadata,
      fullDecode: true,
    };
  } finally {
    try {
      await removeTempDirectory(tempDirectory, { recursive: true, force: true });
    } catch {
      throw new Error('temporary media cleanup failed');
    }
  }
}
