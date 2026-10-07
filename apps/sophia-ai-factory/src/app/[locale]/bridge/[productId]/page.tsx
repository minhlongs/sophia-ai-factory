/**
 * High-Converting Edge Bridge Page Route
 *
 * Edge SSR App Router page for TikTok/Shorts/Reels bio-links.
 * Features Geo-Routing, real-time attribution, countdown timers,
 * vanity coupon codes, and teaser previews.
 *
 * Layer: app/[locale]/bridge/[productId]
 */

import React from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getAffiliateRoute } from '@/land/affiliates/routing/geo-router';
import { recordClick } from '@/land/affiliates/click-recorder';
import { buildBridgePageData } from '@/tree/affiliate/bridge/bridge-page-builder';
import { BridgeClientView } from './BridgeClientView';

interface BridgePageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export default async function BridgeRoute({ params }: BridgePageProps) {
  const { locale, productId } = await params;

  const isSaas = productId.toLowerCase().startsWith('saas');
  const isCrypto = productId.toLowerCase().startsWith('crypto');

  if (!isSaas && !isCrypto) {
    notFound();
  }

  const requestHeaders = await headers();
  const niche = isCrypto ? 'crypto' : 'saas';

  const request = {
    headers: requestHeaders,
  } as unknown as NextRequest;

  const destinationBase = getAffiliateRoute(request, niche);

  const clickId = crypto.randomUUID();
  const rawIp =
    requestHeaders.get('cf-connecting-ip') ??
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const userAgent = requestHeaders.get('user-agent');
  const referrer = requestHeaders.get('referer');
  const country = requestHeaders.get('cf-ipcountry') || 'VN';

  // Dual-write click attribution
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

  const separator = destinationBase.includes('?') ? '&' : '?';
  const finalDestinationUrl = `${destinationBase}${separator}ref=sophia&sub_id=${clickId}`;

  const bridgeData = buildBridgePageData({
    productId,
    locale,
    country,
    destinationUrl: finalDestinationUrl,
  });

  return <BridgeClientView data={bridgeData} />;
}
