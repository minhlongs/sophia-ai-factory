'use client';

/**
 * License Generator Component
 * Form tạo license key mới với tier selection và expiration picker
 */

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, Key, AlertTriangle, Calendar } from 'lucide-react';
import type { LicenseSummary } from '@/lib/raas-schema';

interface LicenseGeneratorProps {
  onLicenseCreated?: (license: LicenseSummary) => void;
}

interface TierInfo {
  value: string;
  label: string;
  price: string;
  color: string;
  features: string[];
}

const TIERS: TierInfo[] = [
  {
    value: 'basic',
    label: 'Basic',
    price: '$199/mo',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    features: ['1 channel', '5 templates', 'Basic support'],
  },
  {
    value: 'premium',
    label: 'Premium',
    price: '$399/mo',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
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

export function LicenseGenerator({ onLicenseCreated }: LicenseGeneratorProps) {
  const [tier, setTier] = useState<string>('premium');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [metadata, setMetadata] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    key?: string;
    warning?: string;
    license?: LicenseSummary;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedTier = TIERS.find(t => t.value === tier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const body: Record<string, unknown> = { tier };

      // Master tier = perpetual, không cần expiresAt
      if (tier !== 'master' && expiresAt) {
        body.expiresAt = Math.floor(new Date(expiresAt).getTime() / 1000);
      }

      if (metadata.trim()) {
        try {
          body.metadata = JSON.parse(metadata);
        } catch {
          body.metadata = { notes: metadata };
        }
      }

      const response = await fetch('/api/admin/licenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create license');
      }

      setResult(data);
      onLicenseCreated?.(data);
    } catch (error) {
      setResult({
        key: undefined,
        warning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result?.key) {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          {/* Tier Selection */}
          <div>
            <Label className="text-foreground">Subscription Tier</Label>
            <Select value={tier} onValueChange={setTier}>
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

          {/* Expiration Date (ẩn với Master tier) */}
          {tier !== 'master' && (
            <div>
              <Label className="text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Expiration Date
              </Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-muted border-border text-foreground mt-1"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for default (1 year from now)
              </p>
            </div>
          )}

          {/* Metadata (optional) */}
          <div>
            <Label className="text-foreground">Metadata (optional)</Label>
            <Input
              type="text"
              placeholder='{"customer": "Acme Corp", "notes": "Q1 2026"}'
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              className="bg-muted border-border text-foreground mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              JSON object or plain text notes
            </p>
          </div>

          {/* Generate Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white font-semibold"
          >
            {loading ? 'Generating...' : 'Generate License Key'}
          </Button>
        </form>

        {/* Result Display */}
        {result && (
          <div className="mt-6 space-y-4">
            {result.key ? (
              <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
                <Check className="w-5 h-5" />
                <AlertDescription>
                  <strong>License Key Generated Successfully!</strong>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <AlertDescription>
                  {result.warning}
                </AlertDescription>
              </Alert>
            )}

            {result.key && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    Copy Immediately!
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="border-border hover:bg-muted"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg break-all font-mono text-xs text-foreground">
                  {result.key}
                </div>
                {result.warning && (
                  <p className="text-xs text-yellow-400">{result.warning}</p>
                )}
              </div>
            )}

            {result.license && (
              <div className="p-3 bg-muted border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">License ID:</span>
                  <code className="text-xs text-[var(--neon-cyan)]">{result.license.id}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tier:</span>
                  <Badge className={selectedTier?.color} variant="outline">
                    {result.license.tier}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expires:</span>
                  <span className="text-xs text-foreground">
                    {result.license.expiresAt === 0 || result.license.expiresAt === null
                      ? 'Perpetual (Master)'
                      : new Date(result.license.expiresAt * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
