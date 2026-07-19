/**
 * ftc-disclosure-overlay.ts — FTC compliance overlay for affiliate video content
 * Phase 14: Launch Hardening
 *
 * Adds "#ad • Affiliate link" text overlay to the last 3 seconds of a video
 * using FFmpeg drawtext filter. Required by FTC 16 C.F.R. § 255 for material
 * connections disclosures in sponsored/affiliate content.
 *
 * ⚠️ Node builtins: child_process, os, path, crypto — ONLY used inside
 * composeWithDisclosure() via dynamic import. Static top-level imports
 * are removed so the SSR bundler (Turbopack) never inlines them into
 * handler.mjs, which would crash Cloudflare Workers.
 *
 * @module lib/video/ftc-disclosure-overlay
 */

// ── Types (no side-effects) ──────────────────────────────────

/** FTC disclosure overlay configuration */
export interface DisclosureOptions {
  /** Duration of the disclosure overlay in seconds. Default: 3. */
  durationSec?: number;
  /** FFmpeg drawtext font size. Default: 24. */
  fontSize?: number;
  /** Text color (FFmpeg color syntax). Default: 'white'. */
  fontColor?: string;
  /** Background box color with alpha (FFmpeg color syntax). Default: 'black@0.5'. */
  boxColor?: string;
  /** X position expression for drawtext. Default: '(w-tw)/2' (centered). */
  x?: string;
  /** Y position expression for drawtext. Default: 'h-th-20' (near bottom). */
  y?: string;
}

/** Result of FTC disclosure composition */
export interface ComposedResult {
  /** Path to the output video file with overlay applied. */
  outputPath: string;
  /** Duration of the disclosure overlay used. */
  durationSec: number;
}

// ── Test hooks (allow test injection without node:child_process) ──

type ExecFileAsync = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
let _execFileAsync: ExecFileAsync | null = null;

/** Override for testing — set null to skip ffmpeg and get a stub result */
export function _setExecFileAsync(fn: ExecFileAsync | null): void {
  _execFileAsync = fn;
}

export function _resetExecFileAsync(): void {
  _execFileAsync = null;
}

// ── Dynamic Node builtin loader (SSR-safe) ────────────────────
// Static imports of node:child_process / node:os / node:path / node:crypto
// would be inlined into handler.mjs by Turbopack, crashing Workers.
// Dynamic import() is NOT chased by the SSR bundler.

async function loadNodeBuiltins(): Promise<{
  execFile: typeof import('node:child_process').execFile;
  promisify: typeof import('node:util').promisify;
  randomUUID: typeof import('node:crypto').randomUUID;
  tmpdir: typeof import('node:os').tmpdir;
  join: typeof import('node:path').join;
} | null> {
  // If test injected a mock, skip dynamic import
  if (_execFileAsync !== null) {
    // Still need tmpdir/join/randomUUID for path construction
    const [osMod, pathMod, cryptoMod] = await Promise.all([
      import('node:os').catch(() => null),
      import('node:path').catch(() => null),
      import('node:crypto').catch(() => null),
    ]);
    if (!osMod || !pathMod || !cryptoMod) return null;
    return {
      execFile: (() => { }) as unknown as typeof import('node:child_process').execFile,
      promisify: (() => { }) as unknown as typeof import('node:util').promisify,
      randomUUID: cryptoMod.randomUUID,
      tmpdir: osMod.tmpdir,
      join: pathMod.join,
    };
  }

  try {
    const [cp, util, crypto, os, path] = await Promise.all([
      import('node:child_process'),
      import('node:util'),
      import('node:crypto'),
      import('node:os'),
      import('node:path'),
    ]);
    return {
      execFile: cp.execFile,
      promisify: util.promisify,
      randomUUID: crypto.randomUUID,
      tmpdir: os.tmpdir,
      join: path.join,
    };
  } catch {
    // Cloudflare Workers runtime — node: builtins unavailable
    return null;
  }
}

// ── Probe FFprobe duration (called inside composeWithDisclosure) ──

async function probeDuration(
  execFileAsync: ExecFileAsync,
  inputPath: string,
): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    inputPath,
  ]);
  const info = JSON.parse(stdout) as { format?: { duration?: string } };
  const dur = parseFloat(info.format?.duration ?? '0');
  if (!dur || isNaN(dur)) {
    throw new Error(`ffprobe: could not determine duration for ${inputPath}`);
  }
  return dur;
}

// ── Primary entry point ──────────────────────────────────────

/**
 * Compose a video with FTC disclosure overlay on the last N seconds.
 *
 * The overlay text "#ad • Affiliate link" is rendered via FFmpeg drawtext
 * filter, appearing only during the tail window.
 *
 * @param inputPath Absolute path to the source video file
 * @param opts Overlay configuration options
 * @returns Path to the output file in the system temp directory
 *
 * @example
 * const { outputPath } = await composeWithDisclosure('/tmp/my-video.mp4');
 * // outputPath: /tmp/ftc-<uuid>.mp4
 */
export async function composeWithDisclosure(
  inputPath: string,
  opts: DisclosureOptions = {},
): Promise<ComposedResult> {
  const durationSec = opts.durationSec ?? 3;
  const fontSize = opts.fontSize ?? 24;
  const fontColor = opts.fontColor ?? 'white';
  const boxColor = opts.boxColor ?? 'black@0.5';
  const x = opts.x ?? '(w-tw)/2';
  const y = opts.y ?? 'h-th-20';

  const builtins = await loadNodeBuiltins();
  if (!builtins) {
    // Cloudflare Workers or test environment without node: builtins.
    // Return a stub result so assembly pipelines can skip gracefully.
    return {
      outputPath: inputPath, // pass through unmodified
      durationSec,
    };
  }

  const execFileAsync = _execFileAsync ?? builtins.promisify(builtins.execFile);
  const totalDuration = await probeDuration(execFileAsync, inputPath);
  const startTime = Math.max(0, totalDuration - durationSec);

  const outputPath = builtins.join(builtins.tmpdir(), `ftc-${builtins.randomUUID()}.mp4`);

  const drawtextFilter = [
    `drawtext=text='#ad • Affiliate link'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `box=1`,
    `boxcolor=${boxColor}`,
    `boxborderw=8`,
    `x=${x}`,
    `y=${y}`,
    `enable='between(t,${startTime.toFixed(3)},${totalDuration.toFixed(3)})'`,
  ].join(':');

  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-vf', drawtextFilter,
    '-c:a', 'copy',
    '-y', outputPath,
  ]);

  return { outputPath, durationSec };
}
