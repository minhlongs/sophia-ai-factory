/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  createInitialEpcState,
  evaluateEpcObservation,
} from '../epc-anomaly-detector';
import {
  selectBrowserLocalTtsEngine,
  splitTextForTtsWorker,
} from '@/seed/video/browser-tts-device-probe';
import {
  assertFieldsMutableByRole,
  canPerformWorkspaceAction,
} from '@/seed/security/creator-va-rbac';

describe('ak-xia Rounds 18-19: Dual-Engine TTS Probe, EPC Anomaly Detector & Creator-VA RBAC', () => {
  it('selects Kokoro WebGPU/WASM for EN and Piper WASM for VI without hanging on null adapter', async () => {
    const enWebGpu = await selectBrowserLocalTtsEngine('en', {
      gpu: { requestAdapter: async () => ({ name: 'mock-gpu' }) },
    });
    expect(enWebGpu).toEqual({ engine: 'kokoro_82m_q8f16', device: 'webgpu', locale: 'en' });

    const enFallback = await selectBrowserLocalTtsEngine('en', {
      gpu: { requestAdapter: async () => null },
    });
    expect(enFallback.device).toBe('wasm');

    const vi = await selectBrowserLocalTtsEngine('vi');
    expect(vi).toEqual({ engine: 'piper_vi_vn_wasm', device: 'wasm', locale: 'vi' });

    const chunks = splitTextForTtsWorker(
      'First sentence about crypto affiliate workflows on Cloudflare Workers. Second sentence explaining zero GPU browser TTS rendering.',
      80,
    );
    expect(chunks.length).toBe(2);
  });

  it('detects sudden EPC drop and enforces 48-hour notification cooldown', () => {
    let state = createInitialEpcState();
    const baseTime = 1_764_200_000_000;
    for (let i = 0; i < 6; i++) {
      state = evaluateEpcObservation(state, 1.2 + (i % 2) * 0.05, baseTime + i * 3600_000).nextState;
    }

    const drop1 = evaluateEpcObservation(state, 0.05, baseTime + 7 * 3600_000);
    expect(drop1.anomalyDetected).toBe(true);
    expect(drop1.shouldNotify).toBe(true);

    const drop2 = evaluateEpcObservation(drop1.nextState, 0.02, baseTime + 8 * 3600_000);
    expect(drop2.shouldNotify).toBe(false); // 48h cooldown active
  });

  it('allows VA to draft scripts/videos while blocking referralUrl mutation and publishing', () => {
    expect(canPerformWorkspaceAction('va_editor', 'draft_script')).toBe(true);
    expect(canPerformWorkspaceAction('va_editor', 'publish_campaign')).toBe(false);
    expect(canPerformWorkspaceAction('owner', 'publish_campaign')).toBe(true);

    const vaEdit = assertFieldsMutableByRole('va_editor', ['title', 'referralUrl']);
    expect(vaEdit.allowed).toBe(false);
    expect(vaEdit.blockedFields).toEqual(['referralUrl']);

    const ownerEdit = assertFieldsMutableByRole('owner', ['title', 'referralUrl']);
    expect(ownerEdit.allowed).toBe(true);
  });
});
