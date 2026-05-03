'use client';

/**
 * License Generator Component
 * Composition root: form tạo license key mới với tier selection và expiration picker
 */

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Key } from 'lucide-react';
import { LicenseGeneratorFormFields, TIERS } from './license-generator-form-fields';
import { LicenseGeneratorResultDisplay } from './license-generator-result-display';
import type { LicenseSummary } from '@/lib/raas-schema';

interface LicenseGeneratorProps {
  onLicenseCreated?: (license: LicenseSummary) => void;
}

interface GeneratorResult {
  key?: string;
  warning?: string;
  license?: LicenseSummary;
}

interface CreateLicenseResponse {
  key?: string;
  warning?: string;
  license?: LicenseSummary;
  error?: string;
}

export function LicenseGenerator({ onLicenseCreated }: LicenseGeneratorProps) {
  const [tier, setTier] = useState<string>('premium');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [durationDays, setDurationDays] = useState<string>('365');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [metadata, setMetadata] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [emailError, setEmailError] = useState<string>('');

  const selectedTier = TIERS.find(t => t.value === tier);

  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleDurationChange = (days: string) => {
    setDurationDays(days);
    if (days) {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(days, 10));
      setExpiresAt(date.toISOString().slice(0, 16));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setLoading(true);
    setResult(null);

    if (customerEmail && !validateEmail(customerEmail)) {
      setEmailError('Invalid email format');
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = { tier };

      if (tier !== 'master' && expiresAt) {
        body.expiresAt = Math.floor(new Date(expiresAt).getTime() / 1000);
      }

      const finalMetadata: Record<string, unknown> = {};
      if (customerEmail) finalMetadata.customer_email = customerEmail;

      if (metadata.trim()) {
        try {
          const parsed = JSON.parse(metadata);
          Object.assign(finalMetadata, parsed);
        } catch {
          finalMetadata.notes = metadata;
        }
      }

      if (Object.keys(finalMetadata).length > 0) {
        body.metadata = finalMetadata;
      }

      const response = await fetch('/api/admin/licenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as CreateLicenseResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create license');
      }

      setResult(data);
      if (data.license) onLicenseCreated?.(data.license);
    } catch (error) {
      setResult({
        key: undefined,
        warning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Key className="w-5 h-5 text-[var(--neon-cyan)]" />
          Generate License Key
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LicenseGeneratorFormFields
            tier={tier}
            expiresAt={expiresAt}
            durationDays={durationDays}
            customerEmail={customerEmail}
            metadata={metadata}
            emailError={emailError}
            onTierChange={setTier}
            onExpiresAtChange={setExpiresAt}
            onDurationChange={handleDurationChange}
            onCustomerEmailChange={setCustomerEmail}
            onMetadataChange={setMetadata}
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white font-semibold"
          >
            {loading ? 'Generating...' : 'Generate License Key'}
          </Button>
        </form>

        {result && (
          <LicenseGeneratorResultDisplay result={result} selectedTier={selectedTier} />
        )}
      </CardContent>
    </Card>
  );
}
