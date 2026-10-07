'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AffiliateInviteForm } from '@/components/affiliates/portal/affiliate-invite-form';

export default function AffiliateInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [activatedCode, setActivatedCode] = useState<string | null>(null);

  const handleSuccess = (partnerCode: string) => {
    setActivatedCode(partnerCode);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {activatedCode ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-card p-8 shadow-2xl max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">Welcome to the Alliance!</h2>
          <p className="text-xs text-muted-foreground mt-2">
            Your exclusive affiliate partner code is active:
          </p>
          <div className="my-4 p-3 rounded-lg bg-muted/60 font-mono text-base font-bold text-amber-600 dark:text-amber-400">
            {activatedCode}
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/affiliates/portal')}
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-semibold text-white transition"
          >
            Access Partner Portal
          </button>
        </div>
      ) : (
        <AffiliateInviteForm token={token} onSuccess={handleSuccess} />
      )}
    </div>
  );
}
