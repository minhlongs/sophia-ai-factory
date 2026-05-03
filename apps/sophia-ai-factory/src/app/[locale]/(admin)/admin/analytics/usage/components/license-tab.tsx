'use client';

import { LicenseMetricsTable } from '@/forest/components/analytics/LicenseMetricsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/seed/components/ui/card';
import type { LicenseMetrics } from '@/lib/analytics/types';

interface LicenseTabProps {
  licenseMetrics: LicenseMetrics | null;
  isLoading: boolean;
}

export function LicenseTab({ licenseMetrics, isLoading }: LicenseTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-License Metrics</CardTitle>
        <CardDescription>Usage breakdown by license with quota tracking</CardDescription>
      </CardHeader>
      <CardContent>
        {licenseMetrics?.utilization && licenseMetrics.utilization.length > 0 ? (
          <LicenseMetricsTable licenses={licenseMetrics.utilization} isLoading={isLoading} />
        ) : (
          <div className="text-center text-muted-foreground py-8">No license data available</div>
        )}
      </CardContent>
    </Card>
  );
}
