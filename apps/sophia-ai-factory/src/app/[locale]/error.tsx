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
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6 text-center">
      <div className="space-y-2 w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl text-[var(--neon-pink)]">
          Đã xảy ra lỗi!
        </h1>
        <p className="text-muted-foreground w-full">
          Xin lỗi vì sự bất tiện này. Đã xảy ra lỗi không mong muốn.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button
          onClick={() => reset()}
          variant="outline"
          className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 w-full sm:w-auto"
        >
          Thử lại
        </Button>
        <Button
          onClick={() => (window.location.href = "/")}
          className="bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80 text-white w-full sm:w-auto"
        >
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
