'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

interface ReferralGenerateResponse {
  code?: string;
  error?: string;
}

export function ReferralShareWidget() {
  const csrfHeaders = useCsrfToken();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateCode() {
    setLoading(true);
    try {
      const res = await fetch('/api/referral/generate', { method: 'POST', headers: { ...csrfHeaders } });
      const data = (await res.json()) as ReferralGenerateResponse;
      if (data.code) setCode(data.code);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function copyLink() {
    if (!code) return;
    navigator.clipboard.writeText(`https://sophia.agencyos.network/?ref=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-violet-400" />
        <h3 className="font-semibold text-foreground">Giới Thiệu Bạn Bè</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Chia sẻ link giới thiệu và nhận thưởng khi bạn bè đăng ký.
      </p>
      {!code ? (
        <Button onClick={generateCode} disabled={loading} variant="outline" size="sm">
          {loading ? 'Đang tạo...' : 'Tạo Link Giới Thiệu'}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg border border-border font-mono truncate">
            sophia.agencyos.network/?ref={code}
          </code>
          <Button onClick={copyLink} variant="outline" size="sm">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
