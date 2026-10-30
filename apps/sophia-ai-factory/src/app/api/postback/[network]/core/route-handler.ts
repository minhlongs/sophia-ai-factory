import { NextRequest, NextResponse } from 'next/server';
import { recordConversionIdempotent } from '@/land/tracking/edge-link';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { logInvalidSignature, verifyPostbackSignature } from './signature-verifier';
import { KNOWN_NETWORKS, PostbackSchema } from './types';
import { processSaasCryptoPostback } from '@/land/affiliates/postbacks/saas-crypto-postback-service';
import type { SaasCryptoNetwork } from '@/land/affiliates/postbacks/saas-crypto-postback-types';
import { resolveNetworkSecret } from '@/land/postback/network-secret-resolver';
import { getCredentials, type AffiliateNetwork } from '@/land/affiliates/credentials';

const DOMAIN_B_NETWORKS = new Set<string>(['partnerstack', 'rewardful', 'binance', 'binance-link', 'bybit']);

/** Allow-listed slugs with no signature-verifier branch yet: fail closed with guidance. */
const UNSUPPORTED_VERIFIER_NETWORKS = new Set<string>(['impact', 'cj', 'generic']);

const TENANT_GUIDANCE =
  'Bind the postback to a workspace: pass a tracking link id (link_id/sub_id) ' +
  'created in the workspace, or a tenant_id whose workspace stores this ' +
  'network credential. See docs/postback-tenant-migration.md (VI/EN).';

/** Domain B service error → HTTP status: permanent (4xx) vs transient (503) vs ack (200). */
const DOMAIN_B_STATUS: Record<string, number> = {
  ZERO_COMMISSION: 200,
  INVALID_SIGNATURE: 401,
  MALFORMED_JSON: 400,
  INVALID_COMMISSION: 422,
  TENANT_REQUIRED: 422,
  SECRET_NOT_CONFIGURED: 503,
  DB_WRITE_FAILED: 503,
};

function normalizeDomainBNetwork(net: string): SaasCryptoNetwork | null {
  if (net === 'binance-link' || net === 'binance') return 'binance';
  if (net === 'bybit' || net === 'partnerstack' || net === 'rewardful') return net;
  return null;
}

function extractCandidateLinkId(request: NextRequest, body: Record<string, unknown>): string | null {
  const conv = (body.conversion || {}) as Record<string, unknown>;
  const url = new URL(request.url);
  const raw =
    body.link_id ?? body.sub_id ?? body.subUid ?? body.affiliate_sub_id ?? conv.sub_id ??
    url.searchParams.get('link_id') ?? url.searchParams.get('sub_id');
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function extractExplicitTenantId(request: NextRequest, body: Record<string, unknown>): string | null {
  const url = new URL(request.url);
  const raw = body.tenant_id ?? body.tenantId ?? url.searchParams.get('tenant_id');
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

async function resolveTenantSecretFallback(
  db: D1Database,
  network: SaasCryptoNetwork,
  tenantId: string,
): Promise<string | null> {
  const creds = await getCredentials(db, tenantId, network as unknown as AffiliateNetwork);
  if (!creds) return null;
  const rec = creds as unknown as Record<string, string | undefined>;
  return rec.api_secret ?? rec.api_key ?? null;
}

export async function handlePostbackRoute(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  const { network } = await params;

  if (!KNOWN_NETWORKS.has(network)) {
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });
  }

  if (UNSUPPORTED_VERIFIER_NETWORKS.has(network)) {
    // Fail closed with an actionable error instead of a misleading 401:
    // no verifier branch exists for this slug yet, so no signature could pass.
    return NextResponse.json(
      {
        error: 'network_not_supported',
        network,
        guidance:
          `No signature verifier is configured for '${network}' yet. ` +
          'Store the network credential in the workspace and use a supported ' +
          `network slug. ${TENANT_GUIDANCE}`,
      },
      { status: 501 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const isDomainB = DOMAIN_B_NETWORKS.has(network);
  const candidateLinkId = extractCandidateLinkId(request, body);
  const explicitTenantId = extractExplicitTenantId(request, body);

  if (!isDomainB) {
    const parsed = PostbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing required field: link_id' }, { status: 422 });
    }
  } else if (!candidateLinkId && !explicitTenantId) {
    return NextResponse.json(
      { error: 'Missing required field: link_id or tenant_id' },
      { status: 422 },
    );
  }

  const db = await getD1();
  if (!db) {
    logger.error('[postback] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const linkRow = candidateLinkId
    ? await db
        .prepare('SELECT tenant_id FROM tracking_links WHERE id = ? LIMIT 1')
        .bind(candidateLinkId)
        .first<{ tenant_id: string }>()
    : null;

  if (candidateLinkId && !linkRow) {
    return NextResponse.json({ error: 'Tracking link not found' }, { status: 404 });
  }

  // No 'default'/global tenant fallback: without a verified link or an explicit
  // tenant hint bound to that tenant's credential, the request cannot be
  // attributed to any workspace and must fail closed.
  const tenantId = linkRow?.tenant_id ?? explicitTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_unresolvable', guidance: TENANT_GUIDANCE },
      { status: 422 },
    );
  }
  const route = `/api/postback/${network}`;

  try {
    const valid = await verifyPostbackSignature(
      db,
      network,
      candidateLinkId ?? tenantId,
      rawBody,
      request,
      body,
    );
    if (!valid) {
      logger.error('[postback] Invalid signature — rejected', { network, linkId: candidateLinkId });
      await logInvalidSignature(db, network, route);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (sigErr) {
    const msg = sigErr instanceof Error ? sigErr.message : String(sigErr);
    logger.error('[postback] Signature verification error', { network, error: msg });
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 });
  }

  const domainBNet = normalizeDomainBNetwork(network);
  if (domainBNet && isDomainB) {
    const secret =
      (candidateLinkId ? await resolveNetworkSecret(db, network, candidateLinkId) : null) ??
      (await resolveTenantSecretFallback(db, domainBNet, tenantId)) ??
      '';
    const sigHeader =
      request.headers.get('x-signature') ||
      request.headers.get('pstack-signature') ||
      request.headers.get('x-rewardful-signature') ||
      '';

    const outcome = await processSaasCryptoPostback({
      db,
      tenantId,
      network: domainBNet,
      rawBody,
      signature: sigHeader,
      secret,
    });

    if (!outcome.success) {
      const errCode = outcome.error ?? 'UNKNOWN';
      const st = DOMAIN_B_STATUS[errCode] ?? 500;
      return NextResponse.json(
        st === 200 ? { ok: true, skipped: 'ZERO_COMMISSION' } : { ok: false, error: errCode },
        { status: st },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        eventId: outcome.eventId,
        duplicate: outcome.isIdempotentDuplicate ?? false,
      },
      { status: 200 },
    );
  }

  try {
    const linkId = String(body.link_id);
    const recorded = await recordConversionIdempotent(db, linkId, network, {
      externalConversionId: typeof body.external_id === 'string' ? body.external_id : undefined,
      amountUsd: typeof body.amount_usd === 'number' ? body.amount_usd : undefined,
      ...body,
    });
    return NextResponse.json(
      { ok: true, conversionId: recorded.conversionId, duplicate: recorded.duplicate },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[postback] Conversion failed to record', { network, error: message });
    // A storage failure is transient from the provider's view: ask for a retry
    // instead of recording a false success or a misleading validation error.
    return NextResponse.json({ ok: false, error: 'db_write_failed' }, { status: 503 });
  }
}
