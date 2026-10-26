/**
 * @module tree/video/data-cards/saas-roi-card-svg
 * Deterministic Edge SVG Data Card for B2B SaaS ROI, MRR savings & feature comparison.
 */

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface SaasRoiCardData {
  productName: string;
  category: string;
  monthlySavingsUsd: string;
  hoursSavedWeekly: string;
  efficiencyGainPct: string;
  startingPriceUsd: string;
  affiliateDealNote: string;
}

export function generateSaasRoiCardSvg(data: SaasRoiCardData): string {
  const name = escapeXml(data.productName);
  const cat = escapeXml(data.category);
  const sav = escapeXml(data.monthlySavingsUsd);
  const hrs = escapeXml(data.hoursSavedWeekly);
  const eff = escapeXml(data.efficiencyGainPct);
  const price = escapeXml(data.startingPriceUsd);
  const note = escapeXml(data.affiliateDealNote);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="saasBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#1E1B4B" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#saasBg)" />
  <rect x="80" y="240" width="920" height="220" rx="28" fill="#1E293B" stroke="#4F46E5" stroke-width="2" />
  <text x="130" y="320" font-family="Inter, sans-serif" font-size="36" fill="#A5B4FC">${cat.toUpperCase()}</text>
  <text x="130" y="400" font-family="Inter, sans-serif" font-size="56" font-weight="800" fill="#FFFFFF">${name}</text>
  <rect x="80" y="500" width="920" height="920" rx="32" fill="#131C31" stroke="#312E81" stroke-width="2" />
  <text x="130" y="590" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="#E0E7FF">ESTIMATED ROI &amp; EFFICIENCY</text>
  <rect x="130" y="650" width="820" height="200" rx="20" fill="#1E1B4B" />
  <text x="170" y="725" font-family="Inter, sans-serif" font-size="32" fill="#C7D2FE">Net Monthly Savings</text>
  <text x="170" y="805" font-family="Inter, sans-serif" font-size="56" font-weight="800" fill="#34D399">+$${sav}/mo</text>
  <rect x="130" y="880" width="820" height="200" rx="20" fill="#1E1B4B" />
  <text x="170" y="955" font-family="Inter, sans-serif" font-size="32" fill="#C7D2FE">Time Reclaimed Per Team</text>
  <text x="170" y="1035" font-family="Inter, sans-serif" font-size="56" font-weight="800" fill="#60A5FA">${hrs} Hours/Week</text>
  <rect x="130" y="1110" width="820" height="240" rx="20" fill="#311B92" stroke="#818CF8" stroke-width="2" />
  <text x="170" y="1185" font-family="Inter, sans-serif" font-size="32" fill="#E0E7FF">Productivity Multiplier</text>
  <text x="170" y="1285" font-family="Inter, sans-serif" font-size="64" font-weight="900" fill="#FDE047">+${eff}% Output</text>
  <rect x="80" y="1460" width="920" height="260" rx="28" fill="#1E293B" stroke="#6366F1" stroke-width="2" />
  <text x="130" y="1540" font-family="Inter, sans-serif" font-size="34" fill="#94A3B8">Plans start from $${price}/mo</text>
  <text x="130" y="1625" font-family="Inter, sans-serif" font-size="44" font-weight="800" fill="#A5B4FC">${note}</text>
</svg>`;
}
