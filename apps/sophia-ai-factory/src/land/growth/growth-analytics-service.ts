/**
 * Real-Time Growth Analytics Service Facade
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Backward-compatible facade re-exporting modular submodules from `./analytics-service/`.
 * All submodules strictly adhere to < 200 LOC.
 *
 * @module land/growth/growth-analytics-service
 */

export * from './analytics-service/index';
