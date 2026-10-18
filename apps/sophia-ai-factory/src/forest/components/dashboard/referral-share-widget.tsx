'use client';

import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Send, Mail } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { useTranslations } from 'next-intl';

interface ReferralGenerateResponse {
  code?: string;
  error?: string;
}

interface ReferralShareWidgetProps {
  /** Pre-populated code from server, skip API fetch if provided */
  initialCode?: string | null;
  /** Pre-populated share URL from server */
  initialShareUrl?: string | null;
}

export function ReferralShareWidget({ initialCode, initialShareUrl }: ReferralShareWidgetProps) {
  const t = useTranslations('dashboard.affiliate.referral');
  const csrfHeaders = useCsrfToken();
  const [code, setCode] = useState<string | null>(initialCode ?? null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    initialShareUrl ??
    (code ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}?ref=${code}` : null);

  async function generateCode() {
    setLoading(true);
    try {
      const res = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { ...csrfHeaders },
      });
      const data = (await res.json()) as ReferralGenerateResponse;
      if (data.code) setCode(data.code);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    if (!shareUrl) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${t('shareText')}\n${shareUrl}`)}`, '_blank', 'noopener,noreferrer');
  }

  function shareTelegram() {
    if (!shareUrl) return;
    const text = encodeURIComponent(`${t('shareText')}\n${shareUrl}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function shareEmail() {
    if (!shareUrl) return;
    const subject = encodeURIComponent(t('emailSubject'));
    const body = encodeURIComponent(`${t('shareText')}\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
  }

  const shareButtons = [
    { onClick: shareWhatsApp, label: t('shareWhatsApp'), icon: MessageCircle, cls: 'hover:bg-green-500/10 hover:text-green-500' },
    { onClick: shareTelegram, label: t('shareTelegram'), icon: Send, cls: 'hover:bg-sky-500/10 hover:text-sky-500' },
    { onClick: shareEmail, label: t('shareEmail'), icon: Mail, cls: 'hover:bg-blue-500/10 hover:text-blue-500' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">{t('title')}</h3>
      </div>

      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>

      {!code ? (
        <Button onClick={generateCode} disabled={loading} variant="outline" size="sm">
          {loading ? t('generating') : t('generateButton')}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg border border-border font-mono truncate select-all">
              {shareUrl}
            </code>
            <Button onClick={copyLink} variant="outline" size="sm" aria-label={copied ? t('copied') : t('copyButton')}>
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">{t('shareLabel')}</span>
            {shareButtons.map(({ onClick, label, icon: Icon, cls }) => (
              <Button key={label} onClick={onClick} variant="ghost" size="sm" className={`h-10 w-10 md:h-8 md:w-8 p-0 rounded-full ${cls}`} aria-label={label}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
