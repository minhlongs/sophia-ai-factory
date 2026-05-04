'use client';

/**
 * InstallationWebhookTab — shows webhook URL + regenerate secret action.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Copy, RefreshCw, Check } from 'lucide-react';

const PROD_BASE = 'https://sophia.agencyos.network';

interface Props {
  installationId: string;
  onRegenSecret: () => Promise<{ error?: string; webhookSecret?: string }>;
}

export function InstallationWebhookTab({ installationId, onRegenSecret }: Props) {
  const t = useTranslations('sop.webhook');
  const webhookUrl = `${PROD_BASE}/api/v1/sop/${installationId}/trigger`;

  const [copied, setCopied] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCopy = () => {
    void navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegen = () => {
    setRegenError(null);
    setNewSecret(null);
    startTransition(async () => {
      const r = await onRegenSecret();
      if (r.error) {
        setRegenError(r.error);
      } else if (r.webhookSecret) {
        setNewSecret(r.webhookSecret);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('urlHelp')}</p>
      </div>

      {/* Webhook URL */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t('url')}</p>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 text-sm font-mono bg-zinc-900 border border-border rounded-lg text-zinc-300 truncate">
            {webhookUrl}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="ml-1.5">{copied ? t('copied') : t('copy')}</span>
          </Button>
        </div>
      </div>

      {/* Regenerate secret */}
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={handleRegen}
          disabled={isPending}
          className="text-amber-400 border-amber-800/50 hover:bg-amber-950/30"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'motion-safe:animate-spin' : ''}`} />
          {t('regen')}
        </Button>

        {regenError && <p className="text-sm text-red-400">{regenError}</p>}

        {newSecret && (
          <div className="p-3 bg-amber-950/20 border border-amber-800/50 rounded-lg space-y-2">
            <p className="text-xs text-amber-300">{t('regenSuccess')}</p>
            <code className="block text-sm font-mono text-amber-200 break-all">{newSecret}</code>
          </div>
        )}
      </div>
    </div>
  );
}
