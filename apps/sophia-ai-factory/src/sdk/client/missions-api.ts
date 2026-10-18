/**
 * Sophia Client SDK Missions API
 *
 * Layer: sdk
 */

import {
  type CreateMissionOptions,
  type ListMissionsOptions,
  type Mission,
  type PaginatedMissions,
  type RequestOptions,
} from './types';
import { type TransportConfig } from './http-transport';
import { streamMissionEvents, parseMissionSseData } from './missions-sse';

export { parseMissionSseData };

export function createMissionsApi(
  config: TransportConfig,
  request: <T>(path: string, options?: RequestInit, ro?: RequestOptions) => Promise<T>,
) {
  return {
    create: async (opts: CreateMissionOptions, ro?: RequestOptions): Promise<Mission> => {
      return request<Mission>('/api/v1/missions', {
        method: 'POST',
        body: JSON.stringify(opts),
      }, ro);
    },

    get: async (id: string, ro?: RequestOptions): Promise<Mission> => {
      return request<Mission>(`/api/v1/missions/${id}`, {}, ro);
    },

    stream: (id: string, ro?: RequestOptions) => streamMissionEvents(config, id, ro),
    streamEvents: (id: string, ro?: RequestOptions) => streamMissionEvents(config, id, ro),

    list: async (opts?: ListMissionsOptions, ro?: RequestOptions): Promise<PaginatedMissions> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set('status', opts.status);
      if (opts?.command) params.set('command', opts.command);
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      const qs = params.toString();
      return request<PaginatedMissions>(`/api/v1/missions${qs ? `?${qs}` : ''}`, {}, ro);
    },
  };
}