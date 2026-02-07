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
    <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] p-6 space-y-6 text-center rounded-xl bg-card border border-border m-4 backdrop-blur-sm shadow-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          Dashboard Error
        </h2>
        <p className="text-muted-foreground">
          We encountered an issue while loading your dashboard data.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2 max-w-md mx-auto overflow-auto border border-destructive/20">
            {error.message}
          </p>
        )}
      </div>
      <Button
        onClick={() => reset()}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Reload Dashboard
      </Button>
    </div>
  );
}
