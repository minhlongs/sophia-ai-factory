'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Copy, Check, ImageOff } from 'lucide-react';

interface BrandAssetCardProps {
  type: 'logo' | 'color' | 'font';
  label: string;
  value: string;
  /** For logo: image URL. For color: hex string. For font: font-family name. */
  preview?: string;
}

export function BrandAssetCard({ type, label, value, preview }: BrandAssetCardProps) {
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard access may be denied — silently no-op
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Preview area */}
        <div className="flex items-center justify-center h-16 rounded-md bg-muted overflow-hidden">
          {type === 'logo' && (
            preview
              ? <img src={preview} alt={label} className="h-full object-contain" />
              : <ImageOff className="w-6 h-6 text-muted-foreground" />
          )}
          {type === 'color' && (
            <div
              className="w-12 h-12 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: value }}
              aria-label={`Color swatch: ${value}`}
            />
          )}
          {type === 'font' && (
            <span
              className="text-lg font-medium text-foreground"
              style={{ fontFamily: value }}
            >
              Aa Bb Cc
            </span>
          )}
        </div>

        {/* Label + value */}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground truncate">{value}</p>
        </div>

        {/* Copy button for color/font */}
        {(type === 'color' || type === 'font') && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs gap-1"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
