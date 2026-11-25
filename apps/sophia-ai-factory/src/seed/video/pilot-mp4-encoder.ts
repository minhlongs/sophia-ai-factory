/**
 * Deterministic 1-Key H.264/AVC1 MP4 Encoder for Customer Pilot Validation.
 *
 * Produces a genuine ISO BMFF `.mp4` (`ftyp` `isom`, `avc1` H.264 Baseline Profile)
 * from RGBA frames (rendered via Canvas in the browser or synthetic RGBA buffer in tests)
 * with embedded scene slides, CTA end-card, and verified referral link — requiring
 * zero secondary AI provider keys and zero server-side FFmpeg/GPU containers.
 *
 * @module seed/video/pilot-mp4-encoder
 */

import { concatBytes, muxAvc1Mp4, sha256HexOfBytes, type Avc1SampleEntry } from './pilot-mp4-muxer';

export interface PilotMp4SlideSpec {
  readonly label: string;
  readonly headline: string;
  readonly body: string;
  readonly footerCta: string;
  readonly referralShortUrl: string;
  readonly durationSec: number;
  readonly accentIndex: number;
}

export interface EncodedPilotMp4Artifact {
  readonly bytes: Uint8Array;
  readonly sha256Hex: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
  readonly codec: 'h264';
  readonly containerBrand: 'isom';
}

class H264BitWriter {
  private readonly bytes: number[] = [];
  private current = 0;
  private bitCount = 0;

  writeBit(bit: number): void {
    this.current = (this.current << 1) | (bit & 1);
    this.bitCount += 1;
    if (this.bitCount === 8) {
      this.bytes.push(this.current);
      this.current = 0;
      this.bitCount = 0;
    }
  }

  writeBits(val: number, count: number): void {
    for (let i = count - 1; i >= 0; i -= 1) {
      this.writeBit((val >>> i) & 1);
    }
  }

  writeUE(val: number): void {
    const code = val + 1;
    let len = 0;
    let tmp = code;
    while (tmp > 0) {
      len += 1;
      tmp >>>= 1;
    }
    for (let i = 0; i < len - 1; i += 1) this.writeBit(0);
    this.writeBits(code, len);
  }

  writeSE(val: number): void {
    this.writeUE(val <= 0 ? -2 * val : 2 * val - 1);
  }

  alignZero(): void {
    while (this.bitCount !== 0) this.writeBit(0);
  }

  writeAlignedBytes(buf: Uint8Array): void {
    this.alignZero();
    for (let i = 0; i < buf.length; i += 1) {
      this.bytes.push(buf[i] ?? 0);
    }
  }

  rbspTrailingBits(): void {
    this.writeBit(1);
    this.alignZero();
  }

