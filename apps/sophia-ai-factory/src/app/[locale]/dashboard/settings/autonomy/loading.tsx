export default function AutonomyLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-32 w-full rounded bg-muted" />
      </div>
    </div>
  );
}