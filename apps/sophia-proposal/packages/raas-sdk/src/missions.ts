/**
 * @sophia/raas-sdk — Missions resource.
 * Wraps all /api/v1/missions endpoints.
 */

import type { HttpClient } from './http-client.js';
import type {
  Mission,
  CreateMissionRequest,
  CreateMissionResponse,
  ListMissionsResponse,
  MissionResultResponse,
  MissionPendingResponse,
  CancelMissionResponse,
  WaitForResultOptions,
} from './types.js';

const BASE = '/api/v1/missions';
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export class Missions {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create and queue a new mission.
   * Requires missions:create permission on the API key.
   * Returns mission_id, initial status, and mcu_cost.
   */
  async create(req: CreateMissionRequest): Promise<CreateMissionResponse> {
    return this.http.post<CreateMissionResponse>(BASE, req);
  }

  /**
   * Fetch full mission details including execution_log and plan.
   */
  async get(id: string): Promise<Mission> {
    const res = await this.http.get<{ mission: Mission }>(`${BASE}/${id}`);
    return res.mission;
  }

  /**
   * List missions for the authenticated org.
   * @param status  Optional filter: 'queued' | 'executing' | 'completed' | ...
   * @param limit   Max results (server cap: 50). Default: 20.
   */
  async list(params?: { status?: string; limit?: number }): Promise<Mission[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const path = qs.toString() ? `${BASE}?${qs}` : BASE;
    const res = await this.http.get<ListMissionsResponse>(path);
    return res.missions;
  }

  /**
   * Cancel a queued or planning mission and refund reserved MCU.
   * Throws RaasHttpError(409) if mission is already executing/completed.
   */
  async cancel(id: string): Promise<CancelMissionResponse> {
    return this.http.post<CancelMissionResponse>(`${BASE}/${id}/cancel`);
  }

  /**
   * Poll /result endpoint until mission reaches completed or failed status.
   *
   * - Returns MissionResultResponse when done (HTTP 200).
   * - Throws Error('timeout') if timeoutMs is exceeded.
   * - Server returns HTTP 202 with Retry-After while pending; SDK ignores
   *   Retry-After and uses pollIntervalMs instead for predictable behaviour.
   */
  async waitForResult(
    id: string,
    opts: WaitForResultOptions = {},
  ): Promise<MissionResultResponse> {
    const pollInterval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const res = await this.http.get<
        MissionResultResponse | MissionPendingResponse
      >(`${BASE}/${id}/result`);

      // HTTP 200 → mission terminal (completed or failed)
      if (res.status === 'completed' || res.status === 'failed') {
        return res as MissionResultResponse;
      }

      // Still pending — wait before next poll
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.min(pollInterval, remaining)),
      );
    }

    throw new Error(
      `waitForResult timed out after ${timeout}ms for mission ${id}`,
    );
  }
}
