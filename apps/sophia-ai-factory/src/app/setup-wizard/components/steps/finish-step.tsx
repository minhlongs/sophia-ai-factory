import React from 'react';
import { Check } from 'lucide-react';

interface FinishStepProps {
  saveError: string | null;
}

export function FinishStep({ saveError }: FinishStepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
      <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
        <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">Ready to Launch!</h2>
        <p className="text-muted-foreground mt-2">All systems verified. Click below to save configuration and start the dashboard.</p>
      </div>

      {saveError && (
        <div className="bg-destructive/10 p-4 rounded-lg text-left">
          <h4 className="font-semibold text-destructive mb-1">Configuration Warning</h4>
          <p className="text-sm text-destructive">{saveError}</p>
          <p className="text-xs text-destructive/80 mt-2">If downloading, place the file in your project root as <code>.env.local</code> and restart.</p>
        </div>
      )}
    </div>
  );
}
