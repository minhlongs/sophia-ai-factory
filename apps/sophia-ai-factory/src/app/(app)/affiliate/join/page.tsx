'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { JoinPartnerContent } from './view';

export default function JoinAffiliatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <JoinPartnerContent />
    </Suspense>
  );
}
