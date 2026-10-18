/**
 * White-Label Manager Types and Constants.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/types
 */

import type {
  CustomDomainRecord,
  CustomDomainError,
  DomainVerificationResult,
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from '@/seed/types/custom-domains';
import type { Result } from '@/seed/types/result';

export {
  PRESET_SWATCHES,
  type ColorSwatch,
  type SidePreviewLabels,
  type FullPreviewLabels,
  type BrandingFormLabels,
} from './label-types';

export type WhiteLabelTab = 'domains' | 'branding' | 'preview';

export interface WhiteLabelManagerActions {
  registerCustomDomain?: (
    orgId: string,
    rawHostname: string,
  ) => Promise<Result<CustomDomainRecord, CustomDomainError>>;
  verifyCustomDomainStatus?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<DomainVerificationResult, CustomDomainError>>;
  deleteCustomDomain?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<{ success: boolean; domainId: string }, CustomDomainError>>;
  saveWhiteLabelBrandingSettings?: (
    orgId: string,
    input: SaveWhiteLabelBrandingInput,
  ) => Promise<Result<WhiteLabelBrandingSettings, WhiteLabelActionError>>;
}

export interface WhiteLabelManagerProps {
  orgId: string;
  initialDomains?: CustomDomainRecord[];
  initialBranding?: Partial<WhiteLabelBrandingSettings> | null;
  actions?: WhiteLabelManagerActions;
}

export interface HeaderTabLabels {
  title: string;
  subtitle: string;
  domains: string;
  branding: string;
  preview: string;
}

export interface DomainsTabLabels {
  add: {
    addButton: string;
    description: string;
    inputPlaceholder: string;
    adding: string;
  };
  list: {
    title: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  status: Record<
    'active' | 'pendingValidation' | 'pendingDeployment' | 'error' | 'verified' | 'pending',
    string
  >;
  actions: Record<'verifying' | 'verify' | 'deleting' | 'delete', string>;
  dnsInstructions: Record<'title' | 'cnameHost' | 'cnameTarget', string>;
}
