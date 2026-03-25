/**
 * @sophia/raas-sdk — SophiaClient entry point.
 * Composes HttpClient + resource classes into a single API surface.
 */

import { HttpClient } from './http-client.js';
import { Missions } from './missions.js';
import { Usage } from './usage.js';
import { ApiKeys } from './api-keys.js';
import { Webhooks } from './webhooks.js';
import { MissionStream } from './stream.js';
import type { MissionStreamOptions } from './stream.js';
import type { SophiaClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';

export class SophiaClient {
  /** Mission operations: create, get, list, cancel, waitForResult, createBatch */
  readonly missions: Missions;

  /** MCU balance and transaction history (requires orgId in config) */
  readonly usage: Usage | null;

  /** API key management (requires orgId in config) */
  readonly apiKeys: ApiKeys | null;

  /** Webhook endpoint management (requires orgId in config) */
  readonly webhooks: Webhooks | null;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: SophiaClientConfig) {
    if (!config.apiKey) {
      throw new Error('SophiaClient: apiKey is required');
    }
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    const http = new HttpClient(this.baseUrl, this.apiKey);

    this.missions = new Missions(http);

    // Org-scoped resources require orgId
    if (config.orgId) {
      this.usage = new Usage(http, config.orgId);
      this.apiKeys = new ApiKeys(http, config.orgId);
      this.webhooks = new Webhooks(http, config.orgId);
    } else {
      this.usage = null;
      this.apiKeys = null;
      this.webhooks = null;
    }
  }

  /**
   * Open an SSE stream for a mission to receive real-time status/step/result events.
   * Call `.connect()` on the returned MissionStream to begin receiving events.
   */
  stream(missionId: string, opts?: MissionStreamOptions): MissionStream {
    return new MissionStream(this.baseUrl, this.apiKey, missionId, opts);
  }
}
