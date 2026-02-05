import React from 'react';
import { Check } from 'lucide-react';

interface FinishStepProps {
  saveError: string | null;
}

export function FinishStep({ saveError }: FinishStepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
      <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <Check className="w-12 h-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ready to Launch!</h2>
        <p className="text-gray-600 mt-2">All systems verified. Click below to save configuration and start the dashboard.</p>
      </div>

      {saveError && (
        <div className="bg-red-50 p-4 rounded-lg text-left">
          <h4 className="font-semibold text-red-800 mb-1">Configuration Warning</h4>
          <p className="text-sm text-red-700">{saveError}</p>
          <p className="text-xs text-red-600 mt-2">If downloading, place the file in your project root as <code>.env.local</code> and restart.</p>
        </div>
      )}
    </div>
  );
}
