'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link2, Copy, Check, BarChart3, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Input } from '@/components/stitch';

const affiliateStats = {
  totalEarnings: '$12,450',
  pending: '$3,200',
  clicks: '4,521',
  conversions: '127',
  conversionRate: '2.8%',
};

const recentReferrals = [
  { id: '1', customer: 'Acme Corp', plan: 'Professional', value: '$79', status: 'approved', date: 'Oct 24' },
  { id: '2', customer: 'TechStart Inc', plan: 'Starter', value: '$29', status: 'pending', date: 'Oct 24' },
  { id: '3', customer: 'Design Studio', plan: 'Business', value: '$199', status: 'approved', date: 'Oct 23' },
  { id: '4', customer: 'Dev Agency', plan: 'Professional', value: '$79', status: 'paid', date: 'Oct 23' },
];

const banners = [
  { id: '1', name: 'Hero Banner', size: '728x90', impressions: '12,451', clicks: '234' },
  { id: '2', name: 'Sidebar', size: '300x250', impressions: '8,234', clicks: '156' },
];

export default function AffiliatePortalPage() {
  const t = useTranslations('stitch.affiliatePortal');
  const [copiedLink, setCopiedLink] = React.useState(false);

  const affiliateLink = 'https://sophia.agencyos.network/ref/abc123';

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(affiliateLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background p-lg">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
            {t('title')}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-md mb-xl">
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('stats.totalEarnings')}</p>
            <p className="font-headline-md text-headline-md text-primary">{affiliateStats.totalEarnings}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('stats.pending')}</p>
            <p className="font-headline-md text-headline-md text-amber-600">{affiliateStats.pending}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('stats.clicks')}</p>
            <p className="font-headline-md text-headline-md text-on-surface">{affiliateStats.clicks}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('stats.conversions')}</p>
            <p className="font-headline-md text-headline-md text-on-surface">{affiliateStats.conversions}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('stats.conversionRate')}</p>
            <p className="font-headline-md text-headline-md text-emerald-600">{affiliateStats.conversionRate}</p>
          </Card>
        </div>

        {/* Referral Link */}
        <Card className="mb-xl" padding="lg">
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('referralLink.title')}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {t('referralLink.subtitle')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-md">
              <div className="flex-1 relative">
                <Input value={affiliateLink} readOnly className="font-mono text-sm" />
              </div>
              <Button onClick={handleCopyLink} iconLeft={copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
                {copiedLink ? t('referralLink.copied') : t('referralLink.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
          {/* Referrals */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('referrals.title')}</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                {recentReferrals.map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between pb-md border-b border-outline-variant last:border-0 last:pb-0">
                    <div>
                      <p className="font-label-md text-on-surface">{ref.customer}</p>
                      <p className="text-sm text-on-surface-variant">{ref.plan} • {ref.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-label-md text-on-surface">{ref.value}</p>
                      <Badge
                        variant="soft"
                        color={
                          ref.status === 'approved' ? 'success' :
                          ref.status === 'paid' ? 'primary' : 'warning'
                        }
                      >
                        {t(`referrals.status.${ref.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Marketing Materials */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('marketing.title')}</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                {banners.map((banner) => (
                  <div key={banner.id} className="bg-surface rounded-xl p-md flex items-center gap-md">
                    <div className="w-16 h-12 bg-secondary-container rounded flex items-center justify-center text-secondary font-mono text-xs">
                      {banner.size}
                    </div>
                    <div className="flex-1">
                      <p className="font-label-md text-on-surface">{banner.name}</p>
                      <p className="text-sm text-on-surface-variant">
                        {t('marketing.impressions', { count: banner.impressions })} • {t('marketing.clicks', { count: banner.clicks })}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" iconLeft={<ExternalLink className="w-4 h-4" />}>
                      {t('marketing.getCode')}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-lg pt-lg border-t border-outline-variant">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-sm">{t('commission.title')}</p>
                <div className="bg-primary/5 rounded-xl p-md">
                  <div className="flex items-center gap-md mb-sm">
                    <BarChart3 className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-label-lg text-primary">{t('commission.rate')}</p>
                      <p className="text-sm text-on-surface-variant">{t('commission.description')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resources */}
        <Card className="mt-xl" padding="lg">
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('resources.title')}</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              {[
                t('resources.gettingStarted'),
                t('resources.bestPractices'),
                t('resources.creativeAssets'),
                t('resources.faq')
              ].map((resource, idx) => (
                <Button key={idx} variant="outline" className="h-auto py-md flex-col">
                  <Link2 className="w-5 h-5 mb-sm" />
                  {resource}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
