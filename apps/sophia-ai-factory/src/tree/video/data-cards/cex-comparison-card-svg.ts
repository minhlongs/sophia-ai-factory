/**
 * @module tree/video/data-cards/cex-comparison-card-svg
 * Deterministic Edge SVG Data Card for Crypto CEX fee and live market comparison.
 */

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface CexComparisonCardData {
  primaryExchange: string;
  competitorExchange: string;
  btcPriceUsd: string;
  change24hPct: string;
  makerFeeDiscount: string;
  takerFeeDiscount: string;
  kickbackRatePct: string;
  referralCode: string;
}

export function generateCexComparisonCardSvg(data: CexComparisonCardData): string {
  const pEx = escapeXml(data.primaryExchange);
  const cEx = escapeXml(data.competitorExchange);
  const price = escapeXml(data.btcPriceUsd);
  const chg = escapeXml(data.change24hPct);
  const isPos = !data.change24hPct.startsWith('-');
  const chgColor = isPos ? '#10B981' : '#EF4444';
  const kickback = escapeXml(data.kickbackRatePct);
  const code = escapeXml(data.referralCode);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090D16" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bgGrad)" />
  <rect x="80" y="240" width="920" height="200" rx="24" fill="#1F2937" stroke="#374151" stroke-width="2" />
  <text x="130" y="320" font-family="Inter, sans-serif" font-size="36" fill="#9CA3AF">BTC/USDT REALTIME</text>
  <text x="130" y="390" font-family="Inter, sans-serif" font-size="54" font-weight="700" fill="#FFFFFF">$${price}</text>
  <text x="760" y="380" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="${chgColor}">${chg}%</text>
  <rect x="80" y="480" width="920" height="960" rx="32" fill="#182234" stroke="#D97706" stroke-width="3" />
  <text x="130" y="570" font-family="Inter, sans-serif" font-size="48" font-weight="800" fill="#FBBF24">FEE &amp; KICKBACK MATRIX</text>
  <text x="130" y="660" font-family="Inter, sans-serif" font-size="34" fill="#9CA3AF">${pEx} VIP vs ${cEx} Standard</text>
  <rect x="130" y="720" width="820" height="180" rx="16" fill="#0F172A" />
  <text x="170" y="790" font-family="Inter, sans-serif" font-size="32" fill="#9CA3AF">Maker Fee Discount</text>
  <text x="170" y="860" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="#10B981">${escapeXml(data.makerFeeDiscount)}</text>
  <rect x="130" y="930" width="820" height="180" rx="16" fill="#0F172A" />
  <text x="170" y="1000" font-family="Inter, sans-serif" font-size="32" fill="#9CA3AF">Taker Fee Discount</text>
  <text x="170" y="1070" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="#10B981">${escapeXml(data.takerFeeDiscount)}</text>
  <rect x="130" y="1140" width="820" height="220" rx="20" fill="#78350F" stroke="#F59E0B" stroke-width="2" />
  <text x="170" y="1210" font-family="Inter, sans-serif" font-size="34" font-weight="700" fill="#FEF3C7">LIFETIME KICKBACK REBATE</text>
  <text x="170" y="1300" font-family="Inter, sans-serif" font-size="64" font-weight="900" fill="#FDE68A">${kickback}% BACK</text>
  <rect x="80" y="1480" width="920" height="240" rx="28" fill="#1E293B" />
  <text x="130" y="1560" font-family="Inter, sans-serif" font-size="36" fill="#E2E8F0">Use Exclusive Referral Code:</text>
  <text x="130" y="1650" font-family="Inter, sans-serif" font-size="64" font-weight="900" fill="#38BDF8">${code}</text>
</svg>`;
}
