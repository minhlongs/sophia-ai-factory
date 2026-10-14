/** Billing summary response shape */
export interface BillingSummary {
  /** Monthly Recurring Revenue in cents */
  mrr: number;
  /** MRR currency */
  currency: string;
  /** Dunning state counts */
  dunningStates: {
    current: number;
    past_due: number;
    delinquent: number;
    suspended: number;
  };
  /** Total unbilled overage amount in cents */
  unbilledOverageTotal: number;
  /** Count of active licenses */
  activeLicensesCount: number;
  /** Count of licenses with dunning issues */
  licensesWithIssues: number;
  /** Timestamp of summary generation */
  generatedAt: string;
}

export interface DunningCustomer {
  stripe_customer_id?: string;
  dunning_state?: string;
}

export interface DunningRow {
  dunning_state: string;
}

export interface OverageRow {
  tier_at_exceeded: string;
  exceeded_by: number;
}

export interface MRRResult {
  totalCents: number;
  breakdown: Record<string, number>;
}

export interface MRRCustomerRecord {
  plan?: string;
  status?: string;
  stripe_customer_id?: string;
  dunning_state?: string;
}

export interface BillingSummaryQueryResult {
  mrrData: MRRCustomerRecord[];
  dunningRows: DunningRow[];
  overageRows: OverageRow[];
  activeLicensesCount: number;
  licensesWithIssues: number;
}
