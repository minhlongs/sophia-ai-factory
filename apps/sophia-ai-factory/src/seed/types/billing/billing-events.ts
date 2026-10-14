/**
 * Billing Event Row and Insert Types
 *
 * Layer: seed/types/billing
 */

import type { Json } from '../json';

// Billing events ledger (detailed payment/billing lifecycle)
export interface BillingEventRow {
  id: string;
  user_id: string;
  license_nonce: string;
  event_type: string;
  event_category: string;
  event_data: Json;
  amount: number | null;
  currency: string;
  payment_provider: string | null;
  provider_event_id: string | null;
  provider_invoice_id: string | null;
  provider_charge_id: string | null;
  email_sent: boolean;
  email_template: string | null;
  email_recipient: string | null;
  email_sent_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  processed: boolean;
  processed_at: string | null;
}

export interface BillingEventInsert {
  user_id: string;
  license_nonce: string;
  event_type: string;
  event_category: string;
  event_data?: Json;
  amount?: number | null;
  currency?: string;
  payment_provider?: string | null;
  provider_event_id?: string | null;
  provider_invoice_id?: string | null;
  provider_charge_id?: string | null;
  email_sent?: boolean;
  email_template?: string | null;
  email_recipient?: string | null;
  email_sent_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
  processed?: boolean;
  processed_at?: string | null;
}
