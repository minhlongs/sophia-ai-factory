'use client';

import React, { useState, useTransition } from 'react';
import { User, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { Input } from '@/seed/components/ui/input';
import { updateUserProfileAction } from '@/land/account/actions';

interface SettingsProfileSectionProps {
  initialName?: string;
  email?: string;
}

export function SettingsProfileSection({ initialName = '', email = '' }: SettingsProfileSectionProps) {
  const [userName, setUserName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateUserProfileAction({ name: userName });
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    });
  };

  return (
    <section className="bg-[#18181B] rounded-2xl p-6 shadow-xl border border-outline-variant/20">
      <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Profile Details
      </h3>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="relative group cursor-pointer w-20 h-20 shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-all bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {userName ? userName.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="w-5 h-5 text-white" />
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Display Name
            </label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isPending}
              className="bg-surface-container-highest border-outline-variant/30 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Input
                type="email"
                value={email}
                disabled
                className="bg-surface-container-low border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed text-xs"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                <CheckCircle className="w-3 h-3" />
                Verified
              </div>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Profile
            </button>
            {saved && <span className="text-xs text-green-400 font-semibold">Changes saved successfully.</span>}
            {error && <span className="text-xs text-rose-400 font-semibold">{error}</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
