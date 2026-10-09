/**
 * Edge GPU Workload Balancer
 *
 * Thin Root Facade over src/tree/gpu/balancer/
 * 100% backward compatible with existing consumers.
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/workload-balancer
 */

export * from './balancer';
