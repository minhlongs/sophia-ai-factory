"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl text-[var(--neon-pink)]">
          Something went wrong!
        </h1>
        <p className="text-gray-400 max-w-[600px]">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>
      </div>
      <div className="flex gap-4">
        <Button
          onClick={() => reset()}
          variant="outline"
          className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10"
        >
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = "/")}
          className="bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80 text-white"
        >
          Go Home
        </Button>
      </div>
    </div>
  );
}
