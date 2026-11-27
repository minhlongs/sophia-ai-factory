'use client';

/**
 * Step 5 — Scale, Geo-Routing, Cadence & Integer-Cent Payouts (Rounds 21–25).
 * Styled with Google MD3 Expressive tonal cards and zero developer jargon.
 */

import { useMemo, useState } from 'react';
import { scoreFrame1VisualHook, type ShortFormPlatform } from '@/seed/video/frame1-hook-scorer';
import { resolveGeoFailoverOffer } from '@/seed/affiliate/geo-failover-router';
import { evaluateCreatorCadence } from '@/seed/growth/creator-cadence-engine';
import { allocateIntegerCentWaterfall } from '@/seed/finance/integer-cent-waterfall';

export function WorkbenchTabR21R25Engines({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [country, setCountry] = useState<'VN' | 'US' | 'UK' | 'SG'>('VN');
  const [platform, setPlatform] = useState<ShortFormPlatform>('tiktok');
  const [postsToday, setPostsToday] = useState(2);
  const [grossUsd, setGrossUsd] = useState(999.99);

  const live = useMemo(() => {
    const frame1 = scoreFrame1VisualHook({
      platform,
      headline: locale === 'vi' ? 'Giảm 40% Phí Giao Dịch 2026' : 'Cut Trading Fees 40% in 2026',
      textHex: '#FFFFFF',
      bgHex: '#090A10',
      textBox: { x: 100, y: 280, width: 700, height: 180 },
    });

    const geo = resolveGeoFailoverOffer(
      [
        { id: 'Bybit Global Rebate', url: 'https://partner.bybit.com/b/sophia', blockedCountries: ['US', 'UK'], consecutiveHardFailures: 0, breakerState: 'closed' },
        { id: 'TradingView SaaS Pro', url: 'https://www.tradingview.com/?aff_id=sophia', blockedCountries: [], consecutiveHardFailures: 0, breakerState: 'closed' },
      ],
      country,
    );

    const cadence = evaluateCreatorCadence({
      postsToday,
      dailyCap: 3,
      currentStreakDays: 8,
      graceTokensRemaining: 2,
      actionBlockTripped: false,
    });

    const cents = BigInt(Math.max(0, Math.round(grossUsd * 100)));
    const split = allocateIntegerCentWaterfall(cents, [
      { participantId: 'Creator (70%)', role: 'creator', basisPoints: 7000 },
      { participantId: 'VA Editor (20%)', role: 'va_editor', basisPoints: 2000 },
      { participantId: 'Agency (10%)', role: 'agency', basisPoints: 1000 },
    ]);

    return { frame1, geo, cadence, split };
  }, [country, platform, postsToday, grossUsd, locale]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* R22: Frame-1 Safe-Zone & Contrast */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {locale === 'vi' ? 'Khung Hình Đầu (Frame-1)' : 'Frame-1 Visual Hook'}
          </span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as ShortFormPlatform)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="tiktok">TikTok</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="instagram_reels">Instagram Reels</option>
          </select>
        </div>
        <div className="text-xl font-bold text-foreground">
          {live.frame1.score100}/100 • {live.frame1.contrastRatio}:1 WCAG
        </div>
        <p className="text-xs text-muted-foreground">
          {live.frame1.safeZoneClear
            ? locale === 'vi' ? '✅ Chữ nằm gọn trong vùng an toàn (không bị che nút Like/Share)' : '✅ Text sits safely inside UI clear zone'
            : live.frame1.warnings[0]}
        </p>
      </div>

      {/* R23: Geo-Routing & Failover */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {locale === 'vi' ? 'Chuyển Hướng Theo Quốc Gia' : 'Edge Geo-Routing & Failover'}
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as 'VN' | 'US' | 'UK' | 'SG')}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="VN">Vietnam (VN)</option>
            <option value="US">United States (US)</option>
            <option value="UK">United Kingdom (UK)</option>
            <option value="SG">Singapore (SG)</option>
          </select>
        </div>
        <div className="text-base font-bold text-emerald-500">
          {live.geo.selectedOfferId ?? 'Fallback'}
        </div>
        <p className="text-xs text-muted-foreground">{live.geo.reason}</p>
      </div>

      {/* R24: Anti-Burnout Publishing Cadence */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {locale === 'vi' ? 'Nhịp Đăng Bài Chống Spam' : 'Anti-Burnout Publishing Cadence'}
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {locale === 'vi' ? `Số bài đã đăng hôm nay: ${postsToday} / 3` : `Posts today: ${postsToday} / 3`}
          <input
            type="range"
            min={0}
            max={5}
            value={postsToday}
            onChange={(e) => setPostsToday(Number(e.target.value))}
          />
        </label>
        <p className="text-xs font-medium text-foreground">
          {live.cadence.status === 'ready'
            ? locale === 'vi' ? `✅ Còn ${live.cadence.remainingSlotsToday} suất đăng an toàn hôm nay` : `✅ ${live.cadence.remainingSlotsToday} safe slot(s) remaining today`
            : locale === 'vi' ? '⏳ Đã đủ ngưỡng ngày — tự động dời sang ngày mai để tránh bị bóp reach' : '⏳ Daily cap reached — deferring burst to tomorrow'}
        </p>
      </div>

      {/* R25: Integer-Cent 70/20/10 Revenue Split */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {locale === 'vi' ? 'Chia Hoa Hồng 70/20/10 (0 Sai Số)' : '70/20/10 Integer-Cent Split'}
          </span>
          <input
            type="number"
            min={0}
            step={10}
            value={grossUsd}
            onChange={(e) => setGrossUsd(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs font-mono"
          />
        </div>
        <ul className="space-y-1 text-xs">
          {live.split.allocations.map((a) => (
            <li key={a.participantId} className="flex justify-between">
              <span className="text-muted-foreground">{a.participantId}</span>
              <span className="font-mono font-semibold text-foreground">{a.formattedUsd}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
