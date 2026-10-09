/**
 * Acceptance Client Submodule: Types and Interfaces.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/types
 */

import React from 'react';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import type { Result } from '@/seed/types/result';

export interface HandoverAcceptanceClientProps {
  handover: CustomerHandoverRecord;
  initialCertificate: HandoverCertificate | null;
  locale: string;
  onSignAction?: (
    input: HandoverAcceptanceInput,
  ) => Promise<Result<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }, { code: string; message: string }>>;
}

export interface DeliverableItem {
  id: string;
  titleKey: string;
  category: 'infra' | 'ai' | 'billing' | 'security' | 'governance';
  icon: React.ElementType;
}
