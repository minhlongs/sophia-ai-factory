'use client';

import React from 'react';
import { Fingerprint, Plus, Trash2, Loader2 } from 'lucide-react';
import type { PasskeyItem } from './settings-security-types';

interface PasskeysCardProps {
  passkeys: PasskeyItem[];
  loading: boolean;
  onAddPasskey: () => void;
  onDeletePasskey: (id: string) => void;
}

export function PasskeysCard({
  passkeys,
  loading,
  onAddPasskey,
  onDeletePasskey,
}: PasskeysCardProps) {
  return (
    <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 border border-border dark:border-white/[0.08] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-primary" />
            Passkeys (WebAuthn / FaceID / TouchID)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Passwordless cryptographic sign-in bound to your device.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddPasskey}
          disabled={loading}
          className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Passkey
        </button>
      </div>
      {passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No passkeys registered yet.</p>
      ) : (
        <ul className="divide-y divide-border dark:divide-white/[0.06]">
          {passkeys.map((pk) => (
            <li key={pk.id} className="py-2.5 flex items-center justify-between text-xs">
              <span className="font-mono font-semibold">{pk.name || pk.id}</span>
              <button
                type="button"
                onClick={() => onDeletePasskey(pk.id)}
                className="text-rose-500 hover:text-rose-400 p-1"
                aria-label="Delete passkey"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
