export default function Loading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-muted rounded w-36" />
        <div className="h-4 bg-muted rounded w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-muted rounded-xl" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
