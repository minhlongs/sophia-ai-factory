import { NextRequest, NextResponse } from 'next/server';
import { recordConversion } from '@/land/tracking/edge-link';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { logInvalidSignature, verifyPostbackSignature } from './signature-verifier';
import { KNOWN_NETWORKS, PostbackSchema } from './types';

export async function handlePostbackRoute(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  const { network } = await params;

  if (!KNOWN_NETWORKS.has(network)) {
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing required field: link_id' },
      { status: 422 },
    );
  }

  const route = `/api/postback/${network}`;

  const db = await getD1();
  if (!db) {
    logger.error('[postback] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  try {
    const valid = await verifyPostbackSignature(
      db,
      network,
      parsed.data.link_id,
      rawBody,
      request,
      body as Record<string, unknown>,
    );

    if (!valid) {
      logger.error('[postback] Invalid signature — rejected', { network, linkId: parsed.data.link_id });
      await logInvalidSignature(db, network, route);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (sigErr) {
    const msg = sigErr instanceof Error ? sigErr.message : String(sigErr);
    logger.error('[postback] Signature verification error', { network, error: msg });
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 });
  }

  try {
    await recordConversion(parsed.data.link_id, network, {
      externalConversionId: parsed.data.external_id,
      amountUsd: parsed.data.amount_usd,
      ...(body as Record<string, unknown>),
    });

    logger.info('[postback] Conversion recorded', {
      network,
      linkId: parsed.data.link_id,
      amountUsd: parsed.data.amount_usd,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[postback] Conversion failed to record', { network, error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
