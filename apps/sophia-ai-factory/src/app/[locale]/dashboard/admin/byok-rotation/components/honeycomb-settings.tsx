'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

export default function HoneycombSettings({ locale }: { locale: string }) {
  const isVi = locale.startsWith('vi');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    fetch('/api/admin/platform-config?key=honeycomb_api_key')
      .then((r: Response) => r.json() as Promise<{ exists?: boolean }>)
      .then((d: { exists?: boolean }) => {
        if (d?.exists) setHasExistingKey(true);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'honeycomb_api_key', value: apiKey.trim() }),
      });
      if (res.ok) {
        setStatus({ ok: true, msg: isVi ? 'Đã lưu khóa Honeycomb' : 'Honeycomb key saved' });
        setApiKey('');
        setHasExistingKey(true);
      } else {
        const errData = await res.json() as { error?: string };
        setStatus({ ok: false, msg: errData?.error || 'Save failed' });
      }
    } catch (_err) {
      setStatus({ ok: false, msg: _err instanceof Error ? _err.message : 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">
        {isVi ? 'Cấu Hình Honeycomb (OTel)' : 'Honeycomb Configuration (OTel)'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isVi
          ? 'Nhập Honeycomb API Key để bật theo dõi telemetry. Khóa được mã hóa và lưu an toàn.'
          : 'Enter your Honeycomb API Key to enable telemetry tracing. The key is encrypted at rest.'}
      </p>

      {hasExistingKey && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="w-4 h-4" />
          {isVi ? 'Đã cấu hình khóa' : 'Key is configured'}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={isVi ? 'Nhập Honeycomb API Key...' : 'Enter Honeycomb API Key...'}
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || !apiKey.trim()} variant="primary" size="sm">
          {saving ? (isVi ? 'Đang lưu...' : 'Saving...') : isVi ? 'Lưu' : 'Save'}
        </Button>
      </div>

      {status && (
        <div className={`flex items-center gap-2 text-sm ${status.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.msg}
        </div>
      )}
    </section>
  );
}
