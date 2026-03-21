/**
 * HubSpot Deals Client
 *
 * Paginated listing of HubSpot deals via CRM API v3
 */

import type { HubSpotDeal, HubSpotApiResponse } from '@/types/hubspot';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

/**
 * List deals with pagination support
 */
export async function listDeals(
  accessToken: string,
  after?: string,
  limit = 100
): Promise<HubSpotApiResponse<HubSpotDeal>> {
  const url = new URL(`${HUBSPOT_BASE_URL}/crm/v3/objects/deals`);
  url.searchParams.append('limit', limit.toString());
  url.searchParams.append(
    'properties',
    'dealname,amount,dealstage,pipeline,closedate'
  );
  if (after) {
    url.searchParams.append('after', after);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HubSpot deals API error: ${response.status}`);
  }

  return response.json();
}
