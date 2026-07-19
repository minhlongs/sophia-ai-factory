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
      if (data.code) {
        setCode(data.code);
      }
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
    const text = encodeURIComponent(`${t('shareText')}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
          {/* Share link with copy button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg border border-border font-mono truncate select-all">
              {shareUrl}
            </code>
            <Button onClick={copyLink} variant="outline" size="sm" aria-label={copied ? t('copied') : t('copyButton')}>
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </Button>
          </div>

          {/* Native share buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">{t('shareLabel')}</span>
            <Button
              onClick={shareWhatsApp}
              variant="ghost"
              size="sm"
              className="h-10 w-10 md:h-8 md:w-8 p-0 rounded-full hover:bg-green-500/10 hover:text-green-500"
              aria-label={t('shareWhatsApp')}
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={shareTelegram}
              variant="ghost"
              size="sm"
              className="h-10 w-10 md:h-8 md:w-8 p-0 rounded-full hover:bg-accent/10/10 hover:text-accent"
              aria-label={t('shareTelegram')}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={shareEmail}
              variant="ghost"
              size="sm"
              className="h-10 w-10 md:h-8 md:w-8 p-0 rounded-full hover:bg-primary/10/10 hover:text-primary"
              aria-label={t('shareEmail')}
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
