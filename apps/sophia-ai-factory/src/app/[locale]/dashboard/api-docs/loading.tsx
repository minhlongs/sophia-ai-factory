export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
