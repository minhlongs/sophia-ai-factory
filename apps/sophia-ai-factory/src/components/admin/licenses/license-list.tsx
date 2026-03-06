'use client';

/**
 * License List Component
 * Table hiển thị danh sách license keys với search, filter, pagination
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Key, Search, Filter, MoreHorizontal, Eye, Ban, RefreshCw, RotateCcw, CheckCircle } from 'lucide-react';
import { LicenseRegenerateDialog } from './license-regenerate-dialog';
import { LicenseRevokeDialog } from './license-revoke-dialog';
import type { LicenseSummary } from '@/lib/raas-schema';

interface License {
  id: string;
  tier: string;
  createdAt: number;
  expiresAt: number;
  isRevoked: boolean;
  revokedAt?: number;
  validateCount: number;
  customerEmail?: string;
}

interface LicenseListProps {
  onRevoke?: (id: string, reason?: string) => void;
  onView?: (id: string) => void;
  onRegenerate?: (data: { oldLicenseId: string; newKey: string }) => void;
}

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  premium: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enterprise: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  master: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  revoked: 'bg-red-500/10 text-red-400 border-red-500/30',
  expired: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

export function LicenseList({ onRevoke, onView, onRegenerate }: LicenseListProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | undefined>();
  const limit = 20;

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(tierFilter !== 'all' && { tier: tierFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
      });

      const response = await fetch(`/api/admin/licenses?${params}`);
      const data = await response.json();

      if (response.ok) {
        // Extract customerEmail from metadata for each license
        const licensesWithEmail = data.licenses.map((lic: LicenseSummary) => ({
          ...lic,
          customerEmail: (lic.metadata as { customer_email?: string })?.customer_email,
        }));
        setLicenses(licensesWithEmail);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [page, tierFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLicenses();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getStatus = (license: License): string => {
    if (license.isRevoked) return 'revoked';
    if (license.expiresAt !== 0 && license.expiresAt < Math.floor(Date.now() / 1000)) {
      return 'expired';
    }
    return 'active';
  };

  const handleRevoke = async (id: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/licenses/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        await fetchLicenses();
        onRevoke?.(id, reason);
        setRevokeDialogOpen(false);
      } else {
        const data = await response.json();
        alert(`Failed to revoke: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to revoke license:', error);
    }
  };

  const handleRegenerateClick = (id: string) => {
    setSelectedLicenseId(id);
    setRegenerateDialogOpen(true);
  };

  const handleRegenerateComplete = (data: { oldLicenseId: string; newKey: string }) => {
    setRegenerateDialogOpen(false);
    setSelectedLicenseId(undefined);
    fetchLicenses();
    onRegenerate?.(data);
  };

  const handleReactivate = async (id: string) => {
    if (!confirm(`Are you sure you want to reactivate license ${id}?`)) return;

    try {
      const response = await fetch(`/api/admin/licenses/${id}/reactivate`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchLicenses();
      } else {
        const data = await response.json();
        alert(`Failed to reactivate: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reactivate license:', error);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Key className="w-5 h-5 text-[var(--neon-cyan)]" />
          License Keys ({total})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted border-border text-foreground"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[150px] bg-muted border-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="master">Master</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-muted border-border">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchLicenses}
            className="border-border hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Table */}
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
                licenses.map((license) => {
                  const status = getStatus(license);
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
                        {new Date(license.createdAt * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {license.expiresAt === 0
                          ? 'Perpetual'
                          : new Date(license.expiresAt * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {license.validateCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-muted">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView?.(license.id)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRegenerateClick(license.id)}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Regenerate
                            </DropdownMenuItem>
                            {license.isRevoked ? (
                              <DropdownMenuItem
                                onClick={() => handleReactivate(license.id)}
                                className="text-green-400"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLicenseId(license.id);
                                  setRevokeDialogOpen(true);
                                }}
                                className="text-red-400"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Regenerate Dialog */}
        {regenerateDialogOpen && selectedLicenseId && (
          <LicenseRegenerateDialog
            licenseId={selectedLicenseId}
            onRegenerate={handleRegenerateComplete}
          />
        )}

        {/* Revoke Dialog */}
        {revokeDialogOpen && selectedLicenseId && (
          <LicenseRevokeDialog
            licenseId={selectedLicenseId}
            onRevoke={handleRevoke}
            onClose={() => {
              setRevokeDialogOpen(false);
              setSelectedLicenseId(undefined);
            }}
          />
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-border"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="border-border"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
