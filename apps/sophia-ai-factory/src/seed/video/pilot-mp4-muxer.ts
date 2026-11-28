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

export interface AacAudioSampleEntry {
  readonly rawAacFrame: Uint8Array;
  readonly durationSamples: number;
}

export interface MuxAvc1AacMp4Input extends MuxAvc1Mp4Input {
  readonly audioSampleRate: number;
  readonly audioChannelCount: number;
  readonly audioSamples: readonly AacAudioSampleEntry[];
}

const AAC_SAMPLE_RATE_INDEX: Readonly<Record<number, number>> = {
  96000: 0,
  88200: 1,
  64000: 2,
  48000: 3,
  44100: 4,
  32000: 5,
  24000: 6,
  22050: 7,
  16000: 8,
  12000: 9,
  11025: 10,
  8000: 11,
};

/** Builds ISO 14496-3 AudioSpecificConfig for AAC-LC (objectType=2). */
export function buildAacAudioSpecificConfig(
  sampleRate: number,
  channelCount: number,
): Uint8Array {
  const freqIdx = AAC_SAMPLE_RATE_INDEX[sampleRate];
  if (freqIdx === undefined) {
    throw new Error(`Unsupported AAC sample rate: ${sampleRate}`);
  }
  if (channelCount < 1 || channelCount > 2) {
    throw new Error(`Unsupported AAC channel count: ${channelCount}`);
  }
  // 5 bits objectType (2 = AAC-LC) | 4 bits freqIdx | 4 bits channelCount | 3 bits 0
  const byte0 = (2 << 3) | ((freqIdx >> 1) & 0x07);
  const byte1 = ((freqIdx & 0x01) << 7) | ((channelCount & 0x0f) << 3);
  return Uint8Array.from([byte0, byte1]);
}

function buildEsdsBox(audioSpecificConfig: Uint8Array): Uint8Array {
  const decSpecificInfo = concatBytes(
    Uint8Array.from([0x05, audioSpecificConfig.length]),
    audioSpecificConfig,
  );
  const decConfigDescrBody = concatBytes(
    Uint8Array.from([
      0x40, // objectTypeIndication: MPEG-4 Audio
      0x15, // streamType: AudioStream (5 << 2 | 1)
      0x00, 0x00, 0x00, // bufferSizeDB
      0x00, 0x01, 0xf4, 0x00, // maxBitrate (128000)
      0x00, 0x01, 0xf4, 0x00, // avgBitrate (128000)
    ]),
    decSpecificInfo,
  );
  const decConfigDescr = concatBytes(
    Uint8Array.from([0x04, decConfigDescrBody.length]),
    decConfigDescrBody,
  );
  const slConfigDescr = Uint8Array.from([0x06, 0x01, 0x02]);
  const esDescrBody = concatBytes(
    u16(2), // ES_ID
    Uint8Array.from([0x00]), // flags
    decConfigDescr,
    slConfigDescr,
  );
  const esDescr = concatBytes(Uint8Array.from([0x03, esDescrBody.length]), esDescrBody);
  return mp4FullBox('esds', 0, 0, esDescr);
}

/**
 * Muxes H.264/AVC1 video samples + AAC-LC audio samples into a valid ISO BMFF MP4
 * with two tracks (`vide` track 1 + `soun` track 2) and exact chunk offsets.
 */
