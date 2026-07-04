'use client';

/**
 * SOP Reviews Client — interactive table for approving/rejecting community SOPs.
 *
 * @module app/[locale]/dashboard/admin/sop-reviews/sop-reviews-client
 */

import { useState, useTransition } from 'react';
import { approveSopAction, rejectSopAction } from './actions';

export interface PendingSop {
  id: string;
  name_vi: string;
  name_en: string;
  category: string;
  created_at: number;
  author_name: string | null;
}

interface Props {
  sops: PendingSop[];
}

export function SopReviewsClient({ sops }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleApprove(id: string) {
    setPending(id);
    setMessage(null);
    startTransition(async () => {
      const result = await approveSopAction(id);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: 'SOP approved and published.' });
      }
      setPending(null);
    });
  }

  async function handleReject(id: string) {
    setPending(id);
    setMessage(null);
    startTransition(async () => {
      const result = await rejectSopAction(id);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: 'SOP rejected and returned to draft.' });
      }
      setPending(null);
    });
  }

  const fmtDate = (unixMs: number) => {
    const d = new Date(unixMs);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (sops.length === 0) {
    return (
      <div className="space-y-6">
        {message && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              message.ok
                ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
                : 'border-red-800 bg-red-950/30 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No SOPs pending review.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.ok
              ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
              : 'border-red-800 bg-red-950/30 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Author</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sops.map((sop) => (
              <tr key={sop.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{sop.name_en}</div>
                  <div className="text-xs text-muted-foreground">{sop.name_vi}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{sop.author_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-medium text-primary-400 capitalize">
                    {sop.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {fmtDate(sop.created_at)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleApprove(sop.id)}
                      disabled={!!(isPending && pending)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      {pending === sop.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(sop.id)}
                      disabled={!!(isPending && pending)}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {pending === sop.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
