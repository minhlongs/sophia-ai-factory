import React from 'react';
import { Key } from 'lucide-react';

interface WebhookRegisterFormProps {
  isVi: boolean;
  isPending: boolean;
  newSubUrl: string;
  setNewSubUrl: (val: string) => void;
  newSubSecret: string;
  setNewSubSecret: (val: string) => void;
  newSubDesc: string;
  setNewSubDesc: (val: string) => void;
  selectedEvents: string[];
  setSelectedEvents: (events: string[]) => void;
  onCreateSubscription: () => void;
}

export function WebhookRegisterForm({
  isVi,
  isPending,
  newSubUrl,
  setNewSubUrl,
  newSubSecret,
  setNewSubSecret,
  newSubDesc,
  setNewSubDesc,
  selectedEvents,
  setSelectedEvents,
  onCreateSubscription,
}: WebhookRegisterFormProps) {
  const availableEvents = [
    'deal.won',
    'deal.updated',
    'contract.signed',
    'invoice.paid',
    'video.rendered',
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">
        {isVi ? 'Đăng Ký Webhook Đầu Ra Mới' : 'Register New Outbound Webhook Subscription'}
      </h3>
      <p className="mt-1 text-xs text-zinc-400">
        {isVi
          ? 'Tự động gửi thông báo với chữ ký bảo mật Web Crypto HMAC-SHA256 khi có sự kiện.'
          : 'Publishes signed payloads with HMAC-SHA256 and 5-tier exponential backoff.'}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'URL Điểm Cuối (Endpoint URL)' : 'Endpoint URL'}
          </label>
          <input
            type="url"
            placeholder="https://client-api.com/webhooks/sophia"
            value={newSubUrl}
            onChange={(e) => setNewSubUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'Khóa Bí Mật Ký Số (Tự sinh nếu để trống)' : 'HMAC Signing Secret (Auto-generated if blank)'}
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              placeholder="whsec_..."
              value={newSubSecret}
              onChange={(e) => setNewSubSecret(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none font-mono"
            />
            <Key className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'Mô Tả Kết Nối' : 'Description / System'}
          </label>
          <input
            type="text"
            placeholder="e.g. ERP Invoicing Bus"
            value={newSubDesc}
            onChange={(e) => setNewSubDesc(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-300 mb-2">
            {isVi ? 'Loại Sự Kiện Đăng Ký' : 'Subscribed Events'}
          </label>
          <div className="flex flex-wrap gap-2">
            {availableEvents.map((ev) => {
              const isSelected = selectedEvents.includes(ev);
              return (
                <button
                  key={ev}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedEvents(selectedEvents.filter((e) => e !== ev));
                    } else {
                      setSelectedEvents([...selectedEvents, ev]);
                    }
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-mono transition border ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300 font-semibold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {ev}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onCreateSubscription}
          disabled={isPending}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
        >
          {isVi ? 'Tạo Đăng Ký' : 'Create Subscription'}
        </button>
      </div>
    </div>
  );
}
