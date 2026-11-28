'use client';

/**
 * Browser WebCodecs AAC-LC Audio Encoder (Wave C.4.1 Lane B G1).
 *
 * Decodes MP3/audio bytes via Web Audio API (`AudioContext.decodeAudioData`) into
 * PCM Float32 samples and encodes AAC-LC frames via WebCodecs `AudioEncoder` for
 * muxing with H.264 video in `muxAvc1AacMp4`.
 *
 * Explicitly checks `AudioEncoder` + `isConfigSupported` before running.
 * Always closes owned `AudioEncoder` / `AudioContext` / `AudioData` resources
 * on success or failure. Never silently substitutes silent output on failure.
 *
 * @module components/first-value/pilot-browser-audio-encoder
 */

import type { AacAudioSampleEntry } from '@/seed/video/pilot-mp4-muxer';

export interface EncodedBrowserAacResult {
  readonly sampleRate: number;
  readonly channelCount: number;
  readonly durationSec: number;
  readonly samples: readonly AacAudioSampleEntry[];
}

export interface BrowserAudioEncoderSupport {
  readonly supported: boolean;
  readonly reason: string | null;
}

const DEFAULT_AAC_SAMPLE_RATE = 44_100;
const DEFAULT_AAC_BITRATE = 96_000;
const CHUNK_FRAMES = 1024;

export async function checkBrowserAacEncoderSupport(
  sampleRate = DEFAULT_AAC_SAMPLE_RATE,
  channelCount = 1,
): Promise<BrowserAudioEncoderSupport> {
  if (typeof globalThis.AudioEncoder === 'undefined' || typeof globalThis.AudioData === 'undefined') {
    return {
      supported: false,
      reason: 'Trình duyệt này không hỗ trợ WebCodecs AudioEncoder để mã hóa AAC-LC.',
    };
  }
  if (typeof globalThis.AudioContext === 'undefined' && typeof (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext === 'undefined') {
    return {
      supported: false,
      reason: 'Trình duyệt này không hỗ trợ Web Audio API để giải mã âm thanh.',
    };
  }
  try {
    const check = await globalThis.AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels: channelCount,
      bitrate: DEFAULT_AAC_BITRATE,
    });
    if (!check.supported) {
      return {
        supported: false,
        reason: 'Trình duyệt không hỗ trợ cấu hình mã hóa AAC-LC (mp4a.40.2).',
      };
    }
    return { supported: true, reason: null };
  } catch {
    return {
      supported: false,
      reason: 'Không thể kiểm tra khả năng mã hóa AAC-LC trên trình duyệt này.',
    };
  }
}

function mixDownToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  if (audioBuffer.numberOfChannels <= 1) {
    return new Float32Array(audioBuffer.getChannelData(0));
  }
  const mono = new Float32Array(length);
  const channels = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / channels;
    }
  }
  return mono;
}

/**
 * Decodes compressed audio bytes (e.g. MP3) and encodes AAC-LC samples via WebCodecs.
 * Throws an explicit Error on unsupported browsers, malformed audio, or encoder failure.
 */
export async function encodeAudioBytesToAacSamples(
  audioBytes: ArrayBuffer,
): Promise<EncodedBrowserAacResult> {
  if (!audioBytes || audioBytes.byteLength < 16) {
    throw new Error('Dữ liệu âm thanh rỗng hoặc không hợp lệ.');
  }

  const support = await checkBrowserAacEncoderSupport();
  if (!support.supported) {
    throw new Error(support.reason ?? 'WebCodecs AudioEncoder không được hỗ trợ.');
  }

  const AudioCtx =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: DEFAULT_AAC_SAMPLE_RATE });
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(audioBytes.slice(0));
  } catch {
    throw new Error('Không thể giải mã file âm thanh (định dạng không hợp lệ hoặc bị hỏng).');
  } finally {
    await audioCtx.close().catch(() => {});
  }

  if (!decoded || decoded.length === 0 || !Number.isFinite(decoded.duration) || decoded.duration <= 0) {
    throw new Error('Âm thanh giải mã có thời lượng không hợp lệ.');
  }

  const sampleRate = decoded.sampleRate;
  const channelCount = 1;
  const monoPcm = mixDownToMono(decoded);
  const configSupport = await checkBrowserAacEncoderSupport(sampleRate, channelCount);
  if (!configSupport.supported) {
    throw new Error(configSupport.reason ?? `Không hỗ trợ tần số mẫu AAC ${sampleRate}Hz.`);
  }

  const samples: AacAudioSampleEntry[] = [];
  let encoderError: Error | null = null;
  const encoder = new globalThis.AudioEncoder({
    output: (chunk) => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      if (buf.byteLength > 0) {
        samples.push({
          rawAacFrame: buf,
          durationSamples: CHUNK_FRAMES,
        });
      }
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
    },
  });

  try {
    encoder.configure({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels: channelCount,
      bitrate: DEFAULT_AAC_BITRATE,
    });

    for (let offset = 0; offset < monoPcm.length; offset += CHUNK_FRAMES) {
      if (encoderError) {
        throw encoderError;
      }
      const end = Math.min(offset + CHUNK_FRAMES, monoPcm.length);
      const frameSlice = monoPcm.subarray(offset, end);
      const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
      const audioData = new globalThis.AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: frameSlice.length,
        numberOfChannels: channelCount,
        timestamp: timestampUs,
        data: frameSlice as BufferSource,
      });
      try {
        encoder.encode(audioData);
      } finally {
        audioData.close();
      }
    }

    await encoder.flush();
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }

  if (encoderError) {
    throw encoderError;
  }
  if (samples.length === 0) {
    throw new Error('Bộ mã hóa AAC không tạo ra khung âm thanh nào.');
  }

  return {
    sampleRate,
    channelCount,
    durationSec: Number(decoded.duration.toFixed(3)),
    samples,
  };
}
