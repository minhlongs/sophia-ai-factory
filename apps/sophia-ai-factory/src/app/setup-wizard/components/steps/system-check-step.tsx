import React from 'react';
import { AlertCircle, Server, Check, Save } from 'lucide-react';

export function SystemCheckStep() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-foreground">System Capability Check</h2>
      <div className="grid gap-4">
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-3">
            <Server className="text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">Node.js Environment</p>
              <p className="text-sm text-green-700 dark:text-green-400">Compatible (v18+)</p>
            </div>
          </div>
          <Check className="text-green-600 dark:text-green-400" />
        </div>
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-3">
            <Save className="text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">Write Access</p>
              <p className="text-sm text-green-700 dark:text-green-400">Can write to .env.local (Local Dev)</p>
            </div>
          </div>
          <Check className="text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p>We will configure 3 AI services and 1 Database. Please have your API keys ready.</p>
      </div>
    </div>
  );
}
