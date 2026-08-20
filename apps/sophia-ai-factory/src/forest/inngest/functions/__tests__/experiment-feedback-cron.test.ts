/**
 * Experiment Feedback Cron Tests — Phase 4: Creative Learning Loop
 *
 * Tests the pure helper exported from
 * forest/inngest/functions/experiment-feedback-cron.ts:
 *   - buildWinnerPayload(row) — maps a decided experiment row to a
 *     creative-memory payload describing the winning variant.
 *
 * The Inngest function itself is not directly testable (it requires a
 * live Inngest client + D1 binding), so we test the exported helper
 * that contains the core winner-mapping logic.
 */

import { describe, it, expect } from 'vitest';
import { buildWinnerPayload } from '../experiment-feedback-cron';

// ─── Fixtures ───────────────────────────────────────────────────────────────

interface DecidedRow {
  id: string;
  tenant_id: string;
  video_id: string;
  content_type: string;
  variant_a_caption: string;
  variant_b_caption: string;
  variant_a_thumb_url: string | null;
  variant_b_thumb_url: string | null;
  impressions_a: number;
  impressions_b: number;
  conversions_a: number;
  conversions_b: number;
  winner: string;
  decided_at: string;
}

function baseRow(overrides: Partial<DecidedRow> = {}): DecidedRow {
  return {
    id: 'exp-1',
    tenant_id: 'ws-1',
    video_id: 'vid-1',
    content_type: 'short',
    variant_a_caption: 'caption A',
    variant_b_caption: 'caption B',
    variant_a_thumb_url: 'thumb-a.jpg',
    variant_b_thumb_url: 'thumb-b.jpg',
    impressions_a: 1000,
    impressions_b: 800,
    conversions_a: 50,
    conversions_b: 30,
    winner: 'a',
    decided_at: '2026-08-21T03:00:00Z',
    ...overrides,
  };
}

// ─── buildWinnerPayload ─────────────────────────────────────────────────────

describe('buildWinnerPayload', () => {
  it('returns no_winner decision when winner is "no_winner"', () => {
    const payload = buildWinnerPayload(baseRow({ winner: 'no_winner' }));
    expect(payload).toEqual({
      decision: 'no_winner',
      content_type: 'short',
    });
  });

  it('maps variant A as winner when winner is "a"', () => {
    const payload = buildWinnerPayload(baseRow({ winner: 'a' }));
    expect(payload).toEqual({
      decision: 'a',
      content_type: 'short',
      winning_caption: 'caption A',
      winning_thumb_url: 'thumb-a.jpg',
      impressions_winner: 1000,
      impressions_loser: 800,
      conversions_winner: 50,
      conversions_loser: 30,
    });
  });

  it('maps variant B as winner when winner is "b"', () => {
    const payload = buildWinnerPayload(baseRow({ winner: 'b' }));
    expect(payload).toEqual({
      decision: 'b',
      content_type: 'short',
      winning_caption: 'caption B',
      winning_thumb_url: 'thumb-b.jpg',
      impressions_winner: 800,
      impressions_loser: 1000,
      conversions_winner: 30,
      conversions_loser: 50,
    });
  });

  it('preserves content_type from the source row', () => {
    const payload = buildWinnerPayload(baseRow({ content_type: 'long-form' }));
    expect(payload.content_type).toBe('long-form');
  });

  it('handles null thumbnail URLs when winner has none', () => {
    const payload = buildWinnerPayload(
      baseRow({ winner: 'a', variant_a_thumb_url: null }),
    );
    expect(payload.winning_thumb_url).toBeNull();
  });
});