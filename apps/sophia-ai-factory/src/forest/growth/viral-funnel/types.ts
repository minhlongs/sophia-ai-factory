/**
 * Viral Funnel Dashboard View Types
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/types
 */

import type { ViralFunnelOverview } from '@/seed/types/growth';

export interface ViralFunnelViewProps {
  initialOverview: ViralFunnelOverview;
  locale?: 'en' | 'vi';
}
