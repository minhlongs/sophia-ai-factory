/**
 * License Status Card - shared helpers and types
 */

export interface LicenseStatus {
  nonce: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  createdAt: string;
  expiresAt?: string | null;
  features: string[];
  rateLimit: number;
  quotaLimit: number;
  currentUsage: number;
  polarCustomerId?: string | null;
  stripeCustomerId?: string | null;
}

export function getTierVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tier) {
    case 'MASTER': return 'destructive';
    case 'ENTERPRISE': return 'default';
    case 'PREMIUM': return 'secondary';
    default: return 'outline';
  }
}

export function getStatusColor(status: string): 'green' | 'red' | 'yellow' | 'gray' {
  switch (status) {
    case 'active': return 'green';
    case 'expired': return 'red';
    case 'suspended': return 'yellow';
    case 'revoked': return 'gray';
    default: return 'gray';
  }
}

export function formatTier(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}
