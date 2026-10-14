'use client';

import React from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input } from '@/components/stitch';
import {
  AFFILIATE_PORTAL_STATS,
  AffiliateReferralsAndMaterialsGrid,
} from './affiliate-portal-sections';

export default function AffiliatePortalPage() {
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
        <div className="text-center mb-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
            Affiliate Portal
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Share Sophia AI and earn 30% recurring commission on all referrals
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-xl">
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Total Earnings</p>
            <p className="font-headline-md text-headline-md text-primary">{AFFILIATE_PORTAL_STATS.totalEarnings}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Pending</p>
            <p className="font-headline-md text-headline-md text-amber-600">{AFFILIATE_PORTAL_STATS.pending}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Clicks</p>
            <p className="font-headline-md text-headline-md text-on-surface">{AFFILIATE_PORTAL_STATS.clicks}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Conversions</p>
            <p className="font-headline-md text-headline-md text-on-surface">{AFFILIATE_PORTAL_STATS.conversions}</p>
          </Card>
          <Card padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Conv. Rate</p>
            <p className="font-headline-md text-headline-md text-emerald-600">{AFFILIATE_PORTAL_STATS.conversionRate}</p>
          </Card>
        </div>

        <Card className="mb-xl" padding="lg">
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Your Referral Link</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Share this link with your audience to earn commissions
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative w-full sm:w-auto">
                <Input value={affiliateLink} readOnly className="font-mono text-sm w-full" />
              </div>
              <Button onClick={handleCopyLink} iconLeft={copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} className="w-full sm:w-auto">
                {copiedLink ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <AffiliateReferralsAndMaterialsGrid />

        <Card className="mt-xl" padding="lg">
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Resources</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              {['Getting Started Guide', 'Best Practices', 'Creative Assets', 'FAQ'].map((resource, idx) => (
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
