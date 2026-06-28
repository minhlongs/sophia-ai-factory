/**
 * Query parameter type for Usage Export Service
 * @module usage-export/export-service-params
 */

import type { BillingPeriod } from './types'

export interface GetUsageExportParams {
  billingPeriod: BillingPeriod;
  externalCustomerId?: string | null;
  startDate?: number | null;
  endDate?: number | null;
  service?: string | null;
  licenseNonce?: string | null;
  page?: number;
  pageSize?: number;
}
