'use client';

/**
 * MFA Setup Page — /settings/security/mfa
 *
 * Allows users to:
 *   1. View current MFA status
 *   2. Set up TOTP via QR code scan + verification
 *   3. View backup codes (one-time, after first activation)
 *   4. Disable MFA (requires current TOTP code)
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';

type MfaStatus = 'idle' | 'setup' | 'backup_codes' | 'disable';

interface SetupData {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
}

export default function MfaPage() {
  const t = useTranslations('settings.mfa');

  const [status, setStatus] = useState<MfaStatus>('idle');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const handleSetup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      if (!res.ok) throw new Error(t('error_generic'));
      const data = await res.json() as { secret: string; otpauthUri: string };
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUri, { width: 200 });
      setSetupData({ secret: data.secret, otpauthUri: data.otpauthUri, qrDataUrl });
      setStatus('setup');
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 422) {
        setError(t('error_invalid_code'));
        return;
      }
      if (!res.ok) throw new Error(t('error_generic'));
      const data = await res.json() as { backupCodes: string[] };
      setBackupCodes(data.backupCodes);
      setMfaEnabled(true);
      setStatus('backup_codes');
      setCode('');
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [code, t]);

  const handleDisable = useCallback(async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 422) {
        setError(t('error_invalid_code'));
        return;
      }
      if (!res.ok) throw new Error(t('error_generic'));
      setMfaEnabled(false);
      setStatus('idle');
      setCode('');
      setSetupData(null);
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [code, t]);

  return (
    <div className="container mx-auto max-w-2xl py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status</span>
          <span aria-live="polite" className={`text-sm px-2 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {mfaEnabled ? t('status_enabled') : t('status_disabled')}
          </span>
        </div>

        {/* Idle — MFA not enabled */}
        {status === 'idle' && !mfaEnabled && (
          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2 px-4 font-medium hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            {loading ? 'Setting up…' : t('setup_button')}
          </button>
        )}

        {/* Idle — MFA enabled, show disable option */}
        {status === 'idle' && mfaEnabled && (
          <button
            onClick={() => setStatus('disable')}
            className="w-full rounded-lg border border-destructive text-destructive py-2 px-4 font-medium hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:outline-none"
          >
            {t('disable_button')}
          </button>
        )}

        {/* Setup — Show QR code */}
        {status === 'setup' && setupData && (
          <div className="space-y-4">
            <h2 className="font-semibold">{t('setup_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('setup_description')}</p>
            <div className="flex justify-center">
              <img src={setupData.qrDataUrl} alt="TOTP QR Code" width={200} height={200} />
            </div>
            <p className="text-xs text-center font-mono break-all text-muted-foreground">{setupData.secret}</p>
            <div className="space-y-2">
              <label htmlFor="mfa-setup-code" className="text-sm font-medium">{t('code_label')}</label>
              <input
                id="mfa-setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('code_placeholder')}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 px-4 font-medium hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              {loading ? 'Verifying…' : t('verify_button')}
            </button>
          </div>
        )}

        {/* Backup codes — show once after activation */}
        {status === 'backup_codes' && (
          <div className="space-y-4">
            <h2 className="font-semibold">{t('backup_codes_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('backup_codes_description')}</p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="rounded-md bg-muted px-3 py-2 text-sm font-mono text-center">
                  {c}
                </code>
              ))}
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 px-4 font-medium hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              {t('backup_codes_done')}
            </button>
          </div>
        )}

        {/* Disable MFA */}
        {status === 'disable' && (
          <div className="space-y-4">
            <h2 className="font-semibold">{t('disable_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('disable_description')}</p>
            <div className="space-y-2">
              <label htmlFor="mfa-disable-code" className="text-sm font-medium">{t('code_label')}</label>
              <input
                id="mfa-disable-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('code_placeholder')}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setStatus('idle'); setCode(''); setError(''); }}
                className="flex-1 rounded-lg border py-2 px-4 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={loading || code.length !== 6}
                className="flex-1 rounded-lg bg-destructive text-destructive-foreground py-2 px-4 font-medium hover:bg-destructive/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:outline-none"
              >
                {loading ? 'Disabling…' : t('disable_button')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
