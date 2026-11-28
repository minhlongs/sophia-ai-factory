import { describe, it, expect } from 'vitest';
import { buildSharedAudioDrivenTimeline } from '../audio-driven-timeline';
import { buildAacAudioSpecificConfig, muxAvc1AacMp4 } from '../pilot-mp4-muxer';
import { encodePilotSlidesToMp4, encodePilotSlidesWithAacToMp4, type PilotMp4SlideSpec } from '../pilot-mp4-encoder';

const SAMPLE_SLIDES: PilotMp4SlideSpec[] = [
  {
    label: 'Cảnh 1 / 3',
    headline: 'Bảo mật Crypto',
    body: 'Bước 1: Bật xác thực 2 lớp phần cứng ngay hôm nay.',
    footerCta: 'Tải checklist bảo mật miễn phí',
    referralShortUrl: 'https://sophia.example/r/demo',
    durationSec: 12,
    accentIndex: 0,
  },
  {
    label: 'Cảnh 2 / 3',
    headline: 'Quản lý rủi ro',
    body: 'Bước 2: Tách ví lạnh và không bao giờ chia sẻ seed phrase.',
    footerCta: 'Tải checklist bảo mật miễn phí',
    referralShortUrl: 'https://sophia.example/r/demo',
    durationSec: 12,
    accentIndex: 1,
  },
  {
    label: 'CTA',
    headline: 'Hành động ngay',
    body: 'Nhấn liên kết để nhận hướng dẫn chi tiết.',
    footerCta: 'Tải checklist bảo mật miễn phí',
    referralShortUrl: 'https://sophia.example/r/demo',
    durationSec: 8,
    accentIndex: 2,
  },
];

describe('Wave C.4.1 G7+G8: Shared audio-driven timeline & H.264+AAC MP4 muxer', () => {
  it('builds a shared audio-driven timeline without truncating speech and reports window status', () => {
    const timeline = buildSharedAudioDrivenTimeline({
      scenes: [
        { sceneId: 'scene-1', sceneNumber: 1, narration: 'Cảnh 1', measuredAudioDurationSec: 11.4 },
        { sceneId: 'scene-2', sceneNumber: 2, narration: 'Cảnh 2', measuredAudioDurationSec: 12.6 },
        { sceneId: 'scene-3', sceneNumber: 3, narration: 'Cảnh 3', measuredAudioDurationSec: 9.0 },
      ],
      ctaDurationSec: 3,
    });

    expect(timeline.scenes).toHaveLength(3);
    expect(timeline.scenes[0]?.startSec).toBe(0);
    expect(timeline.scenes[0]?.endSec).toBe(11.4);
    expect(timeline.scenes[1]?.startSec).toBe(11.4);
    expect(timeline.scenes[1]?.endSec).toBe(24);
    expect(timeline.ctaStartSec).toBe(33);
    expect(timeline.totalDurationSec).toBe(36);
    expect(timeline.withinTargetWindow).toBe(true);
    expect(timeline.advisory).toBeNull();
  });

  it('muxes H.264 video + AAC-LC audio into a valid ISO BMFF MP4 with vide + soun tracks', async () => {
    const aacFrames = Array.from({ length: 10 }, () => ({
      rawAacFrame: Uint8Array.from([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]),
      durationSamples: 1024,
    }));

    const artifact = await encodePilotSlidesWithAacToMp4({
      slides: SAMPLE_SLIDES,
      audioSampleRate: 44100,
      audioChannelCount: 1,
      audioSamples: aacFrames,
      width: 160,
      height: 160,
    });

    const ascii = new TextDecoder('latin1').decode(artifact.bytes);
    expect(ascii).toContain('ftyp');
    expect(ascii).toContain('moov');
    expect(ascii).toContain('avc1');
    expect(ascii).toContain('vide');
    expect(ascii).toContain('soun');
    expect(ascii).toContain('mp4a');
    expect(ascii).toContain('esds');
    expect(ascii).toContain('mdat');
    expect(artifact.codec).toBe('h264');
    expect(artifact.audioCodec).toBe('aac-lc');
    expect(artifact.sha256Hex).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects malformed audio and unsupported codec configurations explicitly without silent fallback', async () => {
    expect(() => buildAacAudioSpecificConfig(12345, 1)).toThrow(/Unsupported AAC sample rate/);
    expect(() => buildAacAudioSpecificConfig(44100, 6)).toThrow(/Unsupported AAC channel count/);

    await expect(
      encodePilotSlidesWithAacToMp4({
        slides: SAMPLE_SLIDES,
        audioSampleRate: 44100,
        audioChannelCount: 1,
        audioSamples: [],
      }),
    ).rejects.toThrow(/requires at least one audio sample/);

    expect(() =>
      muxAvc1AacMp4({
        width: 160,
        height: 160,
        timescale: 1000,
        spsNal: Uint8Array.from([0x67, 66, 0xc0, 31]),
        ppsNal: Uint8Array.from([0x68, 0xce, 0x38, 0x80]),
        samples: [{ lengthPrefixedNals: Uint8Array.from([0, 0, 0, 1, 0x65]), durationTicks: 1000, isKeyframe: true }],
        audioSampleRate: 44100,
        audioChannelCount: 1,
        audioSamples: [{ rawAacFrame: new Uint8Array(0), durationSamples: 1024 }],
      }),
    ).toThrow(/Malformed AAC audio sample/);
  });

  it('preserves existing silent MP4 export regression untouched', async () => {
    const silent = await encodePilotSlidesToMp4({
      slides: SAMPLE_SLIDES.slice(0, 1),
      width: 160,
      height: 160,
    });
    const ascii = new TextDecoder('latin1').decode(silent.bytes);
    expect(ascii).toContain('avc1');
    expect(ascii).not.toContain('mp4a');
    expect(silent.codec).toBe('h264');
  });
});
