'use client';

/**
 * License List Table Row
 * Single row for the license table with tier/status badges and actions dropdown
 */

import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { TableCell, TableRow } from '@/seed/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/seed/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Eye,
  Ban,
  RotateCcw,
  CheckCircle,
  Calendar,
} from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  premium: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enterprise: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  master: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  revoked: 'bg-red-500/10 text-red-400 border-red-500/30',
  expired: 'bg-muted text-muted-foreground border-border',
};

interface LicenseRowData {
  id: string;
  tier: string;
  createdAt: number;
  expiresAt: number | null;
  isRevoked: boolean;
  validateCount: number;
  customerEmail?: string;
}

interface LicenseListTableRowProps {
  license: LicenseRowData;
  status: string;
  onView?: (id: string) => void;
  onRegenerateClick: (id: string) => void;
  onExtendClick: (id: string) => void;
  onRevokeClick: (id: string) => void;
  onReactivate: (id: string) => void;
}

export function LicenseListTableRow({
  license,
  status,
  onView,
  onRegenerateClick,
  onExtendClick,
  onRevokeClick,
  onReactivate,
}: LicenseListTableRowProps) {
  return (
    <TableRow key={license.id} className="border-border">
      <TableCell className="font-mono text-xs text-[var(--neon-cyan)]">
        {license.id.slice(0, 8)}...
      </TableCell>
      <TableCell className="text-sm text-foreground">
        {license.customerEmail || (
          <span className="text-muted-foreground italic">No email</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={TIER_COLORS[license.tier]} variant="outline">
          {license.tier}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={STATUS_COLORS[status]} variant="outline">
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(license.createdAt * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' })}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {!license.expiresAt
          ? 'Perpetual'
          : new Date(license.expiresAt * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' })}
      </TableCell>
      <TableCell className="text-sm text-foreground">
        {license.validateCount}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-muted" aria-label="Open license actions menu">
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView?.(license.id)}>
              <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRegenerateClick(license.id)}>
              <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
              Regenerate
            </DropdownMenuItem>
            {!license.isRevoked && license.tier !== 'master' && (
              <DropdownMenuItem onClick={() => onExtendClick(license.id)}>
                <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
                Extend
              </DropdownMenuItem>
            )}
            {license.isRevoked ? (
              <DropdownMenuItem
                onClick={() => onReactivate(license.id)}
                className="text-green-400"
              >
                <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                Reactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onRevokeClick(license.id)}
                className="text-red-400"
              >
                <Ban className="w-4 h-4 mr-2" aria-hidden="true" />
                Revoke
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
