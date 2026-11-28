import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import Database from 'better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';
import viMessages from '../../../../messages/vi.json';
import { PilotVoiceAndCapCutPack } from '@/components/first-value/pilot-voice-and-capcut-pack';
import {
  clearPilotInFlightLock,
  getPilotQuotaStatus,
  releasePilotGenerationSlot,
  reservePilotGenerationSlot,
} from '@/tree/first-value/pilot-state-repo';

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

function createRealSqliteD1(): D1Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE pilot_usage_quotas (
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      used_generations INTEGER NOT NULL DEFAULT 0,
      last_generation_at_ms INTEGER,
      last_generation_at_iso TEXT,
      estimated_spend_microusd INTEGER NOT NULL DEFAULT 0,
      in_flight_until_ms INTEGER,
      updated_at_iso TEXT NOT NULL,
      PRIMARY KEY (org_id, user_id)
    );
  `);
  const wrapStmt = (sql: string, bound: unknown[] = []) => ({
    bind: (...args: unknown[]) => wrapStmt(sql, args),
    first: async <T = unknown>() => (db.prepare(sql).get(...bound) as T) ?? null,
    all: async <T = unknown>() => ({ results: db.prepare(sql).all(...bound) as T[] }),
    run: async () => {
      const info = db.prepare(sql).run(...bound);
      return { success: true, meta: { changes: info.changes } };
    },
  });
  return { prepare: (sql: string) => wrapStmt(sql) } as unknown as D1Database;
}

const SCRIPT_A = {
  title: 'Script A',
  total_duration: 15,
  scenes: [{ scene_number: 1, title: 'S1', visual_description: 'V1', narration: 'Nội dung A', duration_estimate: 15 }],
};

const SCRIPT_B = {
  title: 'Script B',
  total_duration: 15,
  scenes: [{ scene_number: 1, title: 'S1', visual_description: 'V1', narration: 'Nội dung B mới', duration_estimate: 15 }],
};

describe('Wave C.4 Lane B: Pre-spend codec check, stale async media rejection, and real SQLite D1 quota atomicity', () => {
  const origFetch = globalThis.fetch;
  const origAudioEncoder = globalThis.AudioEncoder;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:http://127.0.0.1/test-audio-1');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    globalThis.AudioEncoder = origAudioEncoder;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it('blocks paid TTS before fetch when AudioEncoder is unsupported in narrated_mp4 mode, and allows standalone mp3_only mode', async () => {
    (globalThis as Record<string, unknown>).AudioEncoder = undefined;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PilotVoiceAndCapCutPack
          orgId="org-1"
          artifactId="art-1"
          script={SCRIPT_A}
          ctaText="CTA"
          shortUrl="https://sophia.example/r/1"
          disclosureTag="#QuảngCáo"
          busy={false}
          productImageUrls={[]}
          onProductImagesChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByTestId('pilot-generate-voice-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('WebCodecs AudioEncoder'));
    expect(fetchMock).not.toHaveBeenCalled();

    // Explicitly switch to standalone MP3 mode -> allowed
    fireEvent.change(screen.getByTestId('pilot-voice-target-mode'), { target: { value: 'mp3_only' } });
    fireEvent.click(screen.getByTestId('pilot-generate-voice-btn'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('discards stale async voice response when script changes while request is in flight', async () => {
    let resolveVoice!: (v: unknown) => void;
    const pendingVoice = new Promise((res) => { resolveVoice = res; });
    globalThis.fetch = vi.fn().mockReturnValue(pendingVoice) as unknown as typeof fetch;

    const { rerender } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PilotVoiceAndCapCutPack
          orgId="org-1"
          artifactId="art-1"
          script={SCRIPT_A}
          ctaText="CTA"
          shortUrl="https://sophia.example/r/1"
          disclosureTag="#QuảngCáo"
          busy={false}
          productImageUrls={[]}
          onProductImagesChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByTestId('pilot-voice-target-mode'), { target: { value: 'mp3_only' } });
    fireEvent.click(screen.getByTestId('pilot-generate-voice-btn'));

    // Script changes while voice request is still in flight
    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PilotVoiceAndCapCutPack
          orgId="org-1"
          artifactId="art-1"
          script={SCRIPT_B}
          ctaText="CTA"
          shortUrl="https://sophia.example/r/1"
          disclosureTag="#QuảngCáo"
          busy={false}
          productImageUrls={[]}
          onProductImagesChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    await act(async () => {
      resolveVoice({
        ok: true,
        status: 200,
        blob: async () => new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mpeg' }),
      });
    });

    expect(screen.queryByTestId('pilot-render-narrated-mp4-btn')).toBeNull();
  });

  it('proves real SQLite D1 atomic concurrency lock, non-refund on ambiguous timeout, and refund on pre-charge rejection', async () => {
    const d1 = createRealSqliteD1();
    const now = 1_700_000_000_000;

    // 1. First request reserves slot
    const r1 = await reservePilotGenerationSlot(d1, {
      orgId: 'org-sql',
      userId: 'u-sql',
      maxGenerations: 3,
      cooldownMs: 0,
      nowMs: now,
      maxEstimatedSpendMicroUsd: 100_000,
      estimatedCostPerAttemptMicroUsd: 10_000,
      inFlightLockMs: 60_000,
    });
    expect(r1.outcome).toBe('reserved');

    // 2. Concurrent second request is blocked atomically by in_flight lock
    const r2 = await reservePilotGenerationSlot(d1, {
      orgId: 'org-sql',
      userId: 'u-sql',
      maxGenerations: 3,
      cooldownMs: 0,
      nowMs: now + 100,
      maxEstimatedSpendMicroUsd: 100_000,
      estimatedCostPerAttemptMicroUsd: 10_000,
      inFlightLockMs: 60_000,
    });
    expect(r2.outcome).toBe('in_flight');

    // 3. Ambiguous timeout -> clearPilotInFlightLock clears lock WITHOUT refunding quota
    if (r1.outcome === 'reserved') {
      await clearPilotInFlightLock(d1, {
        orgId: 'org-sql',
        userId: 'u-sql',
        nowIso: new Date(now + 200).toISOString(),
        expectedLockUntilMs: r1.lockUntilMs,
      });
    }
    const qAfterAmbiguous = await getPilotQuotaStatus(d1, {
      orgId: 'org-sql',
      userId: 'u-sql',
      maxGenerations: 3,
      maxEstimatedSpendMicroUsd: 100_000,
    });
    expect(qAfterAmbiguous.usedGenerations).toBe(1);

    // 4. Next request reserves and hits pre-charge 401 -> releasePilotGenerationSlot refunds quota
    const r3 = await reservePilotGenerationSlot(d1, {
      orgId: 'org-sql',
      userId: 'u-sql',
      maxGenerations: 3,
      cooldownMs: 0,
      nowMs: now + 500,
      maxEstimatedSpendMicroUsd: 100_000,
      estimatedCostPerAttemptMicroUsd: 10_000,
      inFlightLockMs: 60_000,
    });
    expect(r3.outcome).toBe('reserved');
    if (r3.outcome === 'reserved') {
      await releasePilotGenerationSlot(d1, {
        orgId: 'org-sql',
        userId: 'u-sql',
        nowIso: new Date(now + 600).toISOString(),
        refundEstimatedSpendMicroUsd: 10_000,
        expectedLockUntilMs: r3.lockUntilMs,
      });
    }
    const qAfterRefund = await getPilotQuotaStatus(d1, {
      orgId: 'org-sql',
      userId: 'u-sql',
      maxGenerations: 3,
      maxEstimatedSpendMicroUsd: 100_000,
    });
    expect(qAfterRefund.usedGenerations).toBe(1);
  });
});
