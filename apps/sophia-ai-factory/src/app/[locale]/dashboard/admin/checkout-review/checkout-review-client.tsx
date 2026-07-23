'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Ban } from 'lucide-react';

interface ReviewItem {
 order_id: string;
 user_id: string;
 tier: string;
 amount_usd_cents: number;
 status: string;
 review_reason: string | null;
 created_at: string;
}

const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;

export function CheckoutReviewClient() {
 const [items, setItems] = useState<ReviewItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [acting, setActing] = useState<string | null>(null);

 const load = async () => {
   setLoading(true);
   setError(null);
   try {
     const res = await fetch('/api/admin/checkout/review');
     if (!res.ok) throw new Error('HTTP ' + res.status);
     const json = (await res.json()) as { items: ReviewItem[] };
     setItems(json.items);
   } catch (e) {
     setError(e instanceof Error ? e.message : 'Failed to load');
   } finally {
     setLoading(false);
   }
 };

 useEffect(() => { load(); }, []);

 const act = async (order_id: string, action: 'approve' | 'reject' | 'cancel', review_reason?: string) => {
   setActing(order_id + action);
   try {
     const res = await fetch('/api/admin/checkout/review', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ order_id, action, review_reason: review_reason ?? null }),
     });
     if (!res.ok) throw new Error('HTTP ' + res.status);
     await load();
   } catch (e) {
     setError(e instanceof Error ? e.message : 'Action failed');
   } finally {
     setActing(null);
   }
 };

 return (
   <div className="space-y-3">
     <div className="flex items-center justify-between">
       <p className="text-xs text-muted-foreground">{items.length} orders in queue</p>
       <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted">
         <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
       </button>
     </div>
     {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
     <div className="rounded-xl border border-border bg-card overflow-hidden">
       <div className="overflow-x-auto">
         <table className="w-full text-sm">
           <thead>
             <tr className="border-b border-border text-xs text-muted-foreground">
               <th className="px-4 py-3 text-left font-medium">Order</th>
               <th className="px-4 py-3 text-left font-medium">User</th>
               <th className="px-4 py-3 text-left font-medium">Tier</th>
               <th className="px-4 py-3 text-right font-medium">Amount</th>
               <th className="px-4 py-3 text-left font-medium">Status</th>
               <th className="px-4 py-3 text-left font-medium">Created</th>
               <th className="px-4 py-3 text-right font-medium">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-border">
             {items.map((it) => (
               <tr key={it.order_id} className="hover:bg-muted/30 transition-colors">
                 <td className="px-4 py-3 font-mono text-xs">{it.order_id.slice(0, 10)}...</td>
                 <td className="px-4 py-3 font-mono text-xs">{it.user_id.slice(0, 10)}...</td>
                 <td className="px-4 py-3 text-xs">{it.tier}</td>
                 <td className="px-4 py-3 text-right font-mono">{fmt(it.amount_usd_cents)}</td>
                 <td className="px-4 py-3 text-xs">{it.status}</td>
                 <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(it.created_at).toLocaleString()}</td>
                 <td className="px-4 py-3">
                   <div className="flex items-center justify-end gap-2">
                     <button
                       onClick={() => act(it.order_id, 'approve')}
                       disabled={acting === it.order_id + 'approve'}
                       className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
                     >
                       <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                     </button>
                     <button
                       onClick={() => act(it.order_id, 'reject', 'Manual review rejected')}
                       disabled={acting === it.order_id + 'reject'}
                       className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                     >
                       <XCircle className="w-3.5 h-3.5" /> Reject
                     </button>
                     <button
                       onClick={() => act(it.order_id, 'cancel')}
                       disabled={acting === it.order_id + 'cancel'}
                       className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/80 disabled:opacity-50"
                     >
                       <Ban className="w-3.5 h-3.5" /> Cancel
                     </button>
                   </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     </div>
   </div>
 );
}
