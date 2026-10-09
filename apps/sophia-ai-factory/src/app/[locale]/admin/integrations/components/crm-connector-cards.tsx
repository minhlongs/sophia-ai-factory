import React from 'react';
import { Server, Zap, ArrowRightLeft, RefreshCw } from 'lucide-react';
import type { EnterpriseCrmConfig, CrmProvider } from '@/tree/integrations/types';

interface CrmConnectorCardsProps {
  isVi: boolean;
  isPending: boolean;
  configs: EnterpriseCrmConfig[];
  onTriggerSync: (provider: CrmProvider) => void;
}

export function CrmConnectorCards({
  isVi,
  isPending,
  configs,
  onTriggerSync,
}: CrmConnectorCardsProps) {
  const providers: CrmProvider[] = ['salesforce', 'hubspot', 'zapier'];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {providers.map((prov) => {
        const cfg = configs.find((c) => c.provider === prov);
        const isConfigured = Boolean(cfg?.isActive);

        return (
          <div
            key={prov}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm transition-all hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-zinc-800 p-2 text-cyan-400">
                  {prov === 'salesforce' ? (
                    <Server className="h-5 w-5 text-blue-400" />
                  ) : prov === 'hubspot' ? (
                    <Zap className="h-5 w-5 text-orange-400" />
                  ) : (
                    <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-white capitalize">{prov}</h3>
                  <p className="text-xs text-zinc-400">
                    {prov === 'salesforce'
                      ? 'Opportunity & Account Sync'
                      : prov === 'hubspot'
                      ? 'Deal & Pipeline Sync'
                      : 'Webhook Automations'}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                  isConfigured
                    ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-500'
                }`}
              >
                {isConfigured ? (isVi ? 'Đang Hoạt Động' : 'Active') : (isVi ? 'Chưa Kết Nối' : 'Inactive')}
              </span>
            </div>

            <div className="mt-4 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400 space-y-1.5">
              <div className="flex justify-between">
                <span>{isVi ? 'Hướng Đồng Bộ' : 'Sync Direction'}:</span>
                <span className="font-mono text-zinc-200">
                  {cfg?.syncDirection || 'bidirectional'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isVi ? 'Endpoint API' : 'API Endpoint'}:</span>
                <span className="truncate max-w-[160px] font-mono text-zinc-300">
                  {cfg?.apiEndpoint || (isVi ? 'Chưa thiết lập' : 'Not set')}
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onTriggerSync(prov)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
                {isVi ? 'Đồng Bộ Thử' : 'Trigger Sync'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
