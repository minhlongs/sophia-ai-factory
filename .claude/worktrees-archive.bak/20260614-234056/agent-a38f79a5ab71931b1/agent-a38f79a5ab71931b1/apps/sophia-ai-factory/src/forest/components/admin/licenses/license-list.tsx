'use client';

/**
 * License List Component
 * Composition root: table hiển thị danh sách license keys với search, filter, pagination
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/seed/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/seed/components/ui/table';
import { Key } from 'lucide-react';
import { LicenseRegenerateDialog } from './license-regenerate-dialog';
import { LicenseRevokeDialog } from './license-revoke-dialog';
import { LicenseExtendDialog } from './license-extend-dialog';
import { LicenseListFilterBar } from './license-list-filter-bar';
import { LicenseListTableRow } from './license-list-table-row';
import { LicenseListPagination } from './license-list-pagination';
import { useLicenseListActions, LIMIT } from './use-license-list-actions';

interface LicenseListProps {
  onRevoke?: (id: string, reason?: string) => void;
  onView?: (id: string) => void;
  onRegenerate?: (data: { oldLicenseId: string; newKey: string }) => void;
  onExtend?: (id: string, days: number) => void;
}

function getLicenseStatus(license: { isRevoked: boolean; expiresAt: number | null }): string {
  if (license.isRevoked) return 'revoked';
  if (license.expiresAt && license.expiresAt < Math.floor(Date.now() / 1000)) return 'expired';
  return 'active';
}

export function LicenseList({ onRevoke, onView, onRegenerate, onExtend }: LicenseListProps) {
  const {
    licenses, loading, search, tierFilter, statusFilter, page, total,
    selectedLicenseId, regenerateDialogOpen, revokeDialogOpen, extendDialogOpen,
    setSearch, setTierFilter, setStatusFilter, setPage,
    setSelectedLicenseId, setRegenerateDialogOpen, setRevokeDialogOpen, setExtendDialogOpen,
    fetchLicenses, handleRevoke, handleReactivate, handleExtendComplete,
  } = useLicenseListActions({ onRevoke, onExtend });

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Key className="w-5 h-5 text-[var(--neon-cyan)]" aria-hidden="true" />
          License Keys ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LicenseListFilterBar
          search={search}
          tierFilter={tierFilter}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onTierChange={setTierFilter}
          onStatusChange={setStatusFilter}
          onRefresh={fetchLicenses}
        />

        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">ID</TableHead>
                <TableHead className="text-muted-foreground">Customer Email</TableHead>
                <TableHead className="text-muted-foreground">Tier</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-muted-foreground">Expires</TableHead>
                <TableHead className="text-muted-foreground">Validations</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : licenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No licenses found
                  </TableCell>
                </TableRow>
              ) : (
                licenses.map((license) => (
                  <LicenseListTableRow
                    key={license.id}
                    license={license}
                    status={getLicenseStatus(license)}
                    onView={onView}
                    onRegenerateClick={(id) => { setSelectedLicenseId(id); setRegenerateDialogOpen(true); }}
                    onExtendClick={(id) => { setSelectedLicenseId(id); setExtendDialogOpen(true); }}
                    onRevokeClick={(id) => { setSelectedLicenseId(id); setRevokeDialogOpen(true); }}
                    onReactivate={handleReactivate}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {regenerateDialogOpen && selectedLicenseId && (
          <LicenseRegenerateDialog
            licenseId={selectedLicenseId}
            onRegenerate={(data) => {
              setRegenerateDialogOpen(false);
              setSelectedLicenseId(undefined);
              fetchLicenses();
              onRegenerate?.(data);
            }}
          />
        )}

        {revokeDialogOpen && selectedLicenseId && (
          <LicenseRevokeDialog
            licenseId={selectedLicenseId}
            onRevoke={handleRevoke}
            onClose={() => { setRevokeDialogOpen(false); setSelectedLicenseId(undefined); }}
          />
        )}

        {extendDialogOpen && selectedLicenseId && (
          <LicenseExtendDialog
            licenseId={selectedLicenseId}
            onExtend={handleExtendComplete}
            onClose={() => { setExtendDialogOpen(false); setSelectedLicenseId(undefined); }}
          />
        )}

        <LicenseListPagination page={page} limit={LIMIT} total={total} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}
