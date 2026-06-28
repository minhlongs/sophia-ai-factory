export function MockModeIndicator() {
  const isMock = process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === "true";

  if (!isMock) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-amber-900/30 px-4 py-2 text-xs font-bold text-amber-300 shadow-lg border border-amber-700">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
      MOCK MODE ACTIVE
    </div>
  );
}