  toRbsp(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function rbspToEbsp(rbsp: Uint8Array): Uint8Array {
  const out: number[] = [];
  let zeros = 0;
  for (let i = 0; i < rbsp.length; i += 1) {
    const b = rbsp[i] ?? 0;
    if (zeros === 2 && b <= 3) {
      out.push(0x03);
      zeros = 0;
    }
    out.push(b);
    zeros = b === 0 ? zeros + 1 : 0;
  }
  return Uint8Array.from(out);
}

function buildNal(headerByte: number, rbsp: Uint8Array): Uint8Array {
  const ebsp = rbspToEbsp(rbsp);
  const out = new Uint8Array(1 + ebsp.length);
  out[0] = headerByte;
  out.set(ebsp, 1);
  return out;
}

export function buildBaselineSpsNal(width: number, height: number): Uint8Array {
  const mbW = width / 16;
  const mbH = height / 16;
  const bw = new H264BitWriter();
  bw.writeBits(66, 8);
  bw.writeBit(1);
  bw.writeBit(1);
  bw.writeBit(0);
  bw.writeBits(0, 5);
  bw.writeBits(31, 8);
  bw.writeUE(0);
  bw.writeUE(0);
  bw.writeUE(2);
  bw.writeUE(0);
  bw.writeBit(0);
  bw.writeUE(mbW - 1);
  bw.writeUE(mbH - 1);
  bw.writeBit(1);
  bw.writeBit(0);
  bw.writeBit(0);
  bw.writeBit(0);
  bw.rbspTrailingBits();
  return buildNal(0x67, bw.toRbsp());
}

export function buildBaselinePpsNal(): Uint8Array {
  const bw = new H264BitWriter();
  bw.writeUE(0);
  bw.writeUE(0);
  bw.writeBit(0);
  bw.writeBit(0);
  bw.writeUE(0);
  bw.writeUE(0);
  bw.writeUE(0);
  bw.writeBit(0);
  bw.writeBits(0, 2);
  bw.writeSE(0);
  bw.writeSE(0);
  bw.writeSE(0);
  bw.writeBit(1);
  bw.writeBit(0);
  bw.writeBit(0);
  bw.rbspTrailingBits();
  return buildNal(0x68, bw.toRbsp());
}

function rgbaToYuv420Macroblocks(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const mbCols = width / 16;
  const mbRows = height / 16;
  const out = new Uint8Array(mbCols * mbRows * 384);
  let outOffset = 0;

  const clampByte = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  for (let mbY = 0; mbY < mbRows; mbY += 1) {
    for (let mbX = 0; mbX < mbCols; mbX += 1) {
      const baseX = mbX * 16;
      const baseY = mbY * 16;

      for (let dy = 0; dy < 16; dy += 1) {
        const rowOffset = (baseY + dy) * width;
        for (let dx = 0; dx < 16; dx += 1) {
          const idx = (rowOffset + baseX + dx) * 4;
          const r = rgba[idx] ?? 0;
          const g = rgba[idx + 1] ?? 0;
          const b = rgba[idx + 2] ?? 0;
          const y = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
          out[outOffset] = clampByte(y);
          outOffset += 1;
        }
      }

      const cbOffset = outOffset;
      const crOffset = outOffset + 64;
      let cIdx = 0;
      for (let cy = 0; cy < 8; cy += 1) {
        const y0 = baseY + cy * 2;
        for (let cx = 0; cx < 8; cx += 1) {
          const x0 = baseX + cx * 2;
          const p0 = (y0 * width + x0) * 4;
          const r = rgba[p0] ?? 0;
          const g = rgba[p0 + 1] ?? 0;
          const b = rgba[p0 + 2] ?? 0;
          const cb = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
          const cr = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
          out[cbOffset + cIdx] = clampByte(cb);
          out[crOffset + cIdx] = clampByte(cr);
          cIdx += 1;
        }
      }
      outOffset += 128;
    }
  }
  return out;
}

function encodeIdrIpcmSample(
  rgba: Uint8Array,
  width: number,
  height: number,
  idrPicId: number,
): Uint8Array {
  const yuvMbs = rgbaToYuv420Macroblocks(rgba, width, height);
  const totalMbs = (width / 16) * (height / 16);
  const bw = new H264BitWriter();
  bw.writeUE(0);
  bw.writeUE(7);
  bw.writeUE(0);
  bw.writeBits(0, 4);
  bw.writeUE(idrPicId & 0x7fff);
  bw.writeBit(0);
  bw.writeBit(0);
  bw.writeSE(0);
  bw.writeUE(1);

  for (let m = 0; m < totalMbs; m += 1) {
    bw.writeUE(25);
    bw.alignZero();
    const start = m * 384;
    bw.writeAlignedBytes(yuvMbs.subarray(start, start + 384));
  }
  bw.rbspTrailingBits();

  const nal = buildNal(0x65, bw.toRbsp());
  const lenPrefix = new Uint8Array(4);
  new DataView(lenPrefix.buffer).setUint32(0, nal.length, false);
  return concatBytes(lenPrefix, nal);
}

/**
 * Deterministic fallback RGBA frame synthesizer when DOM `<canvas>` is absent (Node/SSR tests).
 */
export function renderDeterministicRgbaSlide(
  slide: PilotMp4SlideSpec,
  width: number,
  height: number,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const textSeed = `${slide.label}|${slide.headline}|${slide.footerCta}|${slide.referralShortUrl}`;
  let hash = 2166136261;
  for (let i = 0; i < textSeed.length; i += 1) {
    hash ^= textSeed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const accentR = 99 + ((slide.accentIndex * 37) % 90);
  const accentG = 102 + ((hash >>> 8) & 0x3f);
  const accentB = 241;

  for (let y = 0; y < height; y += 1) {
    const isHeaderBand = y >= 24 && y <= 80;
    const isCtaBand = y >= height - 120 && y <= height - 36;
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (isCtaBand && x >= 24 && x <= width - 24) {
        rgba[idx] = 245;
        rgba[idx + 1] = 158;
        rgba[idx + 2] = 11;
      } else if (isHeaderBand && x >= 24 && x <= width - 24) {
        rgba[idx] = accentR;
        rgba[idx + 1] = accentG;
        rgba[idx + 2] = accentB;
      } else {
        rgba[idx] = 15 + ((y * 24) / height) | 0;
        rgba[idx + 1] = 23 + ((x * 18) / width) | 0;
        rgba[idx + 2] = 42;
      }
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

export async function encodePilotSlidesToMp4(options: {
  readonly slides: readonly PilotMp4SlideSpec[];
  readonly width?: number;
  readonly height?: number;
  readonly renderRgbaFrame?: (slide: PilotMp4SlideSpec, width: number, height: number) => Uint8Array;
}): Promise<EncodedPilotMp4Artifact> {
  const width = options.width ?? 320;
  const height = options.height ?? 576;
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new Error(`MP4 dimensions (${width}x${height}) must be multiples of 16`);
  }
  if (options.slides.length === 0) {
    throw new Error('At least one slide is required to encode MP4');
  }

  const timescale = 100;
  const frameRenderer = options.renderRgbaFrame ?? renderDeterministicRgbaSlide;
  const spsNal = buildBaselineSpsNal(width, height);
  const ppsNal = buildBaselinePpsNal();

  const samples: Avc1SampleEntry[] = options.slides.map((slide, index) => {
    const clampedSec = Math.max(1, Math.min(120, Number(slide.durationSec) || 5));
    const rgba = frameRenderer(slide, width, height);
    return {
      lengthPrefixedNals: encodeIdrIpcmSample(rgba, width, height, index),
      durationTicks: Math.round(clampedSec * timescale),
      isKeyframe: true,
    };
  });

  const bytes = muxAvc1Mp4({
    width,
    height,
    timescale,
    spsNal,
    ppsNal,
    samples,
  });
  const totalDurationSec = Number(
    (samples.reduce((sum, s) => sum + s.durationTicks, 0) / timescale).toFixed(2),
  );
  const sha256Hex = await sha256HexOfBytes(bytes);

  return {
    bytes,
    sha256Hex,
    byteSize: bytes.byteLength,
    width,
    height,
    durationSec: totalDurationSec,
    codec: 'h264',
    containerBrand: 'isom',
  };
}
