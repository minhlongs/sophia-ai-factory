import type { ModelProvider } from './types';

/**
 * Base cost per second of render across models (USD)
 */
export const MODEL_BASE_COST_PER_SECOND: Record<ModelProvider, number> = {
  HEYGEN_STUDIO: 0.1,  // $6.00/min - photoreal avatar
  DID_EXPRESS: 0.04,   // $2.40/min - fast digital avatar
  FAL_WAN: 0.015,      // $0.90/min - open-weight diffusion
  DEFERRED_OFFPEAK: 0, // $0.00 while in deferred hold queue
};

/**
 * Off-peak UTC window hours [02:00, 08:00)
 */
export const OFF_PEAK_START_HOUR_UTC = 2;
export const OFF_PEAK_END_HOUR_UTC = 8;

/**
 * Off-peak discount factor (42% discount = 0.58 multiplier)
 */
export const OFF_PEAK_DISCOUNT_PERCENT = 42;
export const OFF_PEAK_COST_MULTIPLIER = 0.58;

/**
 * Determines if a given UTC hour falls within the off-peak compute window [02:00, 08:00)
 */
export function isOffPeakUtcHour(hour: number): boolean {
  if (typeof hour !== 'number' || isNaN(hour)) {
    return false;
  }
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
  return normalizedHour >= OFF_PEAK_START_HOUR_UTC && normalizedHour < OFF_PEAK_END_HOUR_UTC;
}
