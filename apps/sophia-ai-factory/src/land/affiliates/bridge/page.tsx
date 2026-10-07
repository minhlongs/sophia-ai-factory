/**
 * Bridge Page Component
 *
 * Server Component that renders the landing bridge page for affiliate conversions.
 * Reads metadata and redirects based on locale and geo-targeting.
 *
 * Layer: land/affiliates/bridge (Business Workflow)
 * @module land/affiliates/bridge/page
 */

import { notFound } from 'next/navigation';
import { getAffiliateRoute } from '@/land/affiliates/routing/geo-router';
import { recordClick } from '@/land/affiliates/click-recorder';
import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';

export default async function BridgePage(props: {
  params: Promise<{ locale: string; productId: string }>;
}) {
  const { productId } = await props.params;

  // Verify product validity before routing
  const isValid = productId.startsWith('saas_') || productId.startsWith('crypto_');
  if (!isValid) notFound();

  // Get geo-targeted destination
  const requestHeaders = await headers();
  const niche = productId.startsWith('saas_') ? 'saas' : 'crypto';

  // Create a minimal Request-like object for geo-router
  const request = {
    headers: requestHeaders,
  } as unknown as NextRequest;

  const destination = getAffiliateRoute(request, niche);

  // Generate unique click attribution identifier
  const clickId = crypto.randomUUID();
  const rawIp =
    requestHeaders.get('cf-connecting-ip') ??
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const userAgent = requestHeaders.get('user-agent');
  const referrer = requestHeaders.get('referer');
  const country = requestHeaders.get('cf-ipcountry');

  // GDPR-compliant dual-write (KV hot cache + D1 analytics)
  await recordClick({
    clickId,
    tenantId: 'default',
    linkId: productId,
    offerId: productId,
    ip: rawIp,
    userAgent,
    referrer,
    country,
  });

  const separator = destination.includes('?') ? '&' : '?';
  const targetUrl = `${destination}${separator}ref=sophia&sub_id=${clickId}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold mb-4">Redirecting to best offer...</h1>
      <p className="text-sm text-muted-foreground mb-8">
        We are finding the best deal for your region ({productId}).
      </p>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.href = "${targetUrl}";`,
        }}
      />
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${targetUrl}`} />
      </noscript>
      <a
        href={targetUrl}
        className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
      >
        Click here if not redirected automatically
      </a>
    </div>
  );
}
