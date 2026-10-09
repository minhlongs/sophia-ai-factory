'use client';

/**
 * arbitrage-card.tsx
 * Growth Triad v11: Cross-Platform Virality & Opportunistic Compute Arbitrage Cockpit Component
 *
 * Thin facade delegating to modularized subcomponents in `components/growth/arbitrage/`.
 * Preserves 100% backward compatibility for all consumers and tests.
 *
 * @module components/growth/arbitrage-card
 */

import React from 'react';
import { ArbitrageCardView } from './arbitrage/arbitrage-card-view';
import type { ArbitrageCardProps } from './arbitrage/types';

export * from './arbitrage';

export function ArbitrageCard(props: ArbitrageCardProps) {
  return <ArbitrageCardView {...props} />;
}
