/**
 * @sophia/raas-sdk — SophiaClient entry point.
 * Composes HttpClient + resource classes into a single API surface.
 */

import { HttpClient } from './http-client.js';
import { Missions } from './missions.js';
import type { SophiaClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://sophia-ai-factory.vercel.app';

export class SophiaClient {
  /** Access all mission operations: create, get, list, cancel, waitForResult */
  readonly missions: Missions;

  constructor(config: SophiaClientConfig) {
    if (!config.apiKey) {
      throw new Error('SophiaClient: apiKey is required');
    }
    const http = new HttpClient(
      config.baseUrl ?? DEFAULT_BASE_URL,
      config.apiKey,
    );
    this.missions = new Missions(http);
  }
}
