/**
 * SOPs list loading skeleton
 */

export default function SopsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-zinc-800 rounded" />
      <div className="h-4 w-56 bg-zinc-800 rounded" />
      <div className="rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-border bg-card last:border-0" />
        ))}
      </div>
    </div>
  );
}
