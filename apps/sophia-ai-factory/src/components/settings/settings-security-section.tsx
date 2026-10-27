'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';
import { PasskeysCard } from './settings-passkeys-card';
import type { PasskeyItem } from './settings-security-types';

export function SettingsSecuritySection() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSecurityState = async () => {
    try {
      const pkRes = await authClient.passkey.listUserPasskeys();
      if (Array.isArray(pkRes?.data)) setPasskeys(pkRes.data as PasskeyItem[]);
      const mfaRes = await fetch('/api/auth/mfa/status');
      if (mfaRes.ok) {
        const body = (await mfaRes.json()) as { enabled?: boolean };
        setMfaEnabled(Boolean(body.enabled));
      }
    } catch { /* non-fatal */ }
  };

  useEffect(() => { void loadSecurityState(); }, []);

  const handleAddPasskey = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await authClient.passkey.addPasskey({ name: 'Sophia Hardware Key' });
      if (res?.error) setNotice(res.error.message || 'Passkey enrollment failed');
      else { setNotice('Passkey enrolled successfully.'); await loadSecurityState(); }
    } finally { setLoading(false); }
  };

  const handleDeletePasskey = async (id: string) => {
    await authClient.passkey.deletePasskey({ id });
    await loadSecurityState();
  };

  const handleEnable2FA = async () => {
    if (!password) return setNotice('Enter your account password to configure 2FA.');
    setLoading(true);
    try {
      const res = await authClient.twoFactor.enable({ password });
      if (res?.error) setNotice(res.error.message || 'Failed to enable 2FA');
      else {
        // better-auth 1.7 models enable() as a discriminated union: only the
        // `totp` method carries a provisioning URI and backup codes.
        const data = res?.data;
        if (data && 'totpURI' in data && typeof data.totpURI === 'string') {
          setTotpUri(data.totpURI);
        } else {
          setNotice('2FA provider did not return a TOTP setup URI.');
        }
      }
    } finally { setLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: totpCode });
      if (res?.error) setNotice(res.error.message || 'Invalid TOTP code');
      else { setMfaEnabled(true); setTotpUri(null); setNotice('Two-Factor Authentication (TOTP) activated.'); }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
          {notice}
        </div>
      )}
      <PasskeysCard
        passkeys={passkeys}
        loading={loading}
        onAddPasskey={handleAddPasskey}
        onDeletePasskey={handleDeletePasskey}
      />
      <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 border border-border dark:border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Two-Factor Authentication (2FA TOTP)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Protect sensitive actions with a 6-digit authenticator code.</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${mfaEnabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
            {mfaEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
        {!mfaEnabled && !totpUri && (
          <div className="flex items-center gap-2 max-w-md">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Confirm password to enable 2FA" className="flex-1 px-3 py-2 rounded-xl border border-border dark:border-white/[0.1] bg-background dark:bg-[#090A10] text-xs" />
            <button type="button" onClick={handleEnable2FA} disabled={loading} className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl">Enable 2FA</button>
          </div>
        )}
        {totpUri && (
          <div className="space-y-3 p-4 rounded-xl bg-background dark:bg-[#090A10] border border-border dark:border-white/[0.08]">
            <p className="text-xs font-mono break-all text-muted-foreground">{totpUri}</p>
            <div className="flex items-center gap-2 max-w-xs">
              <KeyRound className="w-4 h-4 text-primary" />
              <input type="text" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit TOTP" className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-mono" />
              <button type="button" onClick={handleVerify2FA} className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Verify</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
