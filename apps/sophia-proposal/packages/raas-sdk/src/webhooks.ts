/**
 * @sophia/raas-sdk — Webhook management resource.
 * Register, list, and delete webhook endpoints for mission events.
 */

import type { HttpClient } from './http-client.js';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
}

export type WebhookEvent =
  | 'mission.completed'
  | 'mission.failed'
  | 'subscription.activated'
  | 'subscription.cancelled';

export interface RegisterWebhookRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export interface RegisterWebhookResponse {
  webhook: WebhookEndpoint;
  signing_secret: string;
}

export class Webhooks {
  private readonly basePath: string;

  constructor(
    private readonly http: HttpClient,
    orgId: string,
  ) {
    this.basePath = `/api/v1/org/${orgId}/webhooks`;
  }

  async register(req: RegisterWebhookRequest): Promise<RegisterWebhookResponse> {
    return this.http.post<RegisterWebhookResponse>(this.basePath, req);
  }

  async list(): Promise<WebhookEndpoint[]> {
    const res = await this.http.get<{ webhooks: WebhookEndpoint[] }>(this.basePath);
    return res.webhooks;
  }

  async delete(webhookId: string): Promise<{ deleted: boolean }> {
    return this.http.post<{ deleted: boolean }>(`${this.basePath}/${webhookId}/delete`);
  }
}
