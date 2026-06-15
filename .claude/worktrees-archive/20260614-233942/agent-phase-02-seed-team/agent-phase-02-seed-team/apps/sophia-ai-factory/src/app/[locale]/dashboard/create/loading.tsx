export default function Loading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-muted rounded w-48" />
        <div className="h-4 bg-muted rounded w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-10 bg-muted rounded-lg" />
          </div>
        ))}
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
