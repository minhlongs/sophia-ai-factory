/**
 * @sophia/raas-sdk — SophiaClient entry point.
 * Composes HttpClient + resource classes into a single API surface.
 */

import { HttpClient } from './http-client.js';
import { Missions } from './missions.js';
import { MissionStream } from './stream.js';
import type { MissionStreamOptions } from './stream.js';
import type { SophiaClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';

export class SophiaClient {
  /** Access all mission operations: create, get, list, cancel, waitForResult */
  readonly missions: Missions;

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
  }

  /**
   * Open an SSE stream for a mission to receive real-time status/step/result events.
   * Call `.connect()` on the returned MissionStream to begin receiving events.
   */
  stream(missionId: string, opts?: MissionStreamOptions): MissionStream {
    return new MissionStream(this.baseUrl, this.apiKey, missionId, opts);
  }
}
