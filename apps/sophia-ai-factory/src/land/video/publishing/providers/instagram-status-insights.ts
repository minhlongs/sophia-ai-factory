/**
 * Instagram Graph API status and insights fetches
 * @module land/video/publishing/providers/instagram-status-insights
 */

import { GRAPH_BASE, isMockMode, type IGMediaResponse, type IGInsightsResponse } from './instagram-helpers';

export async function fetchMediaStatusCode(
  mediaId: string,
  accessToken: string,
): Promise<string | undefined | null> {
  if (isMockMode() || mediaId.startsWith('mock_')) return 'FINISHED';

  const res = await fetch(`${GRAPH_BASE}/${mediaId}?fields=status_code&access_token=${accessToken}`);
  if (!res.ok) return null;
  return ((await res.json()) as IGMediaResponse).status_code;
}

export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
): Promise<IGInsightsResponse | null> {
  if (isMockMode() || mediaId.startsWith('mock_')) return { data: [] };

  const res = await fetch(
    `${GRAPH_BASE}/${mediaId}/insights?metric=impressions,reach,likes,comments,shares&access_token=${accessToken}`,
  );
  if (!res.ok) return null;
  return (await res.json()) as IGInsightsResponse;
}