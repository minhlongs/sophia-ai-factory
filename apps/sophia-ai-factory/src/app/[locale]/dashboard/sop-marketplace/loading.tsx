/**
 * SOP Marketplace loading skeleton
 */

export default function MarketplaceLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded" />
      <div className="h-4 w-72 bg-zinc-800 rounded" />
      <div className="flex gap-3">
        <div className="h-10 w-40 bg-zinc-800 rounded-lg" />
        <div className="h-10 flex-1 bg-zinc-800 rounded-lg" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3 h-48" />
        ))}
      </div>
    </div>
  );
}
