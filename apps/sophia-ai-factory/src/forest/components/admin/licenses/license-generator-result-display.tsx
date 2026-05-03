'use client';

/**
 * License Generator Result Display
 * Shows generated key, copy button, license details, and error/success alerts
 */

import { useState } from 'react';
import { Label } from '@/seed/components/ui/label';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import type { LicenseSummary } from '@/forest/raas-schema';
import type { TierInfo } from './license-generator-form-fields';

interface GeneratorResult {
  key?: string;
  warning?: string;
  license?: LicenseSummary;
}

interface LicenseGeneratorResultDisplayProps {
  result: GeneratorResult;
  selectedTier?: TierInfo;
}

export function LicenseGeneratorResultDisplay({
  result,
  selectedTier,
}: LicenseGeneratorResultDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result.key) {
      await navigator.clipboard.writeText(result.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
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
  );
}
