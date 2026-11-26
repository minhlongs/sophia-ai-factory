/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { evaluateAsnClickFraud } from '../asn-click-fraud-shield';
import { evaluateHookAndBeatPacing } from '@/seed/ai/hook-beat-evaluator';
import {
  extractSubtitleDialogueLines,
  reassembleLocalizedSubtitle,
} from '@/seed/video/timeline-isolated-srt';
import { validateYouTubeMetadataPreflight } from '@/seed/video/youtube-preflight-validator';
import {
  sha256NormalizedPii,
  signStandardWebhookPayload,
  verifyStandardWebhookSignature,
} from '@/seed/compliance/capi-and-webhook-verifier';
import {
  signVerifiedMediaKitJws,
  verifyMediaKitJws,
} from '@/seed/aeo/verified-media-kit-attestation';

describe('ak-xia Mega Moat R3-R15 (6 verified 3-0 cores)', () => {
  it('flags datacenter/VPN ASNs while allowing residential ISPs', () => {
    expect(evaluateAsnClickFraud(16509).suspicious).toBe(true); // AWS
    expect(evaluateAsnClickFraud('9009').suspicious).toBe(true); // M247 VPN
    expect(evaluateAsnClickFraud(45899).suspicious).toBe(false); // VNPT residential
  });

  it('scores hook pacing at 165 wpm and detects emotional triggers', () => {
    const good = evaluateHookAndBeatPacing('Save 30% on fees today. Click the link below!');
    expect(good.hookExceeds3s).toBe(false);
    expect(good.detectedTrigger).toBe('stat_data');
    expect(good.weightedScore100).toBe(100);
  });

  it('isolates SRT timecodes locally and reassembles localized dialogue with 0% corruption', () => {
    const srt = '1\n00:00:00,000 --> 00:00:03,000\nHello world\n\n2\n00:00:03,000 --> 00:00:06,000\nSave fees';
    const isolated = extractSubtitleDialogueLines(srt);
    expect(isolated.contentLines).toEqual(['Hello world', 'Save fees']);
    const vi = reassembleLocalizedSubtitle(isolated, ['Xin chào', 'Tiết kiệm phí']);
    expect(vi).toContain('00:00:00,000 --> 00:00:03,000\nXin chào');
    expect(vi).toContain('00:00:03,000 --> 00:00:06,000\nTiết kiệm phí');
  });

  it('validates YouTube title, UTF-8 description bytes, and chapter rules with 0 API quota', () => {
    const ok = validateYouTubeMetadataPreflight({
      title: 'Bybit vs OKX 2026 Fee Breakdown',
      description: '0:00 Intro\n0:15 Fee Comparison\n0:40 Verdict',
    });
    expect(ok.valid).toBe(true);
    expect(ok.chapterCount).toBe(3);

    const bad = validateYouTubeMetadataPreflight({
      title: 'x'.repeat(105),
      description: '0:05 Wrong Start\n0:10 Too Close',
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain('CHAPTERS_MUST_START_AT_0_00');
  });

  it('hashes normalized PII for CAPI and verifies standard-webhooks HMAC signatures', async () => {
    const h1 = await sha256NormalizedPii('  CEO@Example.COM ');
    const h2 = await sha256NormalizedPii('ceo@example.com');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);

    const sig = await signStandardWebhookPayload({
      webhookId: 'msg_123',
      timestampSec: 1764160000,
      rawBody: '{"event":"conversion"}',
      secret: 'whsec_test_secret_key',
    });
    const verified = await verifyStandardWebhookSignature({
      webhookId: 'msg_123',
      timestampSec: 1764160000,
      rawBody: '{"event":"conversion"}',
      secret: 'whsec_test_secret_key',
      signatureHeader: sig,
    });
    expect(verified).toBe(true);
  });

  it('signs and verifies privacy-preserving Media Kit JWS attestations', async () => {
    const token = await signVerifiedMediaKitJws(
      {
        workspaceSlug: 'mekong-rd',
        periodDays: 30,
        verifiedHumanClicks: 14200,
        conversionRatePct: 4.8,
        botTrafficFilteredPct: 22.5,
        issuedAtIso: '2026-11-26T16:00:00Z',
      },
      'media-kit-secret-2026',
    );
    const verified = await verifyMediaKitJws(token, 'media-kit-secret-2026');
    expect(verified.valid).toBe(true);
    expect(verified.claims?.verifiedHumanClicks).toBe(14200);
  });
});
