'use client';

import React from 'react';

export const AVAILABLE_WEBHOOK_EVENTS = [
  'deal.won',
  'deal.updated',
  'contract.signed',
  'invoice.paid',
  'video.rendered',
] as const;

export interface WebhookEventsSelectorProps {
  isVi: boolean;
  selectedEvents: string[];
  setSelectedEvents: (events: string[]) => void;
}

export function WebhookEventsSelector({
  isVi,
  selectedEvents,
  setSelectedEvents,
}: WebhookEventsSelectorProps) {
  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-medium text-zinc-300 mb-2">
        {isVi ? 'Loại Sự Kiện Đăng Ký' : 'Subscribed Events'}
      </label>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_WEBHOOK_EVENTS.map((ev) => {
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
  );
}
