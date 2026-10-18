import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listMarketplaceBlueprints } from '@/forest/marketplace/blueprint-service';
import { listMarketplaceTemplates } from '@/tree/marketplace/marketplace-service';
import { getCreatorBalance } from '@/tree/marketplace/royalty-engine';
import type { BlueprintSortOrder, MarketplacePlatform } from '@/seed/types/creator-marketplace';

export interface MarketplaceSearchParamsInput {
  niche?: string;
  platform?: string;
  minConversionRate?: string;
  royalty?: string;
  sort?: string;
  search?: string;
  q?: string;
  page?: string;
  pageSize?: string;
}

export function parseMarketplaceSearchParams(sp: MarketplaceSearchParamsInput) {
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const pageSize = sp.pageSize ? Math.min(50, Math.max(1, parseInt(sp.pageSize, 10) || 12)) : 12;
  const minConversionRate = sp.minConversionRate ? parseFloat(sp.minConversionRate) : undefined;
  const royaltyRate = sp.royalty ? parseFloat(sp.royalty) : undefined;
  const search = sp.search || sp.q || undefined;
  const niche = sp.niche && sp.niche !== 'all' ? sp.niche : undefined;
  const platform = sp.platform && sp.platform !== 'all' ? (sp.platform as MarketplacePlatform) : undefined;
  const sort = sp.sort as BlueprintSortOrder | undefined;

  return {
    page,
    pageSize,
    minConversionRate,
    royaltyRate,
    search,
    niche,
    platform,
    sort,
  };
}

export async function loadMarketplacePageData(
  locale: string,
  filters: ReturnType<typeof parseMarketplaceSearchParams>,
) {
  const { page, pageSize, niche, platform, minConversionRate, royaltyRate, search, sort } = filters;
  const d1 = await getD1();
  const currentUser = await getCurrentUser();

  const [blueprintsData, templatesData, royaltyBalance] = await Promise.all([
    listMarketplaceBlueprints(d1, {
      page,
      pageSize,
      niche,
      platform,
      minConversionRate,
      royaltyRate,
      search,
      sort,
      locale: locale as 'en' | 'vi',
    }),
    listMarketplaceTemplates(d1, {
      page,
      pageSize,
      niche,
      targetPlatform: platform,
      search,
      sortBy: 'trending',
    }),
    currentUser?.id ? getCreatorBalance(d1, currentUser.id) : null,
  ]);

  return {
    blueprintsData,
    templatesData,
    royaltyBalance,
    currentUser,
  };
}
