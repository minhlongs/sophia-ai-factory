/**
 * @sophia/raas-sdk — Usage resource.
 * Wraps /api/v1/org/:orgId/usage for MCU balance and transaction history.
 */

import type { HttpClient } from './http-client.js';
import type { UsageBalance } from './types.js';

export class Usage {
  constructor(
    private readonly http: HttpClient,
    private readonly orgId: string,
  ) {}

  /**
   * Get current MCU balance, reserved amount, lifetime stats, and recent transactions.
   */
  async getBalance(): Promise<UsageBalance> {
    return this.http.get<UsageBalance>(`/api/v1/org/${this.orgId}/usage`);
  }
}
