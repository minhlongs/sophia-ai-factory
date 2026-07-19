'use client';

/**
 * License Generator Form Fields
 * Customer email, tier select, expiration date, duration, metadata inputs
 */

import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Badge } from '@/seed/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { Calendar } from 'lucide-react';

export interface TierInfo {
  value: string;
  label: string;
  price: string;
  color: string;
  features: string[];
}

export const TIERS: TierInfo[] = [
  {
    value: 'basic',
    label: 'Basic',
    price: '$199/mo',
    color: 'bg-primary/10/10 text-primary border-primary/30/30',
    features: ['1 channel', '5 templates', 'Basic support'],
  },
  {
    value: 'premium',
    label: 'Premium',
    price: '$399/mo',
    color: 'bg-primary/50/10 text-primary border-primary/50/30',
    features: ['3 channels', 'Unlimited templates', 'Priority support'],
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    price: '$799/mo',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    features: ['Unlimited channels', 'White-label', 'Dedicated support'],
  },
  {
    value: 'master',
    label: 'Master',
    price: '$4,999',
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    features: ['Lifetime access', 'VIP support', 'All features'],
  },
];

interface LicenseGeneratorFormFieldsProps {
  tier: string;
  expiresAt: string;
  durationDays: string;
  customerEmail: string;
  metadata: string;
  emailError: string;
  onTierChange: (value: string) => void;
  onExpiresAtChange: (value: string) => void;
  onDurationChange: (days: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onMetadataChange: (value: string) => void;
}

export function LicenseGeneratorFormFields({
  tier,
  expiresAt,
  durationDays,
  customerEmail,
  metadata,
  emailError,
  onTierChange,
  onExpiresAtChange,
  onDurationChange,
  onCustomerEmailChange,
  onMetadataChange,
}: LicenseGeneratorFormFieldsProps) {
  return (
    <>
      {/* Customer Email */}
      <div>
        <Label className="text-foreground">Customer Email (optional)</Label>
        <Input
          type="email"
          placeholder="customer@example.com"
          value={customerEmail}
          onChange={(e) => onCustomerEmailChange(e.target.value)}
          className="bg-muted border-border text-foreground mt-1"
        />
        {emailError && (
          <p className="text-xs text-red-400 mt-1">{emailError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Email address to associate with this license
        </p>
      </div>

      {/* Tier Selection */}
      <div>
        <Label className="text-foreground">Subscription Tier</Label>
        <Select value={tier} onValueChange={onTierChange}>
          <SelectTrigger className="bg-muted border-border text-foreground mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map(t => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex items-center gap-2">
                  <Badge className={t.color} variant="outline">
                    {t.label}
                  </Badge>
                  <span className="text-muted-foreground">{t.price}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expiration fields (hidden for master tier) */}
      {tier !== 'master' && (
        <>
          <div>
            <Label className="text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              Expiration Date
            </Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => onExpiresAtChange(e.target.value)}
              className="bg-muted border-border text-foreground mt-1"
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for default (1 year from now)
            </p>
          </div>

          <div>
            <Label className="text-foreground">Duration (days)</Label>
            <Select value={durationDays} onValueChange={onDurationChange}>
              <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days (1 year)</SelectItem>
                <SelectItem value="730">730 days (2 years)</SelectItem>
                <SelectItem value="0">Custom (use date picker above)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Metadata */}
      <div>
        <Label className="text-foreground">Metadata (optional)</Label>
        <Input
          type="text"
          placeholder='{"customer": "Acme Corp", "notes": "Q1 2026"}'
          value={metadata}
          onChange={(e) => onMetadataChange(e.target.value)}
          className="bg-muted border-border text-foreground mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          JSON object or plain text notes
        </p>
      </div>
    </>
  );
}
