/**
 * Edge TTS Dialect Voice Bindings & Compliance Disclaimer Unit Tests
 *
 * Covers:
 * 1. Dialect voice resolution for US/UK, Tokyo/Osaka, VN N/C/S
 * 2. Audio disclaimer injection in Edge TTS synthesis options
 * 3. Synthesis with dialect lexical normalization
 *
 * @module tree/cultural-adaptation/__tests__/edge-tts-dialect.test
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  resolveEdgeVoiceForDialect,
  synthesizeEdgeTts,
  EDGE_APAC_VOICES,
} from '@/forest/edge-tts/edge-tts-client';

describe('Edge TTS Dialect Bindings & Compliance Disclaimers (forest/edge-tts)', () => {
  it('resolves correct neural voice models for all regional dialects', () => {
    expect(resolveEdgeVoiceForDialect('en-US', 'female')).toBe('en-US-JennyNeural');
    expect(resolveEdgeVoiceForDialect('en-US', 'male')).toBe('en-US-GuyNeural');
    expect(resolveEdgeVoiceForDialect('en-GB', 'female')).toBe('en-GB-SoniaNeural');
    expect(resolveEdgeVoiceForDialect('en-GB', 'male')).toBe('en-GB-RyanNeural');
    expect(resolveEdgeVoiceForDialect('ja-JP-tokyo', 'female')).toBe('ja-JP-NanamiNeural');
    expect(resolveEdgeVoiceForDialect('ja-JP-tokyo', 'male')).toBe('ja-JP-KeitaNeural');
    expect(resolveEdgeVoiceForDialect('ja-JP-osaka', 'female')).toBe('ja-JP-NanamiNeural');
    expect(resolveEdgeVoiceForDialect('ja-JP-osaka', 'male')).toBe('ja-JP-KeitaNeural');
    expect(resolveEdgeVoiceForDialect('vi-VN-bac', 'male')).toBe('vi-VN-NamMinhNeural');
    expect(resolveEdgeVoiceForDialect('vi-VN-nam', 'female')).toBe('vi-VN-HoaiMyNeural');
    expect(resolveEdgeVoiceForDialect('vi-VN-trung', 'female')).toBe('vi-VN-HoaiMyNeural');
  });

  it('contains British English voices in the expanded EDGE_APAC_VOICES catalog', () => {
    const sonia = EDGE_APAC_VOICES.find((v) => v.name === 'en-GB-SoniaNeural');
    const ryan = EDGE_APAC_VOICES.find((v) => v.name === 'en-GB-RyanNeural');

    expect(sonia).toBeDefined();
    expect(ryan).toBeDefined();
    expect(sonia?.gender).toBe('female');
    expect(ryan?.gender).toBe('male');
  });

  it('synthesizes speech with regional dialect normalization and prosody', async () => {
    const usText = 'Take the elevator to the apartment.';
    const result = await synthesizeEdgeTts(usText, 'en', {
      dialect: 'en-GB',
      sourceDialect: 'en-US',
      gender: 'female',
    });

    expect(result.voice).toBe('en-GB-SoniaNeural');
    expect(result.normalizedScript).toContain('lift');
    expect(result.normalizedScript).toContain('flat');
    expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
  });

  it('injects audio compliance disclaimer when complianceJurisdiction is EU', async () => {
    const text = 'Welcome to our autonomous enterprise platform.';
    const result = await synthesizeEdgeTts(text, 'en', {
      complianceJurisdiction: 'EU',
      injectAudioDisclaimer: true,
    });

    expect(result.disclaimerInjected).toBe(true);
    expect(result.disclaimerText).toContain('Sophia AI');
    expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
  });

  it('injects Vietnamese Decree 13 disclaimer when complianceJurisdiction is VN', async () => {
    const text = 'Chào mừng bạn đến với Sophia AI Factory.';
    const result = await synthesizeEdgeTts(text, 'vi', {
      complianceJurisdiction: 'VN',
      dialect: 'vi-VN-nam',
    });

    expect(result.disclaimerInjected).toBe(true);
    expect(result.disclaimerText).toContain('trí tuệ nhân tạo');
  });
});
