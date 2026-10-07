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
  } as unknown as Request;

  const destination = getAffiliateRoute(request as any, niche);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold mb-4">Redirecting to best offer...</h1>
      <p className="text-sm text-gray-500 mb-8">
        We are finding the best deal for your region ({productId}).
      </p>
      <script dangerouslySetInnerHTML={{
        __html: `window.location.href = "${destination}?ref=sophia"`
      }} />
    </div>
  );
}
