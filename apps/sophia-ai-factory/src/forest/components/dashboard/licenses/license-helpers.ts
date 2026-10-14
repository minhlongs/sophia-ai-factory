export const TIER_OPTIONS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

export function getTierColor(tier: string): string {
  switch (tier.toUpperCase()) {
    case 'MASTER':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'ENTERPRISE':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'PREMIUM':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'expired':
    case 'revoked':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
}
