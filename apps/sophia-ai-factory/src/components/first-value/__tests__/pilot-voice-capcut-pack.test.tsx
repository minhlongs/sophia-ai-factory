import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  buildCapCutPublishCopy,
  buildNarrationTextFromScript,
  buildSrtFromScript,
} from '../pilot-capcut-pack-helpers';
import { AffiliatePilotStepper } from '../affiliate-studio/affiliate-pilot-stepper';
import { PilotVoiceAndCapCutPack } from '../pilot-voice-and-capcut-pack';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const SAMPLE_SCRIPT: ScriptOutput = {
  title: 'Review Nồi Chiên Không Dầu 2026',
  total_duration: 16,
  scenes: [
    {
      scene_number: 1,
      title: 'Hook',
      narration: 'Đừng mua nồi chiên trước khi xem hết 15 giây này.',
      visual_description: 'Close-up air fryer',
      duration_estimate: 6,
    },
    {
      scene_number: 2,
      title: 'Proof',
      narration: 'Chiên giòn rụm không cần dầu, tiết kiệm 20 phút mỗi ngày.',
      visual_description: 'Crispy food shot',
      duration_estimate: 10,
    },
  ],
};

describe('Pilot CapCut Pack helpers & UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds narration text, valid SRT subtitles, and CapCut publish copy with shortlink', () => {
    const narration = buildNarrationTextFromScript(SAMPLE_SCRIPT, 'Bấm link nhận mã giảm 40%');
    expect(narration).toContain('Đừng mua nồi chiên');
    expect(narration).toContain('Bấm link nhận mã giảm 40%');

    const srt = buildSrtFromScript(SAMPLE_SCRIPT, 'Bấm link nhận mã giảm 40%');
    expect(srt).toContain('00:00:00,000 --> 00:00:06,000');
    expect(srt).toContain('00:00:06,000 --> 00:00:16,000');
    expect(srt).toContain('00:00:16,000 --> 00:00:20,000');

    const copy = buildCapCutPublishCopy({
      script: SAMPLE_SCRIPT,
      ctaText: 'Bấm link nhận mã giảm 40%',
      shortUrl: 'https://pilot.test/api/r/abc123',
      disclosureTag: '#QuảngCáo',
    });
    expect(copy).toContain('[CAPTION]');
    expect(copy).toContain('[PINNED COMMENT / LINK]');
    expect(copy).toContain('https://pilot.test/api/r/abc123');
    expect(copy).toContain('#QuảngCáo');
  });

  it('renders 4-step AffiliatePilotStepper with links to all workflow sections', () => {
    render(
      <AffiliatePilotStepper
        hasOffer
        hasApprovedCampaign
        hasMp4OrLink={false}
        hasManualPublish={false}
      />,
    );
    const nav = screen.getByTestId('pilot-workflow-stepper');
    expect(nav).toBeTruthy();
    expect(screen.getByText('pilotStep1Offer').closest('a')?.getAttribute('href')).toBe(
      '#affiliate-offers',
    );
    expect(screen.getByText('pilotStep3VideoPack').closest('a')?.getAttribute('href')).toBe(
      '#pilot-mp4-affiliate',
    );
  });

  it('generates free Edge TTS voice, downloads SRT, and copies CapCut pack', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mp3-data'], { type: 'audio/mpeg' })),
    });
    vi.stubGlobal('fetch', mockFetch);
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-audio');
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const onProductImagesChange = vi.fn();
    render(
      <PilotVoiceAndCapCutPack
        artifactId="cmp_01"
        script={SAMPLE_SCRIPT}
        ctaText="Bấm link nhận mã"
        shortUrl="https://pilot.test/api/r/xyz"
        disclosureTag="#QuảngCáo"
        busy={false}
        productImageUrls={[]}
        onProductImagesChange={onProductImagesChange}
      />,
    );

    fireEvent.click(screen.getByTestId('pilot-generate-voice-btn'));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/first-value/voice',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    fireEvent.click(screen.getByTestId('pilot-download-srt-btn'));
    expect(mockCreateObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('pilot-copy-capcut-pack-btn'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://pilot.test/api/r/xyz'));
    });

    vi.unstubAllGlobals();
  });
});
