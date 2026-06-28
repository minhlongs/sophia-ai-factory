/**
 * Fulfillment layer — tree wrapper for cross-layer access.
 *
 * Tree code imports from '@/tree/fulfillment' instead of '@/land/fulfillment'.
 * Re-exports from land/fulfillment (canonical implementation).
 */
export { triggerOneTimeFulfillment } from '@/land/fulfillment/one-time-fulfillment';
