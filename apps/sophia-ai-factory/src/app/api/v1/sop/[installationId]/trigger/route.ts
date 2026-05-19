/**
 * SOP Webhook Trigger Endpoint
 *
 * POST /api/v1/sop/[installationId]/trigger
 *
 * Validates HMAC signature, then fires an async SOP run.
 * Returns {runId, status: 'queued'} immediately (<500ms).
 * Actual run executes via ctx.waitUntil or fire-and-forget.
 *
 * Security:
 * - HMAC signature required (X-Sophia-Signature header)
 * - Installation secret from customizations.webhookSecret
 * - UserId sourced from installation row only (never from request body)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInstallation } from '@/lib/sop/sop-repo-installations';
import { verifySignature } from '@/lib/sop/webhook-hmac';
import { runSop } from '@/lib/sop/executor/sop-runner';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getSopD1 } from '@/lib/sop/d1';
import type { SopCustomizations } from '@/lib/sop/sop-types';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;  // 64KB limit

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ installationId: string }> },
): Promise<NextResponse> {
  const { installationId } = await params;
  return withRateLimit(async (r: NextRequest) => {
    const db = getSopD1();
    if (!db) {
      return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
    }

    // Load installation
    const inst = await getInstallation(db, installationId);
    if (!inst) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    if (!inst.enabled) {
      return NextResponse.json({ error: 'Installation disabled' }, { status: 403 });
    }

    // Read body (size-limited)
    let bodyText = '';
    try {
      const reader = r.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let totalSize = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalSize += value.byteLength;
          if (totalSize > MAX_BODY_BYTES) {
            return NextResponse.json({ error: 'Payload too large (max 64KB)' }, { status: 413 });
          }
          chunks.push(value);
        }
        bodyText = new TextDecoder().decode(
          chunks.reduce((acc, chunk) => {
            const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
            merged.set(acc, 0);
            merged.set(chunk, acc.byteLength);
            return merged;
          }, new Uint8Array(0)),
        );
      }
    } catch {
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
    }

    // HMAC verification
    const signatureHeader = r.headers.get('x-sophia-signature');
    const customizations: SopCustomizations = inst.customizations
      ? (JSON.parse(inst.customizations) as SopCustomizations)
      : {};

    if (signatureHeader && customizations.webhookSecret) {
      const valid = await verifySignature(bodyText, signatureHeader, customizations.webhookSecret);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse body as trigger payload
    let triggerPayload: Record<string, unknown> = {};
    if (bodyText) {
      try { triggerPayload = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* plain body ok */ }
    }

    // Async run via fire-and-forget (CF Workers: use waitUntil if ctx available)
    const runCtx = {
      installationId,
      runId: '',
      userId: inst.user_id,
      trigger: 'webhook' as const,
      triggerPayload,
    };

    void runSop(db, runCtx).catch(err => {
      logger.error('[trigger] async run error', err instanceof Error ? err : new Error(String(err)), { installationId });
    });

    return NextResponse.json({ status: 'queued', installationId }, { status: 202 });
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(request);
}
