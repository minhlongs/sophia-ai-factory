/**
 * Fair-Share GPU Scheduler & Two-Lane Queue Arbitration Service
 *
 * Thin Root Facade over src/tree/queue/scheduler/
 * 100% backward compatible with existing consumers.
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/fair-share-gpu-scheduler
 */

export * from './scheduler';
