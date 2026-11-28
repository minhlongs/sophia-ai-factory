import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { NextRequest } from 'next/server';
import viMessages from '../../../../messages/vi.json';
import { FirstValueJourneyClient } from '@/components/first-value/first-value-journey-client';
import type { PreviewHandoffSnapshot } from '@/components/first-value/zero-key-preview-studio';
import { renderNarratedPilotMp4Blob } from '@/components/first-value/pilot-browser-mp4-renderer';
import { checkBrowserAacEncoderSupport, encodeAudioBytesToAacSamples } from '@/components/first-value/pilot-browser-audio-encoder';
import { buildSharedAudioDrivenTimeline } from '@/seed/video/audio-driven-timeline';
import { encodePilotSlidesWithAacToMp4 } from '@/seed/video/pilot-mp4-encoder';
import { muxAvc1AacMp4 } from '@/seed/video/pilot-mp4-muxer';
import { handleFirstValuePost, type FirstValueHttpDeps } from '../first-value-http-handler';

let capturedOnUpgrade: ((snapshot: PreviewHandoffSnapshot) => void) | undefined;

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

vi.mock('@/components/first-value/zero-key-preview-studio', () => ({
  ZeroKeyPreviewStudio: ({ onUpgradeToByok }: { onUpgradeToByok?: (s: PreviewHandoffSnapshot) => void }) => {
    capturedOnUpgrade = onUpgradeToByok;
    return <div data-testid="mock-zero-key-preview" />;
  },
}));

vi.mock('@/components/first-value/affiliate-studio/affiliate-campaign-studio', () => ({
  AffiliateCampaignStudio: () => <div data-testid="mock-affiliate-studio" />,
}));

