import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import type { AuditLogItem } from './types';
import { formatDate } from './rotation-helpers';

interface AuditLogsCardProps {
  logs: AuditLogItem[];
  locale: string;
}

export function AuditLogsCard({ logs, locale }: AuditLogsCardProps) {
  const t = useTranslations('admin.keyRotation');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auditTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('auditSubtitle')}</p>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">{t('columns.action')}</th>
                  <th className="p-3 font-medium">{t('columns.timestamp')}</th>
                  <th className="p-3 font-medium">{t('columns.actor')}</th>
                  <th className="p-3 font-medium">{t('columns.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {log.action}
                      </code>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(log.created_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {log.user_id ?? '—'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                      {log.details ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('emptyAudit')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
