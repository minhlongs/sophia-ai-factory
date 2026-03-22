/**
 * @sophia/raas-sdk — ApiKeys resource.
 * Wraps /api/v1/org/:orgId/api-keys for programmatic key management.
 */

import type { HttpClient } from './http-client.js';
import type { CreateApiKeyResponse } from './types.js';

export class ApiKeys {
  constructor(
    private readonly http: HttpClient,
    private readonly orgId: string,
  ) {}

  /**
   * Generate a new API key for the org.
   * The response includes the full key — store it securely, it won't be shown again.
   */
  async create(): Promise<CreateApiKeyResponse> {
    return this.http.post<CreateApiKeyResponse>(
      `/api/v1/org/${this.orgId}/api-keys`,
    );
  }
}
