/**
 * Dedicated GPU Lane Allocator Types & Options
 *
 * Layer: tree/gpu-mesh/allocator
 */

import type { GpuMeshRegion } from '@/seed/types/gpu-mesh';

export interface AllocateLaneOptions {
  requestedMcu?: number;
  nowSeconds?: number;
  targetRegion?: GpuMeshRegion;
}
