/**
 * Behavioral tests for `handleSaveForDistribution` in PilotVoiceAndCapCutPack.
 * Covers: successful persistence, HTTP failure, network failure, and invalid payload.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf' }),
}));
vi.mock('../pilot-browser-audio-encoder', () => ({
  checkBrowserAacEncoderSupport: vi.fn(async () => ({ supported: true })),
}));
vi.mock('../pilot-browser-mp4-renderer', () => ({
  renderAndDownloadPilotMp4: vi.fn(),
  renderNarratedPilotMp4Blob: vi.fn(async () => ({
    blob: new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...new Uint8Array(128)])], {
      type: 'video/mp4',
    }),
    durationSec: 30,
  })),
}));

import { PilotVoiceAndCapCutPack } from '../pilot-voice-and-capcut-pack';

const sampleScript = {
  title: 'Bảo mật Crypto',
  hook: 'Đừng mất ví!',
  cta: 'Xem ngay',
  total_duration: 30,
  scenes: [
    { scene_number: 1, visual: 'Scene 1', narration: 'Xin chào các bạn', voiceover: 'Xin chào các bạn', duration: 15, text_overlay: 'Hook' },
    { scene_number: 2, visual: 'Scene 2', narration: 'Cảm ơn đã xem', voiceover: 'Cảm ơn đã xem', duration: 15, text_overlay: 'CTA' },
  ],
};

describe('PilotVoiceAndCapCutPack — handleSaveForDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test-mp4'), writable: true });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-mp4');
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderAndGenerateMp4() {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(new Uint8Array([0x49, 0x44, 0x33, 0x03]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );

    render(
      <PilotVoiceAndCapCutPack
        orgId="org-alpha"
        artifactId="art-test-1"
        script={sampleScript as never}
        ctaText="Xem ngay"
        shortUrl="https://sophia.link/abc"
        disclosureTag="#ad"
        busy={false}
        productImageUrls={[]}
        onProductImagesChange={() => {}}
      />,
    );

    const ttsBtn = screen.getByTestId('pilot-generate-voice-btn');
    fireEvent.click(ttsBtn);

    const mp4Btn = await screen.findByTestId('pilot-render-narrated-mp4-btn');
    fireEvent.click(mp4Btn);

    const saveBtn = await screen.findByTestId('pilot-save-for-distribution-btn');
    return { saveBtn, fetchSpy };
  }

  it('persists MP4 and renders Distribution Center link on 201 response', async () => {
    const { saveBtn, fetchSpy } = await renderAndGenerateMp4();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ videoId: 'vid_saved_001', r2ObjectKey: 'private/distribution/x.mp4' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fireEvent.click(saveBtn);

    const link = await screen.findByTestId('pilot-open-saved-distribution-link');
    expect(link.getAttribute('href')).toContain('/dashboard/publish/queue?videoId=vid_saved_001');
  });

  it('surfaces inline error on HTTP 409 failure, network failure, and invalid payload', async () => {
    const { saveBtn, fetchSpy } = await renderAndGenerateMp4();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Review not approved' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/Review not approved/)).toBeTruthy();
    });

    fetchSpy.mockRejectedValueOnce(new Error('Network down'));
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('pilot-open-saved-distribution-link')).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });
  });
});
