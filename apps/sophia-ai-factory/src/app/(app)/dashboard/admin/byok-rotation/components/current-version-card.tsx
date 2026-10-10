import { useTranslations } from 'next-intl';
import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import type { KeyVersionItem } from './types';
import { formatDate, daysSince } from './rotation-helpers';

interface CurrentVersionCardProps {
  currentVersion: KeyVersionItem | null;
  locale: string;
}

export function CurrentVersionCard({ currentVersion, locale }: CurrentVersionCardProps) {
  const t = useTranslations('admin.keyRotation');
  const ageInDays = daysSince(currentVersion?.created_at ?? null);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {t('currentVersion')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentVersion ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('version')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">v{currentVersion.version}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('keyType')}</p>
              <p className="text-lg font-medium text-foreground mt-1">{currentVersion.key_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('createdAt')}</p>
              <p className="text-lg font-medium text-foreground mt-1">
                {formatDate(currentVersion.created_at, locale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('age')}</p>
              <p className="text-lg font-medium text-foreground mt-1">
                {ageInDays !== null ? t('daysAgo', { days: ageInDays }) : '—'}
              </p>
            </div>
            <div className="md:col-span-4 flex items-center gap-3 pt-2">
              <Badge variant={currentVersion.is_active === 1 ? 'default' : 'secondary'}>
                {currentVersion.is_active === 1 ? t('activeStatus') : t('inactiveStatus')}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {t('dualDecryptNotice')}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('noActiveKey')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
