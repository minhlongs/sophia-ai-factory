'use client';

/**
 * License Metrics Table Body
 * Renders rows for the LicenseMetricsTable with usage/expiry/overage cells
 */

import { TableBody, TableCell, TableRow } from '@/seed/components/ui/table';
import { Badge } from '@/seed/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { LicenseUtilization } from '@/land/analytics/types';
import { UsageProgress, StatusBadge, formatExpiration } from './license-metrics-cell-renderers';

interface LicenseMetricsTableBodyProps {
  licenses: LicenseUtilization[];
}

export function LicenseMetricsTableBody({ licenses }: LicenseMetricsTableBodyProps) {
  if (licenses.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
            No licenses found
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {licenses.map((license) => (
        <TableRow key={license.licenseNonce}>
          <TableCell className="font-mono text-xs">
            {license.licenseNonce.slice(0, 8)}...{license.licenseNonce.slice(-4)}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs">{license.tier}</Badge>
          </TableCell>
          <TableCell className="text-right font-mono">
            {license.usedCredits.toLocaleString()}
          </TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">
            {license.limitCredit.toLocaleString()}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <UsageProgress percentage={license.percentage} />
              <span className="text-xs font-mono w-10 text-right">
                {license.percentage.toFixed(0)}%
              </span>
            </div>
          </TableCell>
          <TableCell className="text-right text-sm">
            {formatExpiration(license.expiresAt)}
          </TableCell>
          <TableCell className="text-right">
            {license.overageCount ? (
              <div className="flex items-center justify-end gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" aria-hidden="true" />
                <span className="font-mono text-xs">
                  {license.overageCount}{license.billableCount ? ` (${license.billableCount} bl)` : ''}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">-</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            <StatusBadge
              percentage={license.percentage}
              expiresAt={license.expiresAt}
              overageCount={license.overageCount || 0}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}
