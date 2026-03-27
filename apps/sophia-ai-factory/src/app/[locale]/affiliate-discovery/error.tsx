"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AffiliateDiscoveryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Đang Tải Công Cụ Khám Phá
        </h2>
        <p className="text-muted-foreground">
          Chúng tôi đang xử lý dữ liệu liên kết. Tính năng này đang được thiết lập
          — vui lòng quay lại sau giây lát.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Thử Lại
          </Button>
          <Button asChild>
            <Link href="/dashboard">Về Bảng Điều Khiển</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
