/**
 * Invoice History Table
 *
 * Displays payment history with date, description, amount, status.
 * Supports download links for invoices.
 * Bilingual VI+EN via useTranslations.
 *
 * @module app/[locale]/dashboard/billing/invoice-history-table
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/seed/components/ui/table';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { fetchJson } from '@/seed/utils/fetch-json';

// ── Types ─────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  status: 'paid' | 'pending' | 'refunded' | 'failed';
  downloadUrl?: string;
}

interface InvoicesResponse {
  rows: InvoiceRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  pending: 'secondary',
  refunded: 'outline',
  failed: 'destructive',
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// ── Component ─────────────────────────────────────────────────────────────

export function InvoiceHistoryTable() {
  const t = useTranslations('dashboard.billing.invoices');

  const { data, isLoading, error } = useQuery<InvoicesResponse>({
    queryKey: ['/api/billing/invoice-history'],
    queryFn: () => fetchJson<InvoicesResponse>('/api/billing/invoice-history'),
    retry: 2,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{t('loadError')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows: InvoiceRow[] = data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('descriptionCol')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{new Date(row.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{row.description}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatCurrency(row.amountCents)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.status] ?? 'outline'}>
                      {t(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.downloadUrl ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={row.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-1" />
                          {t('download')}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
