import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';
import type {
  PilotAffiliateLinkSummary,
  PilotManualPublishSummary,
  PilotMp4ExportSummary,
} from '@/seed/pilot/pilot-access-policy';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

import { FirstValueMp4AffiliateCard } from '../first-value-mp4-affiliate-card';
import { FirstValueManualPublishCard } from '../first-value-manual-publish-card';
import {
  buildSlidesFromAcceptedScript,
  renderAndDownloadPilotMp4,
} from '../pilot-browser-mp4-renderer';
import { FirstValueJourneyClient } from '../first-value-journey-client';

function makeAcceptedReview(): DurableFirstValueReview {
  return {
    artifactId: 'art_ui_1',
    orgId: 'org_1',
    userId: 'u_1',
    missionId: 'mission_org_1_pilot',
    idempotencyKey: 'idem_ui_1',
    payloadHash: 'a'.repeat(64),
    reviewState: 'accepted',
    version: 2,
    provenance: 'live_provider',
    provenanceLabel: 'LIVE_PROVIDER_AI_INFERENCE',
    topic: 'Clinic booking',
    audience: 'Clinic owners',
    durationSec: 30,
    publicPublished: false,
    mcuCharged: 0,
    mcuAccountingRef: 'pilot:customer_byok',
    privateArtifactRef: 'private://org_1/first-value/art_ui_1',
    receiptId: 'pilot:customer_byok',
    script: {
      title: 'Clinic 60s Reminder',
      total_duration: 18,
      scenes: [
        {
          scene_number: 1,
          title: 'Hook',
          visual_description: 'Busy clinic desk',
          narration: 'Missed appointments cost clinics 40% repeat visits.',
          duration_estimate: 6,
        },
        {
          scene_number: 2,
          title: 'Workflow',
          visual_description: 'Automated SMS alert',
          narration: 'Send a 60-second smart follow-up automatically.',
          duration_estimate: 6,
        },
        {
          scene_number: 3,
          title: 'Action',
          visual_description: 'Booking confirmed',
          narration: 'Tap the link below to start free today.',
          duration_estimate: 6,
        },
      ],
    },
    acceptedAtIso: '2026-11-25T00:00:00Z',
    acceptedByUserId: 'u_1',
    rejectedAtIso: null,
    rejectionReason: null,
    createdAtIso: '2026-11-25T00:00:00Z',
    updatedAtIso: '2026-11-25T00:00:00Z',
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Pilot Commercial UI Cards & Browser MP4 Renderer', () => {
  it('builds slides with CTA end-card and encodes downloadable H.264 MP4 in JSDOM', async () => {
    const review = makeAcceptedReview();
    const slides = buildSlidesFromAcceptedScript({
      script: review.script,
      ctaText: 'Claim 30% Clinic Toolkit Discount',
      shortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
      disclosureTag: '#QuảngCáo',
    });
    expect(slides).toHaveLength(4);
    expect(slides[3]?.label).toContain('CALL TO ACTION');

    const createObjSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:https://pilot.local/mp4-1');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Exercise real 2D canvas drawing & text-wrapping branch
    const fakeRgba = new Uint8ClampedArray(320 * 576 * 4);
    const getCtxSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(
        () =>
          ({
            fillStyle: '',
            font: '',
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: (txt: string) => ({ width: txt.length * 8 }),
            getImageData: () => ({ data: fakeRgba }),
          }) as unknown as CanvasRenderingContext2D,
      );

    vi.useFakeTimers();
    try {
      const encoded = await renderAndDownloadPilotMp4({
        artifactId: review.artifactId,
        script: review.script,
        ctaText: 'Claim 30% Clinic Toolkit Discount right now via our verified pilot referral link',
        shortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
        disclosureTag: '#QuảngCáo',
      });
      getCtxSpy.mockRestore();

      expect(encoded.codec).toBe('h264');
      expect(encoded.containerBrand).toBe('isom');
      expect(encoded.byteSize).toBeGreaterThan(10_000);
      expect(createObjSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(10_000);
      expect(revokeSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates affiliate shortlink, exports 1-Key browser MP4, and manages optional HeyGen BYOK', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://pilot.local/mp4-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const onCreateShortlink = vi.fn(async () => null);
    const onRecordBrowserMp4 = vi.fn(async () => true);
    const onSaveHeyGenKey = vi.fn(async () => true);
    const onClearHeyGenKey = vi.fn(async () => true);
    const onSubmitHeyGenMp4 = vi.fn(async () => true);
    const onPollHeyGenMp4 = vi.fn(async () => {});

    const link: PilotAffiliateLinkSummary = {
      id: 'pal_1',
      artifactId: 'art_ui_1',
      shortCode: 'abcdefghij',
      shortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
      destinationUrl: 'https://shopee.vn/item/1',
      ctaText: 'Nhận ưu đãi 30%',
      networkHint: 'shopee',
      subId: 'sp_abcdefghij',
      disclosureTag: '#QuảngCáo',
      verifiedClicks: 3,
      createdAtIso: '2026-11-25T00:00:00Z',
    };

    const mp4Row: PilotMp4ExportSummary = {
      id: 'pme_1',
      artifactId: 'art_ui_1',
      renderMode: 'heygen_byok_mp4',
      heygenJobId: 'hg_1',
      status: 'processing',
      sha256Hex: null,
      byteSize: null,
      durationSec: null,
      width: 720,
      height: 1280,
      codec: 'h264',
      containerBrand: 'isom',
      ctaText: 'Nhận ưu đãi 30%',
      shortCode: 'abcdefghij',
      referralUrl: link.shortUrl,
      providerVideoUrl: null,
      errorCode: null,
      createdAtIso: '2026-11-25T00:00:00Z',
      updatedAtIso: '2026-11-25T00:00:00Z',
    };

    const { rerender } = render(
      <FirstValueMp4AffiliateCard
        review={makeAcceptedReview()}
        busy={false}
        heygenConfigured={false}
        affiliateLinks={[link]}
        mp4Exports={[mp4Row]}
        onCreateShortlink={onCreateShortlink}
        onRecordBrowserMp4={onRecordBrowserMp4}
        onSaveHeyGenKey={onSaveHeyGenKey}
        onClearHeyGenKey={onClearHeyGenKey}
        onSubmitHeyGenMp4={onSubmitHeyGenMp4}
        onPollHeyGenMp4={onPollHeyGenMp4}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://shopee.vn/item/999' },
    });
    fireEvent.change(screen.getByPlaceholderText('pilotCtaPlaceholder'), {
      target: { value: 'Mua ngay hôm nay' },
    });
    fireEvent.click(screen.getByText('pilotCreateShortlinkBtn'));
    await waitFor(() => expect(onCreateShortlink).toHaveBeenCalledTimes(1));

    // Trigger 1-Key Browser MP4 export
    fireEvent.click(screen.getByTestId('pilot-export-browser-mp4-btn'));
    await waitFor(() => expect(onRecordBrowserMp4).toHaveBeenCalledTimes(1));

    // Save optional HeyGen BYOK key & poll status
    fireEvent.change(screen.getByPlaceholderText('pilotHeyGenKeyPlaceholder'), {
      target: { value: 'heygen_api_key_1234567890' },
    });
    fireEvent.click(screen.getByText('pilotSaveHeyGenBtn'));
    await waitFor(() => expect(onSaveHeyGenKey).toHaveBeenCalledWith('heygen_api_key_1234567890'));

    fireEvent.click(screen.getByText('pilotPollHeyGenBtn'));
    expect(onPollHeyGenMp4).toHaveBeenCalledWith('pme_1');

    rerender(
      <FirstValueMp4AffiliateCard
        review={makeAcceptedReview()}
        busy={false}
        heygenConfigured={true}
        affiliateLinks={[link]}
        mp4Exports={[
          {
            ...mp4Row,
            status: 'completed',
            providerVideoUrl: 'https://files2.heygen.ai/out.mp4',
            durationSec: 18,
          },
        ]}
        onCreateShortlink={onCreateShortlink}
        onRecordBrowserMp4={onRecordBrowserMp4}
        onSaveHeyGenKey={onSaveHeyGenKey}
        onClearHeyGenKey={onClearHeyGenKey}
        onSubmitHeyGenMp4={onSubmitHeyGenMp4}
        onPollHeyGenMp4={onPollHeyGenMp4}
      />,
    );

    fireEvent.click(screen.getByText('pilotSubmitHeyGenMp4Btn'));
    expect(onSubmitHeyGenMp4).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('pilotByokClearBtn (HeyGen)'));
    expect(onClearHeyGenKey).toHaveBeenCalledTimes(1);
  });

  it('renders manual publish copy pack and submits honest CUSTOMER_SELF_REPORTED outcomes', async () => {
    const onRecordManualPublish = vi.fn(async () => true);
    const link: PilotAffiliateLinkSummary = {
      id: 'pal_1',
      artifactId: 'art_ui_1',
      shortCode: 'abcdefghij',
      shortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
      destinationUrl: 'https://shopee.vn/item/1',
      ctaText: 'Nhận ưu đãi 30%',
      networkHint: 'shopee',
      subId: 'sp_abcdefghij',
      disclosureTag: '#QuảngCáo',
      verifiedClicks: 7,
      createdAtIso: '2026-11-25T00:00:00Z',
    };
    const existingPost: PilotManualPublishSummary = {
      id: 'pmp_1',
      artifactId: 'art_ui_1',
      mp4ExportId: null,
      linkId: 'pal_1',
      platform: 'tiktok',
      publishedPostUrl: 'https://www.tiktok.com/@ceo/video/111',
      reportedViews: 950,
      reportedConversions: 1,
      reportedCommissionAmount: 150000,
      reportedCommissionCurrency: 'VND',
      evidenceNote: 'Shopee dashboard',
      provenance: 'CUSTOMER_SELF_REPORTED',
      createdAtIso: '2026-11-25T00:00:00Z',
    };

    render(
      <FirstValueManualPublishCard
        review={makeAcceptedReview()}
        busy={false}
        affiliateLinks={[link]}
        mp4Exports={[]}
        manualPublishes={[existingPost]}
        onRecordManualPublish={onRecordManualPublish}
      />,
    );

    expect(screen.getByText('SERVER_VERIFIED_CLICK: 7')).toBeTruthy();
    expect(screen.getByText(/#QuảngCáo #SophiaAIFactory/)).toBeTruthy();

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
    });
    fireEvent.click(screen.getByText('pilotCopyCaptionPackBtn'));

    const blankInputs = screen.getAllByPlaceholderText('pilotLeaveBlankIfNone');
    fireEvent.change(blankInputs[0]!, { target: { value: '2' } });
    fireEvent.change(blankInputs[1]!, { target: { value: '250000' } });
    fireEvent.change(screen.getByPlaceholderText('pilotEvidenceNotePlaceholder'), {
      target: { value: 'Shopee verified order' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://www.tiktok.com/@.../video/...'), {
      target: { value: 'https://www.tiktok.com/@ceo/video/222222' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '1500' },
    });
    fireEvent.click(screen.getByText('pilotSaveManualPublishBtn'));

    await waitFor(() =>
      expect(onRecordManualPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@ceo/video/222222',
          reportedViews: 1500,
          reportedConversions: 2,
          reportedCommissionAmount: 250000,
          reportedCommissionCurrency: 'VND',
          evidenceNote: 'Shopee verified order',
        }),
      ),
    );
  });

  it('wires commercial cards inside FirstValueJourneyClient in live pilot mode', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://pilot.local/mp4-client');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let heygenEnabled = false;
    const activeLinks: PilotAffiliateLinkSummary[] = [
      {
        id: 'pal_init',
        artifactId: 'art_ui_1',
        shortCode: 'abcdefghij',
        shortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
        destinationUrl: 'https://shopee.vn/item/2',
        ctaText: 'Claim now',
        networkHint: 'generic',
        subId: 'sp_abcdefghij',
        disclosureTag: '#QuảngCáo',
        verifiedClicks: 1,
        createdAtIso: '2026-11-25T00:00:00Z',
      },
    ];
    const activeExports: PilotMp4ExportSummary[] = [
      {
        id: 'pme_proc',
        artifactId: 'art_ui_1',
        renderMode: 'heygen_byok_mp4',
        heygenJobId: 'hg_proc',
        status: 'processing',
        sha256Hex: null,
        byteSize: null,
        durationSec: null,
        width: 720,
        height: 1280,
        codec: 'h264',
        containerBrand: 'isom',
        ctaText: 'Claim now',
        shortCode: 'abcdefghij',
        referralUrl: activeLinks[0]!.shortUrl,
        providerVideoUrl: null,
        errorCode: null,
        createdAtIso: '2026-11-25T00:00:00Z',
        updatedAtIso: '2026-11-25T00:00:00Z',
      },
    ];

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return new Response(
          JSON.stringify({
            byokConfigured: true,
            configuredProviders: heygenEnabled ? ['openrouter', 'heygen'] : ['openrouter'],
            receipt: null,
            recentReviews: [makeAcceptedReview()],
            pilot: {
              inviteOnly: true,
              liveInferenceEnabled: true,
              policyVersion: '2026-11-pilot-v2',
              consentAccepted: true,
              consentAcceptedAtIso: '2026-11-25T00:00:00Z',
              financingMode: 'CUSTOMER_BYOK',
              fundingMode: 'customer_byok',
              byokKeyConfigured: true,
              heygenByokConfigured: heygenEnabled,
              affiliateLinks: activeLinks,
              mp4Exports: activeExports,
              manualPublishes: [],
              supportRequests: [],
              quota: {
                usedGenerations: 1,
                maxGenerations: 20,
                remainingGenerations: 19,
                lastGenerationAtIso: null,
              },
            },
          }),
          { status: 200 },
        );
      }
      const reqBody = JSON.parse(String(init.body ?? '{}')) as { action?: string };
      if (reqBody.action === 'save_byok_key') {
        heygenEnabled = true;
        return new Response(JSON.stringify({ heygenByokConfigured: true }), { status: 200 });
      }
      if (reqBody.action === 'clear_byok_key') {
        heygenEnabled = false;
        return new Response(JSON.stringify({ heygenByokConfigured: false }), { status: 200 });
      }
      if (reqBody.action === 'record_mp4_export' || reqBody.action === 'submit_heygen_mp4' || reqBody.action === 'poll_heygen_mp4') {
        return new Response(JSON.stringify({ mp4Export: activeExports[0] }), { status: 200 });
      }
      if (reqBody.action === 'record_manual_publish') {
        return new Response(JSON.stringify({ manualPublish: { id: 'pmp_ok' } }), { status: 201 });
      }
      return new Response(
        JSON.stringify({ affiliateLink: activeLinks[0] }),
        { status: 201 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FirstValueJourneyClient orgId="org_1" initialPilotMode={true} />);
    await waitFor(() => expect(screen.getByText('pilotMp4Title')).toBeTruthy());

    // Create shortlink
    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://shopee.vn/item/2' },
    });
    fireEvent.change(screen.getByPlaceholderText('pilotCtaPlaceholder'), {
      target: { value: 'Claim now' },
    });
    fireEvent.click(screen.getByText('pilotCreateShortlinkBtn'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Browser MP4 export
    fireEvent.click(screen.getByTestId('pilot-export-browser-mp4-btn'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, i]) => String(i?.body ?? '').includes('record_mp4_export')),
      ).toBe(true),
    );

    // Poll HeyGen status
    fireEvent.click(screen.getByText('pilotPollHeyGenBtn'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, i]) => String(i?.body ?? '').includes('poll_heygen_mp4')),
      ).toBe(true),
    );

    // Save HeyGen BYOK -> Submit HeyGen MP4 -> Clear HeyGen BYOK
    fireEvent.change(screen.getByPlaceholderText('pilotHeyGenKeyPlaceholder'), {
      target: { value: 'heygen_client_key_1234567890' },
    });
    fireEvent.click(screen.getByText('pilotSaveHeyGenBtn'));
    await waitFor(() => expect(screen.getByText('pilotSubmitHeyGenMp4Btn')).toBeTruthy());

    fireEvent.click(screen.getByText('pilotSubmitHeyGenMp4Btn'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, i]) => String(i?.body ?? '').includes('submit_heygen_mp4')),
      ).toBe(true),
    );

    fireEvent.click(screen.getByText('pilotByokClearBtn (HeyGen)'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, i]) => String(i?.body ?? '').includes('clear_byok_key')),
      ).toBe(true),
    );

    // Manual publish submit
    fireEvent.change(screen.getByPlaceholderText('https://www.tiktok.com/@.../video/...'), {
      target: { value: 'https://www.tiktok.com/@ceo/video/987654' },
    });
    fireEvent.click(screen.getByText('pilotSaveManualPublishBtn'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, i]) =>
          String(i?.body ?? '').includes('record_manual_publish'),
        ),
      ).toBe(true),
    );
  });
});