export function muxAvc1AacMp4(input: MuxAvc1AacMp4Input): Uint8Array {
  const {
    width,
    height,
    timescale,
    spsNal,
    ppsNal,
    samples,
    audioSampleRate,
    audioChannelCount,
    audioSamples,
  } = input;

  if (samples.length === 0) {
    throw new Error('muxAvc1AacMp4 requires at least one video sample');
  }
  if (audioSamples.length === 0) {
    throw new Error('muxAvc1AacMp4 requires at least one audio sample');
  }
  for (const frame of audioSamples) {
    if (frame.rawAacFrame.byteLength === 0 || frame.durationSamples <= 0) {
      throw new Error('Malformed AAC audio sample');
    }
  }

  const videoDurationTicks = samples.reduce((acc, item) => acc + Math.max(1, item.durationTicks), 0);
  const audioDurationSamples = audioSamples.reduce((acc, item) => acc + item.durationSamples, 0);
  const audioDurationInMovieTimescale = Math.round(
    (audioDurationSamples / audioSampleRate) * timescale,
  );
  const movieDurationTicks = Math.max(videoDurationTicks, audioDurationInMovieTimescale);

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
  const vStsd = mp4FullBox('stsd', 0, 0, u32(1), avc1);
  const vStts = mp4FullBox(
    'stts',
    0,
    0,
    u32(samples.length),
    concatBytes(...samples.map((s) => concatBytes(u32(1), u32(Math.max(1, s.durationTicks))))),
  );
  const keyframeIndexes = samples
    .map((s, idx) => (s.isKeyframe ? idx + 1 : -1))
    .filter((idx) => idx > 0);
  const vStss = mp4FullBox(
    'stss',
    0,
    0,
    u32(keyframeIndexes.length),
    concatBytes(...keyframeIndexes.map((idx) => u32(idx))),
  );
  const vStsc = mp4FullBox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1));
  const vStsz = mp4FullBox(
    'stsz',
    0,
    0,
    u32(0),
    u32(samples.length),
    concatBytes(...samples.map((s) => u32(s.lengthPrefixedNals.length))),
  );

  const asc = buildAacAudioSpecificConfig(audioSampleRate, audioChannelCount);
  const esds = buildEsdsBox(asc);
  const mp4a = mp4Box(
    'mp4a',
    new Uint8Array(6),
    u16(1),
    new Uint8Array(8),
    u16(audioChannelCount),
    u16(16),
    u16(0),
    u16(0),
    u32(audioSampleRate << 16),
    esds,
  );
  const aStsd = mp4FullBox('stsd', 0, 0, u32(1), mp4a);
  const aStts = mp4FullBox(
    'stts',
    0,
    0,
    u32(audioSamples.length),
    concatBytes(...audioSamples.map((s) => concatBytes(u32(1), u32(s.durationSamples)))),
  );
  const aStsc = mp4FullBox('stsc', 0, 0, u32(1), u32(1), u32(audioSamples.length), u32(1));
  const aStsz = mp4FullBox(
    'stsz',
    0,
    0,
    u32(0),
    u32(audioSamples.length),
    concatBytes(...audioSamples.map((s) => u32(s.rawAacFrame.byteLength))),
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
  const dref = mp4FullBox('dref', 0, 0, u32(1), mp4FullBox('url ', 0, 1));
  const dinf = mp4Box('dinf', dref);

  const buildMoov = (videoOffset: number, audioOffset: number): Uint8Array => {
    const vStco = mp4FullBox('stco', 0, 0, u32(1), u32(videoOffset));
    const vStbl = mp4Box('stbl', vStsd, vStts, vStss, vStsc, vStsz, vStco);
    const vmhd = mp4FullBox('vmhd', 0, 1, new Uint8Array(8));
    const vMinf = mp4Box('minf', vmhd, dinf, vStbl);
    const vMdhd = mp4FullBox(
      'mdhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(timescale),
      u32(videoDurationTicks),
      u16(0x55c4),
      u16(0),
    );
    const vHdlr = mp4FullBox(
      'hdlr',
      0,
      0,
      u32(0),
      asciiBytes('vide'),
      new Uint8Array(12),
      asciiBytes('VideoHandler\0'),
    );
    const vMdia = mp4Box('mdia', vMdhd, vHdlr, vMinf);
    const vTkhd = mp4FullBox(
      'tkhd',
      0,
      3,
      u32(0),
      u32(0),
      u32(1),
      u32(0),
      u32(videoDurationTicks),
      new Uint8Array(8),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      identityMatrix,
      u32(width << 16),
      u32(height << 16),
    );
    const vTrak = mp4Box('trak', vTkhd, vMdia);

    const aStco = mp4FullBox('stco', 0, 0, u32(1), u32(audioOffset));
    const aStbl = mp4Box('stbl', aStsd, aStts, aStsc, aStsz, aStco);
    const smhd = mp4FullBox('smhd', 0, 0, new Uint8Array(4));
    const aMinf = mp4Box('minf', smhd, dinf, aStbl);
    const aMdhd = mp4FullBox(
      'mdhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(audioSampleRate),
      u32(audioDurationSamples),
      u16(0x55c4),
      u16(0),
    );
    const aHdlr = mp4FullBox(
      'hdlr',
      0,
      0,
      u32(0),
      asciiBytes('soun'),
      new Uint8Array(12),
      asciiBytes('SoundHandler\0'),
    );
    const aMdia = mp4Box('mdia', aMdhd, aHdlr, aMinf);
    const aTkhd = mp4FullBox(
      'tkhd',
      0,
      3,
      u32(0),
      u32(0),
      u32(2),
      u32(0),
      u32(audioDurationInMovieTimescale),
      new Uint8Array(8),
      u16(0),
      u16(0),
      u16(0x0100),
      u16(0),
      identityMatrix,
      u32(0),
      u32(0),
    );
    const aTrak = mp4Box('trak', aTkhd, aMdia);

    const mvhd = mp4FullBox(
      'mvhd',
      0,
      0,
      u32(0),
      u32(0),
      u32(timescale),
      u32(movieDurationTicks),
      u32(0x00010000),
      u16(0x0100),
      new Uint8Array(10),
      identityMatrix,
      new Uint8Array(24),
      u32(3),
    );
    return mp4Box('moov', mvhd, vTrak, aTrak);
  };

  const videoPayload = concatBytes(...samples.map((s) => s.lengthPrefixedNals));
  const audioPayload = concatBytes(...audioSamples.map((s) => s.rawAacFrame));
  const mdatBody = concatBytes(videoPayload, audioPayload);
  const placeholderMoov = buildMoov(0, 0);
  const videoChunkOffset = ftyp.length + placeholderMoov.length + 8;
  const audioChunkOffset = videoChunkOffset + videoPayload.length;
  const moov = buildMoov(videoChunkOffset, audioChunkOffset);
  const mdat = mp4Box('mdat', mdatBody);
  return concatBytes(ftyp, moov, mdat);
}

export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
