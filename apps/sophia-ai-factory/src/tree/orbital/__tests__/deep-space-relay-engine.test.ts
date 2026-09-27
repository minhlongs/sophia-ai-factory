import { describe, it, expect } from 'vitest';
import {
  calculateRelativisticDelay,
  calculateDopplerShift,
  routeOrbitalTransmission,
  getOrbitBaselineLatencyMs,
} from '../deep-space-relay-engine';
import type {
  OrbitalRelayNode,
  OpticalTransmissionRequest,
} from '@/seed/types/exaflop-matrix';

describe('Deep Space Orbital Relay Engine Unit Tests', () => {
  const activeRelayNode: OrbitalRelayNode = {
    id: 'node_leo_01',
    satelliteDesignation: 'SOPHIA_RELAY_LEO_01',
    constellationOrbit: 'LEO_SUN_SYNCHRONOUS',
    laserLinkCapacityGbps: 1000.0, // 1 Tbps
    relativisticDelayCompensationMs: 4.2,
    bufferStorageTb: 500.0,
    dopplerShiftHz: 0.0,
    nodeHealthStatus: 'ALIGNED',
    lastLaserHandshakeAt: '2026-09-27T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('calculates relativistic propagation delay with velocity dilation', () => {
    // 300,000 meters (300 km) at 7,500 m/s orbital velocity
    const result = calculateRelativisticDelay(300, 7500);
    expect(result.rawDelayMs).toBeCloseTo(1.0007, 3);
    expect(result.compensatedDelayMs).toBeGreaterThanOrEqual(result.rawDelayMs);
  });

  it('calculates optical Doppler frequency shift', () => {
    // 193.1 THz carrier (1550 nm optical laser) at 7,500 m/s
    const shiftHz = calculateDopplerShift(193.1e12, 7500);
    expect(shiftHz).toBeGreaterThan(0);
    expect(Math.abs(shiftHz)).toBeCloseTo(4.83e9, -7);
  });

  it('routes optical laser transmission through aligned node', () => {
    const request: OpticalTransmissionRequest = {
      payloadSizeBytes: 100 * 1024 * 1024, // 100 MB
      originNode: 'GROUND_STATION_SINGAPORE',
      destinationNode: 'ORBITAL_L2_RELAY',
      distanceKm: 2000,
      relativeVelocityMPerS: 7200,
      baseCarrierFrequencyHz: 193.1e12,
    };

    const txResult = routeOrbitalTransmission(activeRelayNode, request);
    expect(txResult.isLinkViable).toBe(true);
    expect(txResult.rawPropagationDelayMs).toBeGreaterThan(0);
    expect(txResult.effectiveTransmissionDurationMs).toBeGreaterThan(0);
    expect(txResult.transmissionId).toContain('SOPHIA_RELAY_LEO_01');
  });

  it('rejects transmissions on unaligned or maintenance nodes', () => {
    const unalignedNode = { ...activeRelayNode, nodeHealthStatus: 'ACQUIRING_LOCK' as const };
    const request: OpticalTransmissionRequest = {
      payloadSizeBytes: 1024,
      originNode: 'A',
      destinationNode: 'B',
      distanceKm: 500,
      relativeVelocityMPerS: 0,
      baseCarrierFrequencyHz: 193.1e12,
    };

    const txResult = routeOrbitalTransmission(unalignedNode, request);
    expect(txResult.isLinkViable).toBe(false);
    expect(txResult.transmissionId).toContain('FAIL');
  });

  it('reports correct orbital baseline latencies', () => {
    expect(getOrbitBaselineLatencyMs('LEO_SUN_SYNCHRONOUS')).toBe(3.5);
    expect(getOrbitBaselineLatencyMs('GEO_STATIONARY')).toBe(120.0);
    expect(getOrbitBaselineLatencyMs('EARTH_MOON_L2')).toBe(1300.0);
  });
});
