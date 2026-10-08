/**
 * @file triad-cockpit-view.tsx
 * @description Master Cockpit View unifying Live Streamer, Newsjacking, DM Funnel & Expansion Accelerators
 * @layer presentation
 */

'use client';

import React from 'react';
import { LiveStreamCard } from './live-stream-card';
import { NewsjackingCard } from './newsjacking-card';
import { DmFunnelCard } from './dm-funnel-card';
import { SurgeFlashSaleCard } from './surge-flash-sale-card';
import { CompetitorProspectingCard } from './competitor-prospecting-card';
import { SplitTestAttributionCard } from './split-test-attribution-card';

export const TriadCockpitView: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Live Commerce, Newsjacking & DM Closer Suite
        </h1>
        <p className="text-sm text-muted-foreground">
          Hệ sinh thái tăng trưởng toàn diện: Live Stream RTMP, Săn Trend Newsjack, Phễu Chat Chốt Sale &amp; Tối Ưu Hóa A/B Testing.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Trụ Cột Cốt Lõi (Core Triad)
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <LiveStreamCard />
          <NewsjackingCard />
          <DmFunnelCard />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Động Cơ Tăng Tốc Nâng Cao (Expansion Engines)
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SurgeFlashSaleCard />
          <CompetitorProspectingCard />
          <SplitTestAttributionCard />
        </div>
      </div>
    </div>
  );
};
