// i18n-namespace: monetization
/**
 * Channel Table — top ROI channels and revenue attribution breakdown.
 */

import type { MonetizationData } from './page';

interface ChannelTableProps {
  topChannels: MonetizationData['topChannels'];
  revenueAttribution: MonetizationData['revenueAttribution'];
  t: (key: string) => string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function ChannelTable({ topChannels, revenueAttribution, t }: ChannelTableProps) {
  return (
    <section className="mt-6 space-y-6">
      {/* Top Channels */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[hsl(240,12%,12%)]">{t('channelBreakdown')}</h2>
        {topChannels.length === 0 ? (
          <p className="text-sm text-[hsl(240,12%,45%)]">{t('noData')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[hsl(35,30%,90%)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[hsl(35,30%,95%)] text-[hsl(240,12%,12%)]">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('channel')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('revenue')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('cost')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('units')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('roiPercent')}</th>
                </tr>
              </thead>
              <tbody>
                {topChannels.map((ch, idx) => (
                  <tr
                    key={`${ch.channel ?? 'direct'}-${idx}`}
                    className="border-t border-[hsl(35,30%,90%)]"
                  >
                    <td className="px-4 py-2 font-medium">{ch.channel ?? 'direct'}</td>
                    <td className="px-4 py-2 text-right">{formatCents(ch.totalRevenueCents)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(ch.totalCostCents)}</td>
                    <td className="px-4 py-2 text-right">{ch.unitCount}</td>
                    <td className="px-4 py-2 text-right">{ch.roi.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue Attribution */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[hsl(240,12%,12%)]">{t('attribution')}</h2>
        {revenueAttribution.length === 0 ? (
          <p className="text-sm text-[hsl(240,12%,45%)]">{t('noData')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[hsl(35,30%,90%)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[hsl(35,30%,95%)] text-[hsl(240,12%,12%)]">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('channel')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('revenue')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('cost')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('roiPercent')}</th>
                </tr>
              </thead>
              <tbody>
                {revenueAttribution.slice(0, 10).map((attr, idx) => (
                  <tr
                    key={`${attr.channel}-${attr.network}-${idx}`}
                    className="border-t border-[hsl(35,30%,90%)]"
                  >
                    <td className="px-4 py-2 font-medium">
                      {attr.channel}
                      <span className="ml-1 text-xs text-[hsl(240,12%,45%)]">({attr.network})</span>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCents(attr.revenueCents)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(attr.costCents)}</td>
                    <td className="px-4 py-2 text-right">{attr.roi.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
