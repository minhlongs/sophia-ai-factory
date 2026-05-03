'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/seed/components/ui/table';
import { Zap, CreditCard, Calendar } from 'lucide-react';
import type { UsageSummaryResponse } from './billing-page-types';

interface Props {
  data: UsageSummaryResponse;
  formatCurrency: (cents: number) => string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  api_calls: <Zap className="h-4 w-4" />,
  video_generations: <CreditCard className="h-4 w-4" />,
  storage: <Calendar className="h-4 w-4" />,
};

export function BillingOverageTable({ data, formatCurrency }: Props) {
  const { period, overageEvents, projectedCharges } = data;
  const startDate = new Date(period.start).toLocaleDateString();
  const endDate = new Date(period.end).toLocaleDateString();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Chi Tiết Vượt Hạn</h2>
      <Card>
        <CardHeader>
          <CardTitle>Sự Kiện Vượt Hạn Kỳ Này</CardTitle>
          <CardDescription>Kỳ: {startDate} - {endDate}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại Tài Nguyên</TableHead>
                <TableHead>Credits Vượt</TableHead>
                <TableHead>Sự Kiện Tính Phí</TableHead>
                <TableHead className="text-right">Phí Ước Tính</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(overageEvents.byType).map(([type, credits]) => (
                <TableRow key={type}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {TYPE_ICON[type]}
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  </TableCell>
                  <TableCell>{credits.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {Math.round(credits * 0.8).toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Math.round(credits * 0.5 * 100))}
                  </TableCell>
                </TableRow>
              ))}
              {overageEvents.total === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Không có sự kiện vượt hạn trong kỳ này
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Tổng Credits Vượt</p>
              <p className="text-lg font-semibold">{overageEvents.totalCredits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ân Hạn</p>
              <p className="text-lg font-semibold">
                {projectedCharges.gracePeriodCredits === Infinity
                  ? 'Không giới hạn'
                  : projectedCharges.gracePeriodCredits.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Tổng Ước Tính</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(projectedCharges.overageChargesCents)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
