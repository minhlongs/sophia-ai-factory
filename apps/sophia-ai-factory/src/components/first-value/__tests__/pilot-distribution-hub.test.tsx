import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  buildAeoGeoJsonLd,
  buildMultiChannelDistributionPack,
  buildYouTubeChapters,
} from '../pilot-distribution-hub-helpers';
import { PilotDistributionHub } from '../pilot-distribution-hub';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const SAMPLE_SCRIPT: ScriptOutput = {
  title: 'Review Notion AI 2026',
  total_duration: 180,
  scenes: [
    { scene_number: 1, title: 'Hook', narration: 'Có đáng nâng cấp Notion AI không?', visual_description: 'v1', duration_estimate: 15 },
    { scene_number: 2, title: 'Demo', narration: 'Tự tóm tắt cuộc họp trong 5 giây.', visual_description: 'v2', duration_estimate: 90 },
    { scene_number: 3, title: 'Verdict', narration: 'Đáng tiền cho team nhỏ.', visual_description: 'v3', duration_estimate: 75 },
  ],
};

describe('PilotDistributionHub & helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds YouTube 00:00 chapters, 4 platform packs with shortlink, and 7-day cadence', () => {
    const chapters = buildYouTubeChapters(SAMPLE_SCRIPT);
    expect(chapters).toContain('00:00 Hook');
    expect(chapters).toContain('00:15 Demo');
    expect(chapters).toContain('01:45 Verdict');

    const pack = buildMultiChannelDistributionPack({
      script: SAMPLE_SCRIPT,
      ctaText: 'Dùng thử miễn phí',
      shortUrl: 'https://pilot.test/api/r/notion1',
      disclosureTag: '#QuảngCáo',
    });
    expect(pack.channels).toHaveLength(5);
    expect(pack.schedule).toHaveLength(4);
    for (const ch of pack.channels) {
      expect(ch.copyText).toContain('https://pilot.test/api/r/notion1');
    }

    const parsedJsonLd = JSON.parse(
      buildAeoGeoJsonLd({
        script: SAMPLE_SCRIPT,
        ctaText: 'Dùng thử miễn phí',
        shortUrl: 'https://pilot.test/api/r/notion1',
        disclosureTag: '#QuảngCáo',
      }),
    ) as { '@graph': Array<{ '@type': string }> };
    const types = parsedJsonLd['@graph'].map((node) => node['@type']);
    expect(types).toContain('VideoObject');
    expect(types).toContain('FAQPage');
  });

  it('switches channel tabs, copies pack to clipboard, and links to studio uploader', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <PilotDistributionHub
        script={SAMPLE_SCRIPT}
        ctaText="Dùng thử miễn phí"
        shortUrl="https://pilot.test/api/r/notion1"
        disclosureTag="#QuảngCáo"
      />,
    );

    expect(screen.getByTestId('pilot-distribution-hub')).toBeTruthy();
    expect(screen.getByTestId('pilot-dist-studio-link').getAttribute('href')).toBe(
      'https://studio.youtube.com/',
    );

    fireEvent.click(screen.getByTestId('pilot-dist-tab-tiktok'));
    expect(screen.getByTestId('pilot-dist-studio-link').getAttribute('href')).toBe(
      'https://www.tiktok.com/tiktokstudio/upload',
    );

    fireEvent.click(screen.getByTestId('pilot-dist-tab-aeo_geo'));
    expect(screen.getByTestId('pilot-dist-studio-link').getAttribute('href')).toBe(
      'https://medium.com/new-story',
    );

    fireEvent.click(screen.getByTestId('pilot-dist-copy-btn'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('https://pilot.test/api/r/notion1'),
      );
    });
  });
});
