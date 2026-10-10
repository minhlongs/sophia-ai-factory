'use client';

/**
 * Deal Detail Information Sections Orchestrator
 *
 * Layer: forest/deals/detail-drawer
 */

import React from 'react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
} from '@/seed/types/enterprise-deal';
import { DealBantMatrix } from './deal-bant-matrix';
import { DealInfoSections } from './deal-info-sections';

interface DealSectionsProps {
  deal: EnterpriseDeal;
  enrichment: EnterpriseLeadEnrichment | null;
}

export function DealSections({ deal, enrichment }: DealSectionsProps) {
  return (
    <>
      <DealBantMatrix deal={deal} />
      <DealInfoSections deal={deal} enrichment={enrichment} />
    </>
  );
}
