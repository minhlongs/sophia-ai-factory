/**
 * BYOK dashboard loading skeleton — shown by Next.js during SSR suspense.
 * Mirrors the shape of ByokKeyForm: status banner + list + form.
 */
export default function ByokLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      {/* Status banner placeholder */}
      <div className="h-12 bg-muted rounded-lg" />

      {/* Section heading */}
      <div className="h-5 w-48 bg-muted rounded" />

      {/* Configured key list placeholder — 2 rows */}
      <div className="space-y-3">
        <div className="h-14 bg-muted rounded-lg" />
        <div className="h-14 bg-muted rounded-lg" />
      </div>

      {/* Form placeholder — provider select + key input + submit */}
      <div className="space-y-4 border border-border rounded-lg p-6">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 w-28 bg-muted rounded" />
      </div>
    </div>
  );
}
