/**
 * ISO BMFF H.264/AVC1 MP4 Container Muxer (`ftyp` `isom` + `moov`/`avc1`/`avcC` + `mdat`).
 *
 * Pure foundational binary helpers (seed layer — zero external or DOM dependencies).
 *
 * @module seed/video/pilot-mp4-muxer
 */

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n & 0xffff, false);
  return b;
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i) & 0x7f;
  }
  return out;
}

export function concatBytes(...arrays: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function mp4Box(type: string, ...payloads: readonly Uint8Array[]): Uint8Array {
  const body = concatBytes(...payloads);
  return concatBytes(u32(8 + body.length), asciiBytes(type), body);
}

function mp4FullBox(
  type: string,
  version: number,
  flags: number,
  ...payloads: readonly Uint8Array[]
): Uint8Array {
  const vf = new Uint8Array([
    version & 0xff,
    (flags >>> 16) & 0xff,
    (flags >>> 8) & 0xff,
    flags & 0xff,
  ]);
  return mp4Box(type, vf, ...payloads);
}

export interface Avc1SampleEntry {
  readonly lengthPrefixedNals: Uint8Array;
  readonly durationTicks: number;
  readonly isKeyframe: boolean;
}

export interface MuxAvc1Mp4Input {
  readonly width: number;
  readonly height: number;
  readonly timescale: number;
  readonly spsNal: Uint8Array;
  readonly ppsNal: Uint8Array;
  readonly samples: readonly Avc1SampleEntry[];
}

export function muxAvc1Mp4(input: MuxAvc1Mp4Input): Uint8Array {
  const { width, height, timescale, spsNal, ppsNal, samples } = input;
  if (samples.length === 0) {
    throw new Error('muxAvc1Mp4 requires at least one video sample');
  }

  const totalDuration = samples.reduce((acc, item) => acc + Math.max(1, item.durationTicks), 0);
  const ftyp = mp4Box('ftyp', asciiBytes('isom'), u32(0x200), asciiBytes('isomiso2avc1mp41'));

  const avcC = mp4Box(
    'avcC',
    Uint8Array.from([1, spsNal[1] ?? 66, spsNal[2] ?? 0xc0, spsNal[3] ?? 31, 0xff, 0xe1]),
    u16(spsNal.length),
    spsNal,
    Uint8Array.from([1]),
    u16(ppsNal.length),
    ppsNal,
  );

  const avc1 = mp4Box(
    'avc1',
    new Uint8Array(6),
    u16(1),
    new Uint8Array(16),
    u16(width),
    u16(height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    new Uint8Array(32),
    u16(0x0018),
    Uint8Array.from([0xff, 0xff]),
    avcC,
  );

  const stsd = mp4FullBox('stsd', 0, 0, u32(1), avc1);
  const stts = mp4FullBox(
    'stts',
    0,
    0,
    u32(samples.length),
    concatBytes(...samples.map((s) => concatBytes(u32(1), u32(Math.max(1, s.durationTicks))))),
  );
  const keyframeIndexes = samples
    .map((s, idx) => (s.isKeyframe ? idx + 1 : -1))
    .filter((idx) => idx > 0);
  const stss = mp4FullBox(
    'stss',
    0,
    0,
    u32(keyframeIndexes.length),
    concatBytes(...keyframeIndexes.map((idx) => u32(idx))),
  );
  const stsc = mp4FullBox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1));
  const stsz = mp4FullBox(
    'stsz',
    0,
    0,
    u32(0),
    u32(samples.length),
    concatBytes(...samples.map((s) => u32(s.lengthPrefixedNals.length))),
  );

  const identityMatrix = concatBytes(
    u32(0x00010000),
    u32(0),
    u32(0),
    u32(0),
    u32(0x00010000),
    u32(0),
    u32(0),
    u32(0),
    u32(0x40000000),
  );

  const buildMoov = (chunkOffset: number): Uint8Array => {
    const stco = mp4FullBox('stco', 0, 0, u32(1), u32(chunkOffset));
    const stbl = mp4Box('stbl', stsd, stts, stss, stsc, stsz, stco);
    const vmhd = mp4FullBox('vmhd', 0, 1, new Uint8Array(8));
    const dref = mp4FullBox('dref', 0, 0, u32(1), mp4FullBox('url ', 0, 1));
    const dinf = mp4Box('dinf', dref);
    const minf = mp4Box('minf', vmhd, dinf, stbl);
    const mdhd = mp4FullBox(
      'mdhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(timescale),
      u32(totalDuration),
      u16(0x55c4),
      u16(0),
    );
    const hdlr = mp4FullBox(
      'hdlr',
      0,
      0,
      u32(0),
      asciiBytes('vide'),
      new Uint8Array(12),
      asciiBytes('VideoHandler\0'),
    );
    const mdia = mp4Box('mdia', mdhd, hdlr, minf);
    const tkhd = mp4FullBox(
      'tkhd',
      0,
      3,
      u32(0),
      u32(0),
      u32(1),
      u32(0),
      u32(totalDuration),
      new Uint8Array(8),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      identityMatrix,
      u32(width << 16),
      u32(height << 16),
    );
    const trak = mp4Box('trak', tkhd, mdia);
    const mvhd = mp4FullBox(
      'mvhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(timescale),
      u32(totalDuration),
      u32(0x00010000),
      u16(0x0100),
      new Uint8Array(10),
      identityMatrix,
      new Uint8Array(24),
      u32(2),
    );
    return mp4Box('moov', mvhd, trak);
  };

  const mdatBody = concatBytes(...samples.map((s) => s.lengthPrefixedNals));
  const placeholderMoov = buildMoov(0);
  const chunkOffset = ftyp.length + placeholderMoov.length + 8;
  const moov = buildMoov(chunkOffset);
  const mdat = mp4Box('mdat', mdatBody);
  return concatBytes(ftyp, moov, mdat);
}

export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
