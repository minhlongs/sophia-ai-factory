/**
 * Dedicated Enterprise GPU Lane Allocator & Arbitration Service (Root Facade)
 *
 * Re-exports reservation lookups, capacity validators, lane allocators,
 * and lane release routines.
 *
 * Layer: tree/gpu-mesh
 *
 * @module tree/gpu-mesh/dedicated-lane-allocator
 */

export * from './allocator/index';
