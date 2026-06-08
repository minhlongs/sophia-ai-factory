/**
 * SOP Marketplace loading skeleton
 */

export default function MarketplaceLoading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-4 w-72 bg-muted rounded" />
      <div className="flex gap-3">
        <div className="h-10 w-40 bg-muted rounded-lg" />
        <div className="h-10 flex-1 bg-muted rounded-lg" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3 h-48" />
        ))}
      </div>
    </div>
  );
}
