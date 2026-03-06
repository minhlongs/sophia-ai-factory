'use client';

/**
 * Audit Log Table Component
 * Hiển thị audit logs cho license operations
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { FileText, Download, RefreshCw } from 'lucide-react';

interface AuditLog {
  action: string;
  nonce: string;
  tier?: string;
  timestamp: number;
  createdBy?: string;
}

interface AuditLogTableProps {
  licenseId?: string;
}

export function AuditLogTable({ licenseId }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retentionNote, setRetentionNote] = useState<string | undefined>();
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(licenseId && { nonce: licenseId }),
      });

      const response = await fetch(`/api/admin/licenses/audit?${params}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs);
        setTotal(data.total);
        setRetentionNote(data.retentionNote);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, licenseId]);

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'CREATE':
        return 'text-green-400';
      case 'REVOKE':
        return 'text-red-400';
      case 'VALIDATE':
        return 'text-blue-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'License ID', 'Tier', 'Created By'].join(','),
      ...logs.map(log =>
        [
          new Date(log.timestamp * 1000).toISOString(),
          log.action,
          log.nonce,
          log.tier || '',
          log.createdBy || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--neon-cyan)]" />
            Audit Logs
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-border hover:bg-muted"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchLogs}
              className="border-border hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
        {retentionNote && (
          <p className="text-xs text-muted-foreground mt-2">
            ℹ️ {retentionNote} (last 30 days only)
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="mb-4">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px] bg-muted border-border">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="REVOKE">Revoke</SelectItem>
              <SelectItem value="VALIDATE">Validate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Timestamp</TableHead>
                <TableHead className="text-muted-foreground">Action</TableHead>
                <TableHead className="text-muted-foreground">License ID</TableHead>
                <TableHead className="text-muted-foreground">Tier</TableHead>
                <TableHead className="text-muted-foreground">Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={`${log.timestamp}-${log.nonce}`} className="border-border">
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.timestamp * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--neon-cyan)]">
                      {log.nonce.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {log.tier || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.createdBy || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
