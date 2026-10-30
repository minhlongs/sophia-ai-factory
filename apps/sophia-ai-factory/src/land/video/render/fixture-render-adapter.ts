/**
 * TEST FIXTURE render adapter. Labeled, deterministic, network-free.
 *
 * This adapter exists ONLY for automated tests. It refuses to run in
 * production, and artifacts produced through it must be recorded with
 * `isFixture: true` — the publisher path rejects fixtures as real renders.
 *
 * Layer: land/video (test support — never import from production code)
 * @module land/video/render/fixture-render-adapter
 */

import type { RenderAdapter, RenderStatusResult, RenderSubmitInput } from './render-adapter';

function assertTestOnly(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FIXTURE_RENDER_ADAPTER_FORBIDDEN_IN_PRODUCTION');
  }
}

/** Minimal syntactically-MP4 byte prefix (`ftyp`) + deterministic payload. */
export function makeFixtureMp4Bytes(seed = 1): Uint8Array {
  const header = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];
  const body = Array.from({ length: 64 }, (_, i) => (seed + i) % 256);
  return new Uint8Array([...header, ...body]);
}

export type FixtureScenario = 'success' | 'provider-failure' | 'never-completes';

export function createFixtureRenderAdapter(scenario: FixtureScenario = 'success'): RenderAdapter {
  assertTestOnly();
  let polls = 0;
  return {
    provider: 'fixture',
    async submit(_input: RenderSubmitInput): Promise<{ providerJobId: string }> {
      assertTestOnly();
      if (!_input.scriptBody) throw new Error('FIXTURE_SUBMIT_REQUIRES_SCRIPT');
      return { providerJobId: `fixture_job_${scenario}` };
    },
    async fetchStatus(): Promise<RenderStatusResult> {
      assertTestOnly();
      polls += 1;
      if (scenario === 'provider-failure') {
        return { status: 'failed', errorMessage: 'fixture provider failure' };
      }
      if (scenario === 'never-completes') {
        return { status: 'processing' };
      }
      // First poll processing, second poll completed (exercises the sleep loop).
      if (polls < 2) return { status: 'processing' };
      return {
        status: 'completed',
        mediaUrl: 'https://cdn.fixture.invalid/render.mp4',
        durationSec: 12,
      };
    },
    async downloadBytes(): Promise<Uint8Array> {
      assertTestOnly();
      return makeFixtureMp4Bytes(7);
    },
  };
}
