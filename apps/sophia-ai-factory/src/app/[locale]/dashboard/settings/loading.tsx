export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-muted rounded w-28" />
        <div className="h-4 bg-muted rounded w-48" />
      </div>
      <div className="flex gap-4 border-b border-border pb-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-9 bg-muted rounded w-24" />
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-20" />
            <div className="h-10 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
