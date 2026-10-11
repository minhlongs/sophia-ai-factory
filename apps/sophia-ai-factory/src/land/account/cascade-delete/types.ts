export interface DeleteTable {
  table: string;
  column: 'org_id' | 'user_id' | 'tenant_id' | 'creator_id';
}

export const ACCOUNT_DELETE_ORDER: readonly DeleteTable[] = [
  { table: 'audit_log',            column: 'tenant_id' },
  { table: 'publishing_results',   column: 'tenant_id' },
  { table: 'publishing_jobs',      column: 'tenant_id' },
  { table: 'publishing_channels',  column: 'tenant_id' },
  { table: 'payout_batches',       column: 'tenant_id' },
  { table: 'commission_ledger',    column: 'tenant_id' },
  { table: 'conversion_events',    column: 'tenant_id' },
  { table: 'affiliate_links',      column: 'tenant_id' },
  { table: 'org_members',          column: 'org_id'    },
  { table: 'subscriptions',        column: 'org_id'    },
  { table: 'org_balances',         column: 'org_id'    },
  { table: 'transactions',         column: 'org_id'    },
  { table: 'missions',             column: 'org_id'    },
  { table: 'creative_missions',    column: 'creator_id'},
  { table: 'media_jobs',           column: 'user_id'   },
  { table: 'referral_codes',       column: 'org_id'    },
  { table: 'raas_api_keys',        column: 'org_id'    },
  { table: 'raas_api_usage',       column: 'org_id'    },
  { table: 'usage_logs',           column: 'org_id'    },
  { table: 'user_api_keys',        column: 'user_id'   },
  { table: 'raas_user_api_keys',   column: 'user_id'   },
  { table: 'videos',               column: 'user_id'   },
  { table: 'sessions',             column: 'tenant_id' },
  { table: 'users',                column: 'tenant_id' },
] as const;

export interface CascadeDeleteResult {
  totalDeleted: number;
  byTable: Record<string, number>;
  r2Deleted: number;
  r2Failed?: string[];
}

export interface R2DeleteSummary {
  deleted: number;
  failedKeys: string[];
}
