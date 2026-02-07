"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-6 space-y-6 text-center rounded-xl bg-white/5 border border-white/10 m-4 backdrop-blur-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[var(--neon-pink)]">
          Dashboard Error
        </h2>
        <p className="text-gray-400">
          We encountered an issue while loading your dashboard data.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="text-xs text-red-400 bg-black/50 p-2 rounded mt-2 max-w-md mx-auto overflow-auto">
            {error.message}
          </p>
        )}
      </div>
      <Button
        onClick={() => reset()}
        className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white hover:opacity-90"
      >
        Reload Dashboard
      </Button>
    </div>
  );
}
