import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import type { KeyVersionItem } from './types';
import { formatDate } from './rotation-helpers';

interface VersionHistoryCardProps {
  history: KeyVersionItem[];
  locale: string;
}

export function VersionHistoryCard({ history, locale }: VersionHistoryCardProps) {
  const t = useTranslations('admin.keyRotation');

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('historyTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('historySubtitle')}</p>
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">{t('columns.version')}</th>
                  <th className="p-3 font-medium">{t('columns.keyType')}</th>
                  <th className="p-3 font-medium">{t('columns.status')}</th>
                  <th className="p-3 font-medium">{t('columns.createdAt')}</th>
                  <th className="p-3 font-medium">{t('columns.rotatedAt')}</th>
                  <th className="p-3 font-medium">{t('columns.rotatedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">v{row.version}</td>
                    <td className="p-3 text-foreground">{row.key_type}</td>
                    <td className="p-3">
                      <Badge variant={row.is_active === 1 ? 'default' : 'secondary'}>
                        {row.is_active === 1 ? t('activeStatus') : t('inactiveStatus')}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(row.created_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(row.rotated_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {row.rotated_by ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('emptyHistory')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
