import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { YieldRouterCockpit } from '../yield-router-cockpit';
import { GhostMatrixCockpit } from '../ghost-matrix-cockpit';
import { CultureInjectorCockpit } from '../culture-injector-cockpit';

describe('Growth Triad v9 UI Cockpits', () => {
  describe('YieldRouterCockpit', () => {
    it('renders empty state correctly', () => {
      render(<YieldRouterCockpit routes={[]} />);
      expect(screen.getByText('Yield Routing Topology')).toBeDefined();
      expect(screen.getByText('No routing data available.')).toBeDefined();
    });

    it('renders with route data', () => {
      const mockRoutes = [
        { id: 'r1', name: 'Alpha Proxy', latency: 45, cost: 0.0012, status: 'active' as const },
        { id: 'r2', name: 'Beta Relay', latency: 120, cost: 0.0008, status: 'degraded' as const }
      ];

      render(<YieldRouterCockpit routes={mockRoutes} activeRouteId="r1" />);
      expect(screen.getByText('Alpha Proxy')).toBeDefined();
      expect(screen.getByText('Beta Relay')).toBeDefined();
      expect(screen.getByText('45ms')).toBeDefined();
      expect(screen.getByText('$0.0012')).toBeDefined();
    });
  });

  describe('GhostMatrixCockpit', () => {
    it('renders empty state correctly', () => {
      render(<GhostMatrixCockpit nodes={[]} />);
      expect(screen.getByText('Ghost Matrix Z-Score Analysis')).toBeDefined();
      expect(screen.getByText('No nodes reporting.')).toBeDefined();
    });

    it('renders with node data', () => {
      const mockNodes = [
        { id: 'n1', platform: 'TikTok', accountName: '@trendsetter', zScore: 2.4, shadowbanRisk: 0.85 },
        { id: 'n2', platform: 'IG', accountName: '@lifestyle', zScore: 0.5, shadowbanRisk: 0.15 }
      ];

      render(<GhostMatrixCockpit nodes={mockNodes} />);
      expect(screen.getByText('@trendsetter')).toBeDefined();
      expect(screen.getByText('TikTok')).toBeDefined();
      expect(screen.getByText('+2.40')).toBeDefined();
      expect(screen.getByText('85%')).toBeDefined();
    });
  });

  describe('CultureInjectorCockpit', () => {
    it('renders empty state correctly', () => {
      render(<CultureInjectorCockpit profileName="Urban GenZ" axes={[]} />);
      expect(screen.getByText('Cultural Alignment Index (CAI)')).toBeDefined();
      expect(screen.getByText('Target Profile:')).toBeDefined();
      expect(screen.getByText('Urban GenZ')).toBeDefined();
      expect(screen.getByText('No alignment data available.')).toBeDefined();
    });

    it('renders with alignment data', () => {
      const mockAxes = [
        { label: 'Slang Resonance', value: 88 },
        { label: 'Aesthetic Fit', value: 92 },
        { label: 'Pacing Alignment', value: 74 }
      ];

      render(<CultureInjectorCockpit profileName="Urban GenZ" axes={mockAxes} />);
      expect(screen.getByText('Slang Resonance')).toBeDefined();
      expect(screen.getByText('88%')).toBeDefined();
      expect(screen.getByText('Aesthetic Fit')).toBeDefined();
      expect(screen.getByText('92%')).toBeDefined();
      expect(screen.getByText('Pacing Alignment')).toBeDefined();
      expect(screen.getByText('74%')).toBeDefined();
    });
  });
});
