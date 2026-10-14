/**
 * Deal Models, Payloads & Conflict Resolution Types
 * Layer: tree/integrations
 */

export type SophiaDealStage =
  | 'new_lead'
  | 'enriching'
  | 'qualified'
  | 'demo_prepared'
  | 'demo_active'
  | 'proposal_sent'
  | 'negotiating'
  | 'closed_won'
  | 'closed_lost';

export interface SophiaDealSnapshot {
  id: string;
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string | null;
  companyName: string;
  companyDomain: string;
  dealStage: SophiaDealStage;
  dealValueEstimateCents: number;
  currency: string;
  closeDate?: string | null; // YYYY-MM-DD
  notes?: string | null;
  sdrNotes?: string | null;
  updatedAt?: number;
}

export interface SalesforceOpportunityPayload {
  Sophia_Deal_Id__c?: string;
  Id?: string;
  Name: string;
  StageName: string;
  Amount?: number;
  CurrencyIsoCode?: string;
  CloseDate?: string;
  Description?: string;
  Contact_Email__c?: string;
  Contact_Phone__c?: string;
  Account_Domain__c?: string;
  LastModifiedDate?: string;
  [key: string]: unknown;
}

export interface HubSpotDealPayload {
  sophia_deal_id?: string;
  hs_object_id?: string;
  dealname: string;
  dealstage: string;
  amount?: string | number;
  deal_currency_code?: string;
  closedate?: string | number;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  company_domain?: string;
  hs_lastmodifieddate?: string | number;
  [key: string]: unknown;
}

export type ConflictResolutionAction = 'apply' | 'ignore';

export interface ConflictResolutionOptions {
  hasSignedContract?: boolean;
  incomingTimestamp?: number;
  existingTimestamp?: number;
}

export interface ConflictResolutionResult {
  action: ConflictResolutionAction;
  reason: string;
  resolvedDeal: SophiaDealSnapshot;
  appliedFields: string[];
  ignoredFields: string[];
}
