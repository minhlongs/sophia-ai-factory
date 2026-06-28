/**
 * Barrel re-export for webhook D1 registry modules.
 * Consumers import from here — no need to know internal split.
 * @module lib/webhooks/registry
 */

export {
  listByTenant,
  getById,
  create,
  update,
  remove,
  markSuccess,
  markFailure,
  getActiveEndpointsForEvent,
  MAX_ENDPOINTS_PER_TENANT,
} from './registry-endpoints';
export type { CreateEndpointInput, UpdateEndpointInput } from './registry-endpoints';

export { recordAttempt, listAttempts } from './registry-attempts';
