/**
 * CEO Agent segment loading skeleton.
 * Used while `resolveUserTier()` and any future child data load.
 */

export default function CeoAgentLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading CEO Agent">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-card p-4">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-3 w-40 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
