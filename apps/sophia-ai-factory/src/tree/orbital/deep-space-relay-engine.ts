/**
 * @file deep-space-relay-engine.ts
 * @layer tree/orbital
 * @description Pure domain engine for Orbital Deep-Space Laser Relay, relativistic delay compensation, and Doppler frequency tracking.
 */

import {
  OrbitalRelayNode,
  ConstellationOrbit,
  OpticalTransmissionRequest,
  OpticalTransmissionResult,
} from '@/seed/types/exaflop-matrix';

const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

/**
 * Calculates relativistic propagation delay with velocity dilation
 */
export function calculateRelativisticDelay(
  distanceKm: number,
  relativeVelocityMPerS: number
): { rawDelayMs: number; compensatedDelayMs: number } {
  const distanceMeters = distanceKm * 1000;
  const rawDelaySeconds = distanceMeters / SPEED_OF_LIGHT_M_PER_S;
  const rawDelayMs = Number((rawDelaySeconds * 1000).toFixed(4));

  // First-order relativistic correction: t' = t * (1 + v / c)
  const relativisticFactor = 1 + relativeVelocityMPerS / SPEED_OF_LIGHT_M_PER_S;
  const compensatedDelayMs = Number((rawDelayMs * relativisticFactor).toFixed(4));

  return { rawDelayMs, compensatedDelayMs };
}

/**
 * Calculates optical Doppler frequency shift: Delta f = f0 * (v / c)
 */
export function calculateDopplerShift(
  carrierFrequencyHz: number,
  relativeVelocityMPerS: number
): number {
  const shiftHz = carrierFrequencyHz * (relativeVelocityMPerS / SPEED_OF_LIGHT_M_PER_S);
  return Number(shiftHz.toFixed(2));
}

/**
 * Routes an optical laser transmission through an orbital relay node
 */
export function routeOrbitalTransmission(
  node: OrbitalRelayNode,
  request: OpticalTransmissionRequest
): OpticalTransmissionResult {
  if (node.nodeHealthStatus !== 'ALIGNED') {
    return {
      transmissionId: `FAIL_${Date.now()}`,
      rawPropagationDelayMs: 0,
      relativisticDelayCompensationMs: 0,
      effectiveTransmissionDurationMs: 0,
      dopplerShiftHz: 0,
      isLinkViable: false,
      requiredBufferStorageTb: 0,
    };
  }

  const { rawDelayMs, compensatedDelayMs } = calculateRelativisticDelay(
    request.distanceKm,
    request.relativeVelocityMPerS
  );

  const dopplerShiftHz = calculateDopplerShift(
    request.baseCarrierFrequencyHz,
    request.relativeVelocityMPerS
  );

  // Link capacity check: payload transfer time = (payload bits) / (capacity bps)
  const payloadBits = request.payloadSizeBytes * 8;
  const capacityBps = node.laserLinkCapacityGbps * 1e9;
  const transferTimeSeconds = payloadBits / capacityBps;
  const transferTimeMs = transferTimeSeconds * 1000;

  const effectiveDurationMs = Number((compensatedDelayMs + transferTimeMs).toFixed(4));

  // Required buffer storage in TB
  const requiredBufferStorageTb = Number((request.payloadSizeBytes / 1e12).toFixed(6));
  const isLinkViable = requiredBufferStorageTb <= node.bufferStorageTb;

  return {
    transmissionId: `OPTICAL_TX_${node.satelliteDesignation}_${Date.now()}`,
    rawPropagationDelayMs: rawDelayMs,
    relativisticDelayCompensationMs: compensatedDelayMs,
    effectiveTransmissionDurationMs: effectiveDurationMs,
    dopplerShiftHz,
    isLinkViable,
    requiredBufferStorageTb,
  };
}

/**
 * Validates constellation orbital altitude characteristics
 */
export function getOrbitBaselineLatencyMs(orbit: ConstellationOrbit): number {
  switch (orbit) {
    case 'LEO_SUN_SYNCHRONOUS':
      return 3.5; // ~500 km
    case 'MEO_EQUATORIAL':
      return 65.0; // ~10,000 km
    case 'GEO_STATIONARY':
      return 120.0; // ~35,786 km
    case 'EARTH_MOON_L2':
      return 1300.0; // ~400,000 km
    default:
      return 10.0;
  }
}
