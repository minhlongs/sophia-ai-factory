import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  buildCapCutPublishCopy,
  buildNarrationTextFromScript,
  buildSrtFromScript,
  extractThreeShortClipsFromLongScript,
} from '../pilot-capcut-pack-helpers';
import { AffiliatePilotStepper } from '../affiliate-studio/affiliate-pilot-stepper';
import { AffiliateCampaignGeneratorCard } from '../affiliate-studio/affiliate-campaign-generator-card';
import { PilotVoiceAndCapCutPack } from '../pilot-voice-and-capcut-pack';
import { renderAndDownloadPilotMp4 } from '../pilot-browser-mp4-renderer';
import { buildAffiliateCampaignUserPrompt } from '@/seed/ai/affiliate-campaign-prompt';
import { GenerateAffiliateCampaignActionSchema } from '@/land/first-value/pilot-affiliate-studio-schemas';

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

  it('handles product image selection, removal, voice error, and MP4 compositing with product images', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', mockFetch);
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-img-1');
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    const onProductImagesChange = vi.fn();
    const { container } = render(
      <PilotVoiceAndCapCutPack
        artifactId="cmp_02"
        script={SAMPLE_SCRIPT}
        ctaText="Bấm link"
        shortUrl="https://pilot.test/api/r/xyz"
        disclosureTag="#QuảngCáo"
        busy={false}
        productImageUrls={['blob:existing-1']}
        onProductImagesChange={onProductImagesChange}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['img'], 'prod.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [imgFile] } });
    expect(onProductImagesChange).toHaveBeenCalledWith(['blob:existing-1', 'blob:mock-img-1']);

    fireEvent.click(screen.getByLabelText('Remove image'));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:existing-1');

    fireEvent.click(screen.getByTestId('pilot-generate-voice-btn'));
    await waitFor(() => {
      expect(screen.getByText('pilotVoiceError')).toBeTruthy();
    });

    class MockImage {
      crossOrigin = '';
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal('Image', MockImage);

    const mp4 = await renderAndDownloadPilotMp4({
      artifactId: 'cmp_02',
      script: SAMPLE_SCRIPT,
      ctaText: 'Bấm link',
      shortUrl: 'https://pilot.test/api/r/xyz',
      disclosureTag: '#QuảngCáo',
      productImageUrls: ['blob:existing-1'],
    });
    expect(mp4.byteSize).toBeGreaterThan(0);

    const landscapeMp4 = await renderAndDownloadPilotMp4({
      artifactId: 'cmp_yt_16x9',
      script: SAMPLE_SCRIPT,
      ctaText: 'Bấm link',
      shortUrl: 'https://pilot.test/api/r/xyz',
      disclosureTag: '#QuảngCáo',
      aspectRatio: '16:9',
    });
    expect(landscapeMp4.width).toBe(576);
    expect(landscapeMp4.height).toBe(320);

    const longPrompt = buildAffiliateCampaignUserPrompt(
      {
        vertical: 'saas',
        productName: 'Notion AI',
        officialWebsiteUrl: 'https://notion.so',
        referralUrl: 'https://notion.so/?ref=pilot',
        commissionTerms: '20% recurring',
        targetAudience: 'Creators',
        targetMarket: 'US',
        productInfoSource: 'Official site',
      },
      300,
      'en',
    );
    expect(longPrompt).toContain('6 to 10 structured YouTube Review/Comparison chapters');
    const shortPrompt = buildAffiliateCampaignUserPrompt(
      {
        vertical: 'saas',
        productName: 'Notion AI',
        officialWebsiteUrl: 'https://notion.so',
        referralUrl: 'https://notion.so/?ref=pilot',
        commissionTerms: '20% recurring',
        targetAudience: 'Creators',
        targetMarket: 'VN',
        productInfoSource: 'Official site',
      },
      30,
      'vi',
    );
    expect(shortPrompt).toContain('3 to 5 scenes');
    expect(
      GenerateAffiliateCampaignActionSchema.parse({
        action: 'generate_affiliate_campaign',
        orgId: 'org_1',
        offerId: 'offer_1',
        durationSec: 480,
      }).durationSec,
    ).toBe(480);

    const longScript: ScriptOutput = {
      title: 'YouTube Review 5 Phút',
      total_duration: 300,
      scenes: [
        { scene_number: 1, title: 'Hook', narration: 'Mở đầu', visual_description: 'v1', duration_estimate: 10 },
        { scene_number: 2, title: 'Problem', narration: 'Vấn đề', visual_description: 'v2', duration_estimate: 12 },
        { scene_number: 3, title: 'Proof', narration: 'Bằng chứng', visual_description: 'v3', duration_estimate: 15 },
        { scene_number: 4, title: 'Demo', narration: 'Demo', visual_description: 'v4', duration_estimate: 15 },
        { scene_number: 5, title: 'Verdict', narration: 'Kết luận', visual_description: 'v5', duration_estimate: 12 },
        { scene_number: 6, title: 'CTA', narration: 'Bấm link', visual_description: 'v6', duration_estimate: 8 },
      ],
    };
    const clips = extractThreeShortClipsFromLongScript(longScript);
    expect(clips).toHaveLength(3);
    expect(clips[0].script.scenes).toHaveLength(2);

    render(
      <PilotVoiceAndCapCutPack
        artifactId="cmp_long_1"
        script={longScript}
        ctaText="Bấm link"
        shortUrl="https://pilot.test/api/r/xyz"
        disclosureTag="#QuảngCáo"
        busy={false}
        productImageUrls={[]}
        onProductImagesChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('pilot-repurpose-3-shorts')).toBeTruthy();
    fireEvent.click(screen.getByTestId('pilot-repurpose-srt-1'));
    fireEvent.click(screen.getByTestId('pilot-repurpose-mp4-1'));
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <AffiliateCampaignGeneratorCard
        selectedOffer={{
          id: 'off_1',
          orgId: 'org_1',
          userId: 'u_1',
          vertical: 'saas',
          productName: 'Notion AI',
          officialWebsiteUrl: 'https://notion.so',
          referralUrl: 'https://notion.so/?ref=pilot',
          commissionTerms: '20% recurring',
          targetAudience: 'Creators',
          targetMarket: 'US',
          productInfoSource: 'Official site',
          status: 'active',
          createdAtIso: '2026-11-25T00:00:00Z',
          updatedAtIso: '2026-11-25T00:00:00Z',
        }}
        campaigns={[]}
        activeCampaignId={null}
        modelId="openai/gpt-4o-mini"
        canGenerate
        busy={false}
        onSelectCampaign={vi.fn()}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.change(screen.getByTestId('pilot-video-format-select'), {
      target: { value: '300' },
    });
    fireEvent.click(screen.getByText('affGenerateCampaignBtn'));
    expect(onGenerate).toHaveBeenCalledWith(300, 'en');

    vi.unstubAllGlobals();
  });
});
