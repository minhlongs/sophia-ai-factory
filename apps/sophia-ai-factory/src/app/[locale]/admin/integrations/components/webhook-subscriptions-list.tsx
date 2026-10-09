import React from 'react';
import { Send } from 'lucide-react';
import type { WebhookSubscription } from '@/tree/integrations/types';
import type { TestPingState } from './types';

interface WebhookSubscriptionsListProps {
  isVi: boolean;
  isPending: boolean;
  subscriptions: WebhookSubscription[];
  testResult: Record<string, TestPingState>;
  onTestPing: (subId: string, url: string, secret: string) => void;
}

export function WebhookSubscriptionsList({
  isVi,
  isPending,
  subscriptions,
  testResult,
  onTestPing,
}: WebhookSubscriptionsListProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">
        {isVi ? 'Danh Sách Điểm Cuối Đang Đăng Ký' : 'Active Webhook Endpoints'}
      </h3>
      <div className="mt-4 space-y-3">
        {subscriptions.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">
            {isVi ? 'Chưa có webhook nào được đăng ký' : 'No webhooks subscribed yet'}
          </p>
        ) : (
          subscriptions.map((sub) => {
            const test = testResult[sub.id];

            return (
              <div
                key={sub.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-200">
                        {sub.endpointUrl}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                          sub.isActive
                            ? 'border-emerald-800 bg-emerald-950/50 text-emerald-400'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {sub.isActive ? (isVi ? 'Hoạt động' : 'Active') : (isVi ? 'Tạm dừng' : 'Disabled')}
                      </span>
                    </div>
                    {sub.description && (
                      <p className="text-xs text-zinc-400 mt-0.5">{sub.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {test && (
                      <span
                        className={`text-xs px-2 py-1 rounded font-mono ${
                          test.status === 'success'
                            ? 'bg-emerald-950 text-emerald-400'
                            : test.status === 'error'
                            ? 'bg-red-950 text-red-400'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {test.status === 'testing'
                          ? 'Testing...'
                          : test.status === 'success'
                          ? `HTTP ${test.http}`
                          : 'Failed'}
                      </span>
                    )}

                    <button
                      onClick={() => onTestPing(sub.id, sub.endpointUrl, sub.secretKey)}
                      disabled={isPending}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="h-3 w-3 text-cyan-400" />
                      {isVi ? 'Gửi Ping Thử' : 'Test Ping'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-2.5 text-xs text-zinc-400">
                  <span className="text-zinc-500">{isVi ? 'Sự Kiện' : 'Events'}:</span>
                  {sub.eventTypes.map((et) => (
                    <span
                      key={et}
                      className="rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                    >
                      {et}
                    </span>
                  ))}
                  <span className="ml-auto text-[11px] text-zinc-500 font-mono">
                    Secret: {sub.secretKey.slice(0, 10)}...
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
