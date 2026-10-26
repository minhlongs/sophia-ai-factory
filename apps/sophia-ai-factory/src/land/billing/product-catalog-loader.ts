import { createServerClient } from '@/seed/db/client';
import {
  CANONICAL_TIER_PRODUCTS,
  type ProductItem,
} from '@/components/stitch/screens/products/products-page';

interface SubscriptionRow {
  tier?: string | null;
  status?: string | null;
}

export async function loadProductsWithSubscriberCounts(): Promise<ProductItem[]> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('subscriptions')
      .select('tier, status')
      .eq('status', 'active');

    const rows = (data as SubscriptionRow[] | null) ?? [];
    const counts: Record<string, number> = {
      BASIC: 0,
      PREMIUM: 0,
      ENTERPRISE: 0,
      MASTER: 0,
    };

    for (const r of rows) {
      const t = (r.tier || '').toUpperCase();
      if (t in counts) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }

    const idToTier: Record<string, string> = {
      starter: 'BASIC',
      growth: 'PREMIUM',
      scale: 'ENTERPRISE',
      master: 'MASTER',
    };

    return CANONICAL_TIER_PRODUCTS.map((item) => {
      const tierKey = idToTier[item.id];
      return {
        ...item,
        subscribers: tierKey ? (counts[tierKey] ?? 0) : item.subscribers,
      };
    });
  } catch {
    return CANONICAL_TIER_PRODUCTS;
  }
}
