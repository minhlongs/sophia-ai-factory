'use client';

import { StitchWave2RouteBanner } from '@/components/stitch/screens/control-deck/stitch-wave2-route-banner';
import { PublishQueueClient } from './PublishQueueClient';

export default function PublishQueuePage() {
  return (
    <div className="space-y-6">
      <StitchWave2RouteBanner routeKey="publish-queue" defaultShowCanvas={true} />
      <PublishQueueClient />
    </div>
  );
}