describe('Wave C.4 branch coverage: live pilot handoff, cost_preview referenceScript, narrated MP4 renderer, audio encoder edge cases', () => {
  const originalFetch = globalThis.fetch;
  const origAudioEncoder = globalThis.AudioEncoder;
  const origAudioData = globalThis.AudioData;
  const origAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnUpgrade = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.AudioEncoder = origAudioEncoder;
    globalThis.AudioData = origAudioData;
    globalThis.AudioContext = origAudioContext;
  });

  it('renders live pilot handoff banner, triggers create_review with referenceScript, and cancels cleanly', async () => {
    const postBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>);
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          orgId: 'org-live',
          byokConfigured: true,
          configuredProviders: ['openrouter'],
          receipt: null,
          recentReviews: [],
          pilot: {
            liveInferenceEnabled: true,
            consentAccepted: true,
            policyVersion: '2026-11-pilot-v2',
            fundingMode: 'customer_byok',
            quota: { usedGenerations: 0, maxGenerations: 5, remainingGenerations: 5 },
          },
        }),
      });
    }) as unknown as typeof fetch;

    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <FirstValueJourneyClient orgId="org-live" initialPilotMode />
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(capturedOnUpgrade).toBeDefined());
    act(() => {
      capturedOnUpgrade?.({
        orgId: 'org-live',
        topic: 'Live Topic',
        audience: 'Live Audience',
        durationSec: 35,
        scriptText: 'Live reference script content',
        revision: 2,
        provenance: 'USER_EDITED_SCRIPT',
        contentLanguage: 'vi',
      });
    });

    const banner = await screen.findByTestId('preview-byok-handoff-banner');
    await waitFor(() => expect(banner.textContent).toContain('COMMERCIAL_PREFLIGHT_READY'));

    fireEvent.click(screen.getByTestId('live-pilot-create-review-from-handoff-btn'));
    await waitFor(() => expect(postBodies.some((b) => b.action === 'create_review')).toBe(true));
    const req = postBodies.find((b) => b.action === 'create_review');
    expect(req?.referenceScript).toBe('Live reference script content');

    fireEvent.click(screen.getByTestId('preview-handoff-cancel-btn'));
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();
  });

  it('handles cost_preview with referenceScript via handleFirstValuePost', async () => {
    const deps: FirstValueHttpDeps = {
      getD1: async () => null,
      getCurrentUser: async () => ({ id: 'u-1', email: 'u@example.test' }),
      verifyWorkspaceAccess: async () => true,
      verifyCsrf: () => true,
      listByokProviders: async () => ['openrouter'],
      signingSecret: 'secret-0123456789abcdef',
    };
    const req = new NextRequest('http://127.0.0.1:8788/api/first-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cost_preview',
        orgId: 'org-1',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        topic: 'Topic',
        audience: 'Audience',
        durationSec: 30,
        referenceScript: 'Extra reference script tokens',
      }),
    });
    const res = await handleFirstValuePost(req, deps);
    expect(res.status).toBe(200);
  });

  it('covers renderNarratedPilotMp4Blob, stereo mixdown, and unsupported AudioEncoder config branches', async () => {
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
          copyTo: (dest: Uint8Array) => dest.set([0x21, 0x10, 0x04, 0x60]),
        });
      });
      flush = vi.fn().mockResolvedValue(undefined);
      close = vi.fn();
    }
    class MockAudioData {
      close = vi.fn();
    }
    class MockAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 1024,
        duration: 4.0,
        getChannelData: () => new Float32Array(1024),
      });
      close = vi.fn().mockResolvedValue(undefined);
    }

    (globalThis as Record<string, unknown>).AudioEncoder = MockAudioEncoder;
    (globalThis as Record<string, unknown>).AudioData = MockAudioData;
    (globalThis as Record<string, unknown>).AudioContext = MockAudioContext;

    const { encoded, blob } = await renderNarratedPilotMp4Blob({
      artifactId: 'art-narrated-1',
      script: {
        title: 'Test Narrated',
        total_duration: 10,
        scenes: [
          { scene_number: 1, title: 'S1', visual_description: 'V1', narration: 'Xin chào', duration_estimate: 5 },
        ],
      },
      ctaText: 'Xem ngay',
      shortUrl: 'https://sophia.example/r/1',
      disclosureTag: '#QuảngCáo',
      audioBytes: new Uint8Array(64).buffer,
    });
    expect(encoded.audioCodec).toBe('aac-lc');
    expect(blob.type).toBe('video/mp4');

    // Unsupported config branch
    MockAudioEncoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: false });
    const unsupported = await checkBrowserAacEncoderSupport();
    expect(unsupported.supported).toBe(false);

    // isConfigSupported throws branch
    MockAudioEncoder.isConfigSupported = vi.fn().mockRejectedValue(new Error('boom'));
    const errored = await checkBrowserAacEncoderSupport();
    expect(errored.supported).toBe(false);

    // decodeAudioData throws branch
    MockAudioEncoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
    class FailingAudioContext {
      decodeAudioData = vi.fn().mockRejectedValue(new Error('corrupt'));
      close = vi.fn().mockResolvedValue(undefined);
    }
    (globalThis as Record<string, unknown>).AudioContext = FailingAudioContext;
    await expect(encodeAudioBytesToAacSamples(new Uint8Array(64).buffer)).rejects.toThrow(/Không thể giải mã/);
  });

  it('covers audio-driven-timeline advisories and muxer/encoder guard branches', async () => {
    expect(() => buildSharedAudioDrivenTimeline({ scenes: [] })).toThrow(/at least one scene/);
    expect(() =>
      buildSharedAudioDrivenTimeline({
        scenes: [{ sceneId: 's1', sceneNumber: 1, narration: 'x', measuredAudioDurationSec: 0 }],
      }),
    ).toThrow(/Invalid measured audio duration/);

    const shortTl = buildSharedAudioDrivenTimeline({
      scenes: [{ sceneId: 's1', sceneNumber: 1, narration: 'x', measuredAudioDurationSec: 5 }],
      ctaDurationSec: 2,
    });
    expect(shortTl.withinTargetWindow).toBe(false);
    expect(shortTl.advisory).toContain('shorter');

    const longTl = buildSharedAudioDrivenTimeline({
      scenes: [{ sceneId: 's1', sceneNumber: 1, narration: 'x', measuredAudioDurationSec: 50 }],
      ctaDurationSec: 2,
    });
    expect(longTl.withinTargetWindow).toBe(false);
    expect(longTl.advisory).toContain('exceeds');

    await expect(
      encodePilotSlidesWithAacToMp4({
        slides: [],
        audioSampleRate: 44100,
        audioChannelCount: 1,
        audioSamples: [{ rawAacFrame: Uint8Array.from([1]), durationSamples: 1024 }],
      }),
    ).rejects.toThrow(/At least one slide/);

    await expect(
      encodePilotSlidesWithAacToMp4({
        slides: [{ label: 'L', headline: 'H', body: 'B', footerCta: 'C', referralShortUrl: 'u', durationSec: 2, accentIndex: 0 }],
        width: 155,
        height: 160,
        audioSampleRate: 44100,
        audioChannelCount: 1,
        audioSamples: [{ rawAacFrame: Uint8Array.from([1]), durationSamples: 1024 }],
      }),
    ).rejects.toThrow(/multiples of 16/);

    expect(() =>
      muxAvc1AacMp4({
        width: 160,
        height: 160,
        timescale: 1000,
        spsNal: Uint8Array.from([0x67, 66, 0xc0, 31]),
        ppsNal: Uint8Array.from([0x68, 0xce, 0x38, 0x80]),
        samples: [],
        audioSampleRate: 44100,
        audioChannelCount: 1,
        audioSamples: [{ rawAacFrame: Uint8Array.from([1]), durationSamples: 1024 }],
      }),
    ).toThrow(/at least one video sample/);
  });
});
