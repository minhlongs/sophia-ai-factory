/**
 * @file enums.ts
 * @description Region, hardware, resolution, codec, status, and breach enums and types.
 * @layer seed
 */

export type GpuComputeRegion =
  | 'apac-tokyo'
  | 'apac-singapore'
  | 'apac-vietnam'
  | 'us-east-iad'
  | 'us-west-sfo'
  | 'eu-west-fra'
  | 'eu-central-ams';

export const ALL_GPU_COMPUTE_REGIONS: readonly GpuComputeRegion[] = [
  'apac-tokyo',
  'apac-singapore',
  'apac-vietnam',
  'us-east-iad',
  'us-west-sfo',
  'eu-west-fra',
  'eu-central-ams',
] as const;

export function isGpuComputeRegion(value: unknown): value is GpuComputeRegion {
  return typeof value === 'string' && ALL_GPU_COMPUTE_REGIONS.includes(value as GpuComputeRegion);
}

export type GpuProvider = 'cloud' | 'bare_metal' | 'edge_mesh' | 'hybrid';

export const ALL_GPU_PROVIDERS: readonly GpuProvider[] = [
  'cloud',
  'bare_metal',
  'edge_mesh',
  'hybrid',
] as const;

export type GpuModel = 'H100' | 'A100' | 'L40S' | 'RTX4090';

export const ALL_GPU_MODELS: readonly GpuModel[] = [
  'H100',
  'A100',
  'L40S',
  'RTX4090',
] as const;

export function isGpuModel(value: unknown): value is GpuModel {
  return typeof value === 'string' && ALL_GPU_MODELS.includes(value as GpuModel);
}

export type GpuNodeStatus = 'online' | 'busy' | 'degraded' | 'draining' | 'offline';

export const ALL_GPU_NODE_STATUSES: readonly GpuNodeStatus[] = [
  'online',
  'busy',
  'degraded',
  'draining',
  'offline',
] as const;

export type VideoResolution = '720p' | '1080p' | '4K' | '8K';

export const ALL_VIDEO_RESOLUTIONS: readonly VideoResolution[] = [
  '720p',
  '1080p',
  '4K',
  '8K',
] as const;

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'prores';

export const ALL_VIDEO_CODECS: readonly VideoCodec[] = [
  'h264',
  'hevc',
  'av1',
  'prores',
] as const;

export type DispatchStatus =
  | 'pending'
  | 'dispatched'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'rerouted';

export const ALL_DISPATCH_STATUSES: readonly DispatchStatus[] = [
  'pending',
  'dispatched',
  'rendering',
  'completed',
  'failed',
  'rerouted',
] as const;

export type SixNinesBreachTier =
  | 'none'
  | 'minor'
  | 'moderate'
  | 'major'
  | 'catastrophic';

export const ALL_BREACH_TIERS: readonly SixNinesBreachTier[] = [
  'none',
  'minor',
  'moderate',
  'major',
  'catastrophic',
] as const;

export type EscrowStatus =
  | 'locked'
  | 'partially_disbursed'
  | 'fully_disbursed'
  | 'released_to_revenue';

export const ALL_ESCROW_STATUSES: readonly EscrowStatus[] = [
  'locked',
  'partially_disbursed',
  'fully_disbursed',
  'released_to_revenue',
] as const;
