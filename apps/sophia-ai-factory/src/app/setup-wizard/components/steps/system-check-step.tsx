import React from 'react';
import { AlertCircle, Server, Check, Save } from 'lucide-react';

export function SystemCheckStep() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-gray-800">System Capability Check</h2>
      <div className="grid gap-4">
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-3">
            <Server className="text-green-600" />
            <div>
              <p className="font-medium text-gray-900">Node.js Environment</p>
              <p className="text-sm text-green-700">Compatible (v18+)</p>
            </div>
          </div>
          <Check className="text-green-600" />
        </div>
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-3">
            <Save className="text-green-600" />
            <div>
              <p className="font-medium text-gray-900">Write Access</p>
              <p className="text-sm text-green-700">Can write to .env.local (Local Dev)</p>
            </div>
          </div>
          <Check className="text-green-600" />
        </div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p>We will configure 3 AI services and 1 Database. Please have your API keys ready.</p>
      </div>
    </div>
  );
}
