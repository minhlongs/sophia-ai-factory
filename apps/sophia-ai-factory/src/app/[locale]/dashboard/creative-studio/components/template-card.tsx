'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/seed/components/ui/card';
import {
  BadgePercent,
  CalendarDays,
  Clapperboard,
  Flame,
  Handshake,
  Lock,
  Rocket,
  Video,
  type LucideIcon,
} from 'lucide-react';

interface TemplateCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  tier?: string;
  isPremium?: boolean;
  onUse: () => void;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  welcome: 'from-primary to-accent',
  product: 'from-purple-500 to-pink-500',
  seasonal: 'from-orange-500 to-yellow-500',
  promotion: 'from-red-500 to-orange-500',
  viral: 'from-green-500 to-teal-500',
  video: 'from-primary to-accent',
  default: 'from-gray-500 to-slate-500',
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  welcome: Handshake,
  product: Rocket,
  seasonal: CalendarDays,
  promotion: BadgePercent,
  viral: Flame,
  video: Clapperboard,
  default: Video,
};

export function TemplateCard({
  name,
  description,
  category,
  isPremium = false,
  onUse,
}: TemplateCardProps) {
  const t = useTranslations('creativeStudio.templates');
  const gradient = CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.default;
  const Icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.default;

  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-primary/40 hover:shadow-md">
      <CardHeader className={`bg-gradient-to-r ${gradient} p-4`}>
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
          {isPremium && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-white/20 text-white border-0 text-xs"
            >
              <Lock className="w-3 h-3" />
              Premium
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3 p-4">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground">{name}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {category}
          </Badge>
          <Button size="sm" onClick={onUse} className="h-8 cursor-pointer text-xs">
            {t('useTemplate')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
