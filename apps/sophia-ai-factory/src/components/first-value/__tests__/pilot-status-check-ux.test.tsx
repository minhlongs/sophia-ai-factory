// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../messages/en.json';
import viMessages from '../../../../messages/vi.json';
import { FirstValueMp4AffiliateCard } from '../first-value-mp4-affiliate-card';
import type { PilotMp4ExportSummary } from '@/seed/pilot/pilot-access-policy';

const PROCESSING_EXPORT: PilotMp4ExportSummary = {
  id: 'pme_ux_1',
  artifactId: 'art_ux_1',
  renderMode: 'heygen_byok_mp4',
  heygenJobId: 'hg_job_ux_1',
  status: 'processing',
  sha256Hex: null,
  byteSize: null,
  durationSec: null,
  width: 720,
  height: 1280,
  codec: 'h264',
  containerBrand: 'isom',
  ctaText: 'Start now',
  shortCode: 'code123',
  referralUrl: 'https://sophia.example.com/api/r/code123',
  providerVideoUrl: null,
  errorCode: null,
  createdAtIso: '2026-11-25T10:00:00.000Z',
  updatedAtIso: '2026-11-25T10:00:00.000Z',
};

function renderCard(locale: 'vi' | 'en', onPollHeyGenMp4: (id: string) => Promise<PilotMp4ExportSummary | null>) {
  const messages = locale === 'vi' ? viMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <FirstValueMp4AffiliateCard
        review={null}
        busy={false}
        consentAccepted={true}
        heygenConfigured={true}
        affiliateLinks={[]}
        mp4Exports={[PROCESSING_EXPORT]}
        onCreateShortlink={vi.fn(async () => null)}
        onRecordBrowserMp4={vi.fn(async () => true)}
        onSaveHeyGenKey={vi.fn(async () => true)}
        onClearHeyGenKey={vi.fn(async () => true)}
        onSubmitHeyGenMp4={vi.fn(async () => true)}
        onPollHeyGenMp4={onPollHeyGenMp4}
      />
    </NextIntlClientProvider>,
  );
}

describe('HeyGen Status Check UX & Accessibility', () => {
  it('shows immediate loading state, prevents rapid duplicate clicks, and announces timestamp via aria-live in Vietnamese', async () => {
    let resolvePoll!: (val: PilotMp4ExportSummary | null) => void;
    const onPoll = vi.fn(
      () =>
        new Promise<PilotMp4ExportSummary | null>((resolve) => {
          resolvePoll = resolve;
        }),
    );

    renderCard('vi', onPoll);
    const btn = screen.getByRole('button', { name: 'Kiểm tra tiến độ' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onPoll).toHaveBeenCalledTimes(1);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.textContent).toBe('Đang kiểm tra...');

    resolvePoll({ ...PROCESSING_EXPORT, status: 'processing' });

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('HeyGen vẫn đang render');
    });
  });

  it('announces graceful error on timeout/null poll response in English', async () => {
    const onPoll = vi.fn(async () => null);
    renderCard('en', onPoll);
    const btn = screen.getByRole('button', { name: 'Check Status' });
    fireEvent.click(btn);

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('Unable to check HeyGen status right now');
    });
  });

  it('announces graceful error on rejected/rate-limit poll promise in Vietnamese', async () => {
    const onPoll = vi.fn(async () => {
      throw new Error('HEYGEN_RATE_LIMITED');
    });
    renderCard('vi', onPoll);
    const btn = screen.getByRole('button', { name: 'Kiểm tra tiến độ' });
    fireEvent.click(btn);

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('Không thể kiểm tra tiến độ HeyGen lúc này');
    });
  });
});
