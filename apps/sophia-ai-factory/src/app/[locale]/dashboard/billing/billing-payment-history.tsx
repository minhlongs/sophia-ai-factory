'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/seed/components/ui/table';
import Link from 'next/link';
import { fetchJson } from '@/seed/utils/fetch-json';
import { useTranslations } from 'next-intl';

const STATUS_LABELS: Record<string, { variant: 'default' | 'secondary' | 'outline'; labelKey: string }> = {
  paid: { variant: 'default', labelKey: 'paid' },
  pending: { variant: 'secondary', labelKey: 'pending' },
  refunded: { variant: 'outline', labelKey: 'refunded' },
};

type PaymentRow = { id: string; date: string; label: string; amountCents: number; status: string };

async function fetchPaymentHistory(): Promise<{ rows: PaymentRow[] }> {
  return fetchJson('/api/billing/payment-history');
}

export function BillingPaymentHistory() {
  const t = useTranslations('dashboard.billing.paymentHistory');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/billing/payment-history'],
    queryFn: fetchPaymentHistory,
    retry: 2,
  });

  const rows: PaymentRow[] = data?.rows ?? [];

  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t('loading')}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t('empty')}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const cfg = STATUS_LABELS[row.status] ?? STATUS_LABELS.pending;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{t(cfg.labelKey)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(row.amountCents)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/billing/invoices">{t('viewAll')}</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
