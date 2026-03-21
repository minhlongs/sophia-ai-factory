/**
 * HubSpot CRM Types
 *
 * Type definitions for HubSpot API integration
 */

// OAuth2 Token Response
export interface HubSpotToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

// Contact Properties
export interface HubSpotContact {
  id: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    website?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// Deal Properties
export interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string;
    amount?: string;
    dealstage: string;
    pipeline: string;
    closedate?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// Company Properties
export interface HubSpotCompany {
  id: string;
  properties: {
    name: string;
    domain?: string;
    industry?: string;
    annualrevenue?: string;
    numberofemployees?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// API Request/Response
export interface HubSpotApiRequest {
  properties: Record<string, string>;
  associations?: Array<{
    to: { id: string };
    types: Array<{
      associationCategory: string;
      associationTypeId: number;
    }>;
  }>;
}

export interface HubSpotApiResponse<T> {
  results: T[];
  paging?: {
    next: {
      after: string;
      link: string;
    };
  };
}

// Sync Status
export interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  error?: string;
  contactsSynced: number;
  dealsSynced: number;
  companiesSynced: number;
}

// CRM Configuration
export interface CrmConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// ============================================================
// Database row types (mirror crm_settings, contacts, deals,
// crm_sync_status tables from migration 007)
// ============================================================

export interface CrmSettings {
  org_id: string;
  hubspot_access_token: string | null;
  hubspot_refresh_token: string | null;
  hubspot_token_expires_at: string | null;  // ISO timestamp
  hubspot_portal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  external_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  external_data: Record<string, unknown>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  org_id: string;
  external_id: string;
  name: string | null;
  amount: number | null;
  stage: string | null;
  pipeline: string | null;
  close_date: string | null;  // ISO date (YYYY-MM-DD)
  proposal_id: string | null;
  source: string;
  external_data: Record<string, unknown>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CrmSyncStatus {
  org_id: string;
  last_sync: string | null;  // ISO timestamp
  status: 'idle' | 'syncing' | 'completed' | 'error';
  error_message: string | null;
  contacts_synced: number;
  deals_synced: number;
  companies_synced: number;
}
