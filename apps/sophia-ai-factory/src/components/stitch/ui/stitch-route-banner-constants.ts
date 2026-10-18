export type StitchRouteBannerTone = 'amber' | 'emerald' | 'indigo';

export const TEST_ID_TO_STITCH_HTML: Record<string, string> = {
  'dashboard-control-deck-banner': 'index.html',
  'stitch-dashboard-control-deck-banner': 'index.html',
  'stitch-studio-deck-strip': 'video-studio.html',
  'stitch-merkle-settlement-banner': 'billing-revenue.html',
  'stitch-byok-vault-banner': 'setup-wizard.html',
  'stitch-agency-subaccount-strip': 'agency-portal.html',
  'stitch-mobile-companion-banner': 'mobile-companion.html',
  'stitch-wave2-route-banner-creative-economy': 'creative-economy.html',
  'stitch-wave2-route-banner-youtube': 'youtube-automation.html',
  'stitch-wave2-route-banner-playbooks': 'playbooks.html',
  'stitch-wave2-route-banner-publish-queue': 'publish-queue.html',
  'stitch-wave2-route-banner-marketplace': 'marketplace.html',
  'stitch-wave2-route-banner-my-sops': 'my-sops.html',
  'stitch-wave2-route-banner-challenges': 'challenges.html',
  'stitch-wave2-route-banner-handover': 'handover-runbooks.html',
  'stitch-wave2-route-banner-system-health': 'system-health.html',
};

export const TONE_STYLES: Record<
  StitchRouteBannerTone,
  { readonly border: string; readonly badge: string; readonly statusPill: string }
> = {
  amber: {
    border: 'border-amber-400/35',
    badge: 'text-amber-400',
    statusPill: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
  },
  emerald: {
    border: 'border-emerald-400/35',
    badge: 'text-emerald-400',
    statusPill: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  },
  indigo: {
    border: 'border-indigo-400/35',
    badge: 'text-indigo-300',
    statusPill: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  },
};
