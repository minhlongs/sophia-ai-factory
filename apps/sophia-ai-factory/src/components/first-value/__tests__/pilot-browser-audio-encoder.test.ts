import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkBrowserAacEncoderSupport,
  encodeAudioBytesToAacSamples,
} from '../pilot-browser-audio-encoder';

describe('Wave C.4.1 Lane B G1: Browser WebCodecs AAC-LC AudioEncoder', () => {
  const origAudioEncoder = globalThis.AudioEncoder;
  const origAudioData = globalThis.AudioData;
  const origAudioContext = globalThis.AudioContext;

  afterEach(() => {
    globalThis.AudioEncoder = origAudioEncoder;
    globalThis.AudioData = origAudioData;
    globalThis.AudioContext = origAudioContext;
    vi.restoreAllMocks();
  });

  it('detects unsupported browsers explicitly without silent fallback', async () => {
    (globalThis as Record<string, unknown>).AudioEncoder = undefined;
    const res = await checkBrowserAacEncoderSupport();
    expect(res.supported).toBe(false);
    expect(res.reason).toContain('WebCodecs AudioEncoder');

    await expect(encodeAudioBytesToAacSamples(new Uint8Array(64).buffer)).rejects.toThrow(
      /WebCodecs AudioEncoder/,
    );
  });

  it('rejects empty or malformed audio bytes explicitly', async () => {
    await expect(encodeAudioBytesToAacSamples(new ArrayBuffer(4))).rejects.toThrow(
      /rỗng hoặc không hợp lệ/,
    );
  });

  it('decodes PCM, encodes AAC-LC frames, and closes AudioEncoder/AudioData/AudioContext on success', async () => {
    const closeEncoder = vi.fn();
    const closeAudioData = vi.fn();
    const closeAudioCtx = vi.fn().mockResolvedValue(undefined);
    let outputCb: ((chunk: { byteLength: number; copyTo: (dest: Uint8Array) => void }) => void) | null = null;

    class MockAudioEncoder {
      state = 'configured';
      static isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
      constructor(init: { output: typeof outputCb }) {
        outputCb = init.output;
      }
      configure = vi.fn();
      encode = vi.fn(() => {
        outputCb?.({
          byteLength: 4,
          copyTo: (dest: Uint8Array) => {
            dest.set([0x21, 0x10, 0x04, 0x60]);
          },
        });
      });
      flush = vi.fn().mockResolvedValue(undefined);
      close = closeEncoder;
    }

    class MockAudioData {
      close = closeAudioData;
    }

    class MockAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 2048,
        duration: 2048 / 44100,
        getChannelData: () => new Float32Array(2048),
      });
      close = closeAudioCtx;
    }

    (globalThis as Record<string, unknown>).AudioEncoder = MockAudioEncoder;
    (globalThis as Record<string, unknown>).AudioData = MockAudioData;
    (globalThis as Record<string, unknown>).AudioContext = MockAudioContext;

    const encoded = await encodeAudioBytesToAacSamples(new Uint8Array(128).buffer);
    expect(encoded.sampleRate).toBe(44100);
    expect(encoded.channelCount).toBe(1);
    expect(encoded.samples).toHaveLength(2);
    expect(closeEncoder).toHaveBeenCalledTimes(1);
    expect(closeAudioData).toHaveBeenCalledTimes(2);
    expect(closeAudioCtx).toHaveBeenCalledTimes(1);
  });
});
