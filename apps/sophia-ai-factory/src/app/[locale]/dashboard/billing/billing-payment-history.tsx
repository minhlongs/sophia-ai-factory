'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import type { UsageSummaryResponse } from './billing-page-types';

interface Props {
  data: UsageSummaryResponse;
  formatCurrency: (cents: number) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function BillingPaymentHistory({ data, formatCurrency }: Props) {
  const now = Date.now();
  const months = [0, 30, 60].map(offset => ({
    date: new Date(now - offset * DAY_MS).toLocaleDateString(),
    label: `${data.license.tier} Đăng Ký`,
    amount: data.projectedCharges.basePriceCents,
  }));

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Lịch Sử Thanh Toán</h2>
      <Card>
        <CardHeader>
          <CardTitle>Thanh Toán Gần Đây</CardTitle>
          <CardDescription>Lịch sử thanh toán trong 6 tháng gần nhất</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Mô Tả</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead className="text-right">Số Tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map(row => (
                <TableRow key={row.date}>
                  <TableCell className="font-medium">{row.date}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    <Badge variant="default">Đã Thanh Toán</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/billing/invoices">View All Invoices</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
