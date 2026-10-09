/**
 * Reseller Hierarchy & Organization Types
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/hierarchy-types
 */

import type { PartnerTier, PartnerStatus } from './core-types';

export type PartnerOrganizationType =
  | 'master_agency'
  | 'sub_agency'
  | 'standard_partner'
  | 'enterprise_reseller';

export type SubResellerStatus = 'active' | 'suspended' | 'terminated' | 'paused';

/**
 * Database Entity: Partner Organization
 */
export interface PartnerOrganization {
  id: string;
  partner_id: string;
  tenant_id: string;
  name: string;
  slug: string | null;
  organization_type: PartnerOrganizationType;
  tier: PartnerTier;
  cascade_override_pct: number;
  billing_email: string;
  custom_domain: string | null;
  whitelabel_config_json: string;
  status: 'active' | 'suspended' | 'pending' | 'pending_approval';
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Sub-Reseller Hierarchy Link
 */
export interface PartnerSubReseller {
  id: string;
  master_partner_id: string;
  sub_partner_id: string;
  agreement_ref: string | null;
  override_rate_pct: number;
  lifetime_override_cents: number;
  pending_override_cents: number;
  status: SubResellerStatus;
  joined_at: number;
  updated_at: number;
}

export interface CascadeOverrideResult {
  hasMaster: boolean;
  masterPartnerId: string | null;
  overrideCents: number;
  overrideRatePct: number;
  subPartnerCommissionCents: number;
  subPartnerRatePct: number;
  platformNetCents: number;
}

export interface BindSubResellerInput {
  masterPartnerId: string;
  subPartnerId: string;
  agreementRef?: string | null;
}

export interface BindSubResellerResult {
  success: boolean;
  binding?: PartnerSubReseller;
  error?: string;
}

export interface ResellerHierarchyNode {
  id: string;
  subPartnerId: string;
  partnerName: string;
  tier: PartnerTier;
  status: SubResellerStatus;
  totalMrrCents: number;
  overrideRatePct: number;
  lifetimeOverrideCents: number;
  pendingOverrideCents: number;
  joinedAt: number;
}

export interface ResellerHierarchyTreeResult {
  masterPartnerId: string;
  masterPartnerName: string;
  masterTier: PartnerTier;
  masterStatus: PartnerStatus;
  totalSubAgencies: number;
  activeSubAgencies: number;
  totalSubMrrCents: number;
  totalLifetimeOverrideCents: number;
  totalPendingOverrideCents: number;
  subAgencies: ResellerHierarchyNode[];
}

export interface AccrueCascadeOverrideResult {
  success: boolean;
  overrideCents: number;
  masterPartnerId: string | null;
  escrowed: boolean;
  reason?: string;
  error?: string;
}
