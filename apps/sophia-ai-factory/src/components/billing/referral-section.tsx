/**
 * ReferralSection — Referral program dashboard widget.
 *
 * Displays the authenticated user's unique referral link, total referrals count,
 * and referral earnings. Uses existing referral and affiliate APIs.
 *
 * @module components/billing/referral-section
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Copy, CheckCircle2, Users, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/seed/components/ui/card';;import { Button } from '@/seed/components/ui/button';

interface ReferralResponse {
  code: string;
  shareUrl: string;
  uses: number;
  rewardAmount: number;
}

/**
 * Fetches or retrieves existing referral code via POST /api/referral/generate.
 * Uses POST so API can access session from headers.
 */
async function fetchReferralCode(): Promise<ReferralResponse> {
  const res = await fetch('/api/referral/generate', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to load referral data: HTTP ${res.status}`);
  }
  return res.json() as Promise<ReferralResponse>;
}

export function ReferralSection() {
  const t = useTranslations('dashboard.billing');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<ReferralResponse>({
    queryKey: ['referral-code'],
    queryFn: fetchReferralCode,
    retry: 1,
    staleTime: 60000,
  });

  const handleCopy = useCallback(async () => {
    if (!data?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [data]);

  // Don't show anything while loading or on error — billing page works without this
  if (isLoading || error || !data) return null;

  const earningsFormatted = (data.rewardAmount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('referralSection')}</h2>
      <Card>
        <CardContent className="pt-5 space-y-5">
          {/* Referral link with copy button */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              {t('yourReferralLink')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={data.shareUrl}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                aria-label={t('yourReferralLink')}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                aria-label={copied ? t('linkCopied') : t('copyLink')}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {t('linkCopied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {t('copyLink')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                {t('totalReferrals')}
              </div>
              <p className="text-2xl font-bold">{data.uses}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                {t('referralEarnings')}
              </div>
              <p className="text-2xl font-bold">{earningsFormatted}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